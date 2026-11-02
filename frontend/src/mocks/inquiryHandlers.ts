import { http, HttpResponse, delay } from 'msw'
import { db, syncDbFromStorage, newId, type DbSession, type DbTopic, type DbUser } from './db'
import { recordDemoUsage } from './teacherAiHandlers'
import { teachingAccess, teachingDenial } from './teachingAccess'
import { scenarios } from './scenarios'
import type {
  ClassSummary,
  IndividualReport,
  InquiryDetail,
  InquirySetup,
  SetupInput,
  SetupJob,
} from '@/api/inquiry'
import {
  groupDemoReports,
  summarizeViewpointTimeline,
  textLength,
  validateSetup,
} from '@/lib/inquiry'
import { mockModels } from './models'
import { researchTopics, setupFromResearch } from '@/data/researchTopics'

const base = '*/api/v1'
const fail = (status: number, detail: string) => HttpResponse.json({ detail }, { status })
const jobs = new Map<
  string,
  { teacher: string; course: string; input: SetupInput; job: SetupJob }
>()
export { mockModels } from './models'

function auth(request: Request, role: 'TEACHER' | 'USER'): DbUser | Response {
  syncDbFromStorage()
  const id = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+mock-token\./, '')
  const user = db.users.find((item) => item.id === id)
  if (!user) return fail(401, 'Not authenticated or token expired')
  if (user.must_change_password) return fail(403, 'Password change required')
  if (role === 'TEACHER' && user.role === 'USER') return teachingDenial(request, user) ?? user
  if (user.role !== role)
    return fail(
      403,
      role === 'TEACHER' ? 'Teacher privileges required' : 'Student privileges required',
    )
  return user
}
function ownsCourse(user: DbUser, courseId: string) {
  return !!teachingAccess(user, courseId)
}
function topicFor(user: DbUser, id: string) {
  const topic = db.topics.find((item) => item.id === id)
  return topic && ownsCourse(user, topic.course_id) ? topic : undefined
}
function enrolled(user: DbUser, topic: DbTopic) {
  return db.enrollments.some(
    (item) =>
      item.student_id === user.id && item.course_id === topic.course_id && item.role !== 'TA',
  )
}
async function latency(group: 'teacherTopics' | 'teacherResults' | 'studentResults') {
  await delay(scenarios.latency)
  if (scenarios.groups[group] === 'pending') await delay('infinite')
  if (scenarios.groups[group] === 'slow') await delay(3000)
  return scenarios.groups[group] === 'error' ? fail(500, 'Internal Server Error') : null
}

export function defaultSetup(topic: DbTopic): InquirySetup {
  return (
    topic.setup ?? {
      age_band:
        topic.age_range === '13-15'
          ? '13-15'
          : topic.age_range === '16-18'
            ? '16-18'
            : 'university_plus',
      max_turns: [5, 10, 15].includes(topic.max_rounds) ? (topic.max_rounds as 5 | 10 | 15) : 10,
      topic: topic.title,
      core_question: topic.description || topic.title,
      inquiry_focus: '提出自己的立場與理由，檢視前提，並回應不同觀點。',
      background_info: topic.description || '從日常情境出發，清楚說明你的判斷依據。',
      exclusions: '未指定',
      opening_message: `今天一起思考：「${topic.title}」。你的第一個想法是什麼？請試著說明理由。`,
    }
  )
}
function detail(topic: DbTopic): InquiryDetail {
  return {
    topic_id: topic.id,
    course_id: topic.course_id,
    version: topic.setup_version ?? 1,
    status: topic.publication_status ?? 'published',
    model_id: topic.model_id ?? mockModels[0]!.id,
    source_language: topic.source_language ?? 'zh-TW',
    setup: defaultSetup(topic),
  }
}
function checks(_setup: InquirySetup): SetupJob['checks'] {
  return [
    'topic',
    'core_question',
    'inquiry_focus',
    'background_info',
    'exclusions',
    'opening_message',
  ].map((field) => ({
    field,
    status: 'needs_review',
    message: '內容已整理，請教師確認與課程目標一致。',
  }))
}
function prepared(input: SetupInput): InquirySetup {
  const match = researchTopics.find((topic) => input.description.includes(topic.title))
  if (match) return setupFromResearch(match, input.age_band, input.max_turns)
  const title = input.description.split(/[。？！\n]/)[0]?.slice(0, 34) || '課堂探究'
  return {
    age_band: input.age_band,
    max_turns: input.max_turns,
    topic: title,
    core_question: input.description,
    inquiry_focus: '說明自己的觀點與理由，檢視一個可能的反例，並回應不同觀點。',
    background_info: '依教師描述進行探究；尚未提供的事實背景須由教師補充。',
    exclusions: '未指定',
    opening_message: `我們一起思考這個問題：「${title}」。你目前怎麼看？可以先提出一個理由或例子。`,
  }
}
export function anonymousId(courseId: string, studentId: string) {
  let hash = 2166136261
  for (const char of `${courseId}:${studentId}`)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `S-${(hash >>> 0).toString(36).toUpperCase().padStart(6, '0')}`
}

export function reportFor(session: DbSession): IndividualReport {
  if (session.report) return session.report
  const topic = db.topics.find((item) => item.id === session.topic_id)!
  const answers = session.messages.filter((message) => message.role === 'user')
  const substantive = answers
    .map((answer, index) => ({ ...answer, turn: index + 1 }))
    .filter((answer) => answer.content !== '略過這一題' && answer.content.trim())
  const final = substantive.slice(-1)[0]
  const undetermined = !final || /還不確定|尚未確定|不知道|尚未形成/.test(final.content)
  const reasons = substantive.slice(-3).map((answer) => ({
    text: answer.content,
    evidence: { message_id: answer.id, turn: answer.turn, quote: answer.content },
  }))
  const report: IndividualReport = {
    report_id: `report-${session.id}`,
    version: 1,
    session_id: session.id,
    topic_id: topic.id,
    anonymous_id: anonymousId(topic.course_id, session.student_id),
    completed_at: session.completed_at ?? topic.created_at,
    completed_turns: answers.length,
    completion_reason:
      session.completion_reason ??
      (answers.length >= topic.max_rounds ? 'max_turns' : 'goal_met_and_consented'),
    inquiry_summary: `本次對話圍繞「${topic.title}」進行。以下整理僅引用學生實際送出的回答，不將蘇格拉底的提問當成學生立場。`,
    viewpoint_summary: undetermined
      ? `學生尚未形成明確立場${final ? `，最後表示「${final.content}」` : ''}。目前的回答不足以推定其支持或反對；尚未說明的理由仍待追問。`
      : `學生在最後一則回答中表示「${final.content}」。以下依對話保留其已表達的內容；未明說的理由、立場轉變與外部事實不另行推定。`,
    evidence_status: substantive.length ? 'partial' : 'insufficient',
    strongest_reason: null,
    tested_challenges: session.messages
      .flatMap((message, index) => {
        if (!index || message.role !== 'assistant') return []
        const answer = session.messages[index + 1]
        return [
          {
            challenge: message.content,
            response: answer?.role === 'user' ? answer.content : null,
            evidence:
              answer?.role === 'user'
                ? {
                    message_id: answer.id,
                    turn: session.messages
                      .slice(0, index + 2)
                      .filter((item) => item.role === 'user').length,
                    quote: answer.content,
                  }
                : undefined,
          },
        ]
      })
      .slice(-2),
    revision_or_defense:
      '未執行正式 AI 判讀，尚無充分依據確認學生修正或辯護的過程；可回看已保存的回答。',
    focus_connection: `本次探究重點為「${session.setup_snapshot?.inquiry_focus ?? defaultSetup(topic).inquiry_focus}」。學生如何連結這些重點，仍須依具體回覆核對。`,
    viewpoint_timeline: answers.map((answer, index) => {
      const position = session.messages.findIndex((message) => message.id === answer.id)
      const question = session.messages
        .slice(0, position)
        .reverse()
        .find((message) => message.role === 'assistant')
      return {
        turn: index + 1,
        question: question?.content ?? '提問內容未保存',
        question_message_id: question?.id,
        answer: { message_id: answer.id, turn: index + 1, quote: answer.content },
        before_summary: index ? `學生前一回覆表示「${answers[index - 1]!.content}」。` : null,
        after_summary: `學生在此回覆中表示「${answer.content}」。`,
        change_type: index ? ('unassessed' as const) : ('initial' as const),
        attribution: 'sequence_only' as const,
        explanation:
          '依保存的提問與回覆呈現對話順序；未執行正式 AI 判讀，不將先後關係直接視為觀點改變的原因。',
      }
    }),
    final_viewpoint: undetermined ? null : final.content,
    viewpoint_status: undetermined ? 'undetermined' : 'expressed',
    reasons,
    other_perspectives: [],
    open_questions: ['在什麼情境下，你會重新考慮目前的判斷？'],
    viewpoint_changes: [],
    limitations: ['示範報告以已保存的學生回答整理，未執行正式 AI 評估。'],
  }
  session.report = report
  recordDemoUsage(topic.course_id, 'report', session.model_id)
  return report
}

export function collectionFor(topic: DbTopic) {
  const latest = new Map<string, DbSession>()
  for (const session of db.sessions.filter(
    (item) =>
      item.topic_id === topic.id &&
      item.status === 'COMPLETED' &&
      !db.enrollments.some(
        (member) =>
          member.course_id === topic.course_id &&
          member.student_id === item.student_id &&
          member.role === 'TA',
      ),
  )) {
    const previous = latest.get(session.student_id)
    if (!previous || (session.completed_at ?? session.id) >= (previous.completed_at ?? previous.id))
      latest.set(session.student_id, session)
  }
  return {
    topic_id: topic.id,
    roster_count: db.enrollments.filter(
      (item) => item.course_id === topic.course_id && item.role !== 'TA',
    ).length,
    completed_count: latest.size,
    pending_count: 0,
    failed_count: 0,
    reports: [...latest.values()].map(reportFor),
  }
}

function nextOpening(setup: InquirySetup, language: SetupInput['source_language'] = 'zh-TW') {
  const options =
    language === 'en'
      ? [
          `Let's explore “${setup.topic}”. ${setup.core_question} What is your first judgement, and what reason supports it?`,
          `Imagine that someone disagrees with your view on “${setup.topic}”. What would you say first, and why?`,
        ]
      : language === 'es'
        ? [
            `Exploremos «${setup.topic}». ${setup.core_question} ¿Cuál es tu primera opinión y qué razón la apoya?`,
            `Imagina que alguien no comparte tu opinión sobre «${setup.topic}». ¿Qué dirías primero y por qué?`,
          ]
        : [
            `我們從「${setup.topic}」出發。${setup.core_question} 你目前傾向怎麼判斷？先說一個支持你想法的理由。`,
            `想像有一位同學對「${setup.topic}」的想法與你不同。你會先提出哪個例子或理由，邀請他一起思考？`,
          ]
  return options.find((text) => text !== setup.opening_message) ?? options[0]!
}

function buildSummary(topic: DbTopic): ClassSummary {
  const collection = collectionFor(topic)
  const { groups, ungrouped } = groupDemoReports(collection.reports)
  return {
    summary_id: newId('summary'),
    version: Math.max(topic.summary_draft?.version ?? 0, topic.summary_published?.version ?? 0) + 1,
    status: 'draft',
    topic_id: topic.id,
    overview: `全班 ${collection.roster_count} 位學生中，有 ${collection.completed_count} 位完成探究。根據 ${collection.reports.length} 份個人報告，整理出 ${groups.length} 組相近觀點${ungrouped.length ? `，另有 ${ungrouped.length} 位仍在思考立場` : ''}。請比較各組使用的理由與限制條件，再思考自己是否需要修正判斷。`,
    viewpoint_summary: `${groups.map((group) => `${group.count} 份報告的目前觀點為「${group.title}」`).join('；')}。${ungrouped.length ? `另有 ${ungrouped.length} 份報告尚未形成明確觀點。` : ''}這些表述不代表學生已回應所有反例，也不代表全班形成共識。`,
    viewpoint_timeline: summarizeViewpointTimeline(collection.reports, groups),
    groups,
    ungrouped_report_ids: ungrouped,
    ungrouped_count: ungrouped.length,
    report_count: collection.reports.length,
    completed_count: collection.completed_count,
    roster_count: collection.roster_count,
    generated_at: new Date().toISOString(),
    published_at: null,
  }
}

export const inquiryHandlers = [
  http.get(`${base}/teacher/inquiry-models`, ({ request }) => {
    const user = auth(request, 'TEACHER')
    return user instanceof Response ? user : HttpResponse.json(mockModels)
  }),
  http.post(`${base}/teacher/courses/:courseId/opening-message`, async ({ request, params }) => {
    const user = auth(request, 'TEACHER')
    if (user instanceof Response) return user
    if (!ownsCourse(user, String(params.courseId))) return fail(404, 'Course not found')
    const payload = (await request.json()) as {
      setup: InquirySetup
      source_language: SetupInput['source_language']
      model_id: string
    }
    if (
      !payload.setup?.topic?.trim() ||
      !payload.setup.core_question?.trim() ||
      !['zh-TW', 'en', 'es'].includes(payload.source_language) ||
      !mockModels.some((model) => model.id === payload.model_id)
    )
      return fail(422, '請填寫主題、核心探究問題，並確認語言與模型。')
    const error = await latency('teacherTopics')
    if (error) return error
    recordDemoUsage(String(params.courseId), 'setup', payload.model_id)
    return HttpResponse.json({
      opening_message: nextOpening(payload.setup, payload.source_language),
    })
  }),
  http.post(`${base}/teacher/courses/:courseId/setup-revisions`, async ({ request, params }) => {
    const user = auth(request, 'TEACHER')
    if (user instanceof Response) return user
    const courseId = String(params.courseId)
    if (!ownsCourse(user, courseId)) return fail(404, 'Course not found')
    const payload = (await request.json()) as {
      setup: InquirySetup
      feedback: string
      source_language: SetupInput['source_language']
    }
    if (
      !payload.setup ||
      !validateSetup(payload.setup) ||
      !payload.feedback?.trim() ||
      !['zh-TW', 'en', 'es'].includes(payload.source_language)
    )
      return fail(422, '請填寫回饋並確認八欄完整。')
    const error = await latency('teacherTopics')
    if (error) return error
    const setup = {
      ...payload.setup,
      inquiry_focus: `${payload.setup.inquiry_focus}\n教師修訂：${payload.feedback.trim()}`,
      opening_message: nextOpening(payload.setup, payload.source_language),
    }
    const input = {
      age_band: setup.age_band,
      max_turns: setup.max_turns,
      description: setup.core_question,
      source_language: payload.source_language,
    }
    const job: SetupJob = {
      job_id: newId('setup'),
      question_count: 0,
      questions: [],
      setup,
      checks: checks(setup),
    }
    jobs.set(job.job_id, { teacher: user.id, course: courseId, input, job })
    recordDemoUsage(courseId, 'setup')
    return HttpResponse.json(job)
  }),
  http.post(`${base}/teacher/courses/:courseId/setup-jobs`, async ({ request, params }) => {
    const user = auth(request, 'TEACHER')
    if (user instanceof Response) return user
    const courseId = String(params.courseId)
    if (!ownsCourse(user, courseId)) return fail(404, 'Course not found')
    const error = await latency('teacherTopics')
    if (error) return error
    const input = (await request.json()) as SetupInput
    if (
      !['13-15', '16-18', 'university_plus'].includes(input.age_band) ||
      ![5, 10, 15].includes(input.max_turns) ||
      !['zh-TW', 'en', 'es'].includes(input.source_language) ||
      typeof input.description !== 'string' ||
      textLength(input.description) < 20 ||
      textLength(input.description) > 6000
    )
      return fail(422, '請確認年齡層、回合與描述字數（20–6000 字）。')
    const questions =
      textLength(input.description) < 60
        ? [
            { id: 'focus', text: '這次最希望學生檢視哪些概念或不同觀點？' },
            { id: 'background', text: '學生需要知道哪些情境或必要背景？' },
            { id: 'exclusions', text: '有哪些不希望納入討論的範圍？沒有可略過。' },
          ]
        : []
    const setup = prepared(input)
    const job: SetupJob = {
      job_id: newId('setup'),
      question_count: questions.length,
      questions,
      setup,
      checks: setup ? checks(setup) : [],
    }
    jobs.set(job.job_id, { teacher: user.id, course: courseId, input, job })
    recordDemoUsage(courseId, 'setup')
    return HttpResponse.json(job)
  }),
  http.post(
    `${base}/teacher/courses/:courseId/setup-jobs/:jobId/answers`,
    async ({ request, params }) => {
      const user = auth(request, 'TEACHER')
      if (user instanceof Response) return user
      const saved = jobs.get(String(params.jobId))
      if (
        !saved ||
        saved.teacher !== user.id ||
        saved.course !== params.courseId ||
        !ownsCourse(user, saved.course)
      )
        return fail(404, '找不到設定工作')
      const error = await latency('teacherTopics')
      if (error) return error
      const { answers } = (await request.json()) as { answers: Record<string, string> }
      const setup = prepared(saved.input)
      if (answers?.focus?.trim()) setup.inquiry_focus = answers.focus.trim()
      if (answers?.background?.trim()) setup.background_info = answers.background.trim()
      if (answers?.exclusions?.trim()) setup.exclusions = answers.exclusions.trim()
      saved.job = { ...saved.job, questions: [], setup, checks: checks(setup) }
      recordDemoUsage(saved.course, 'setup')
      return HttpResponse.json(saved.job)
    },
  ),
  http.post(
    `${base}/teacher/courses/:courseId/setup-jobs/:jobId/refine`,
    async ({ request, params }) => {
      const user = auth(request, 'TEACHER')
      if (user instanceof Response) return user
      const saved = jobs.get(String(params.jobId))
      if (
        !saved ||
        saved.teacher !== user.id ||
        saved.course !== params.courseId ||
        !ownsCourse(user, saved.course)
      )
        return fail(404, '找不到設定工作')
      const error = await latency('teacherTopics')
      if (error) return error
      const payload = (await request.json()) as { setup: InquirySetup; feedback: string }
      if (!validateSetup(payload.setup) || !payload.feedback.trim())
        return fail(422, '請填寫修訂回饋並確認八欄完整。')
      const setup = {
        ...payload.setup,
        inquiry_focus: `${payload.setup.inquiry_focus}\n教師修訂：${payload.feedback.trim()}`,
        opening_message: nextOpening(payload.setup, saved.input.source_language),
      }
      saved.job = { ...saved.job, setup, questions: [], checks: checks(setup) }
      recordDemoUsage(saved.course, 'setup')
      return HttpResponse.json(saved.job)
    },
  ),
  http.get(`${base}/teacher/topics/:topicId/setup`, async ({ request, params }) => {
    const user = auth(request, 'TEACHER')
    if (user instanceof Response) return user
    const topic = topicFor(user, String(params.topicId))
    if (!topic) return fail(404, 'Topic not found')
    const error = await latency('teacherTopics')
    return error ?? HttpResponse.json(detail(topic))
  }),
  http.post(`${base}/teacher/courses/:courseId/inquiries`, async ({ request, params }) => {
    const user = auth(request, 'TEACHER')
    if (user instanceof Response) return user
    const courseId = String(params.courseId)
    if (!ownsCourse(user, courseId)) return fail(404, 'Course not found')
    const payload = (await request.json()) as InquiryDetail & { expected_version?: number }
    if (
      !payload.setup ||
      !validateSetup(payload.setup) ||
      !['draft', 'published'].includes(payload.status) ||
      !mockModels.some((model) => model.id === payload.model_id) ||
      !['zh-TW', 'en', 'es'].includes(payload.source_language)
    )
      return fail(422, '請確認八欄設定、內容語言與模型。')
    let topic = payload.topic_id ? topicFor(user, payload.topic_id) : undefined
    if (payload.topic_id && (!topic || topic.course_id !== courseId))
      return fail(404, 'Topic not found')
    const error = await latency('teacherTopics')
    if (error) return error
    if (user.role !== 'TEACHER' && payload.status !== 'draft')
      return fail(403, '只有老師可以發布活動。')
    if (topic && (topic.publication_status ?? 'published') !== 'draft')
      return fail(409, '活動已發布，無法再修改。')
    if (topic && payload.expected_version !== (topic.setup_version ?? 1))
      return fail(409, '設定已有更新，請重新載入後再儲存。')
    const nextVersion = topic ? (topic.setup_version ?? 1) + 1 : 1
    if (!topic) {
      topic = {
        id: newId('t'),
        course_id: courseId,
        title: payload.setup.topic,
        description: payload.setup.core_question,
        age_range: payload.setup.age_band,
        max_rounds: payload.setup.max_turns,
        created_at: new Date().toISOString(),
      }
      db.topics.push(topic)
    }
    Object.assign(topic, {
      title: payload.setup.topic,
      description: payload.setup.core_question,
      age_range: payload.setup.age_band,
      max_rounds: payload.setup.max_turns,
      setup: structuredClone(payload.setup),
      publication_status: payload.status,
      setup_version: nextVersion,
      model_id: payload.model_id,
      source_language: payload.source_language,
    })
    return HttpResponse.json(detail(topic))
  }),
  http.get(`${base}/teacher/topics/:topicId/reports`, async ({ request, params }) => {
    const user = auth(request, 'TEACHER')
    if (user instanceof Response) return user
    const topic = topicFor(user, String(params.topicId))
    if (!topic) return fail(404, 'Topic not found')
    const error = await latency('teacherResults')
    if (error) return error
    const collection = collectionFor(topic)
    return HttpResponse.json(
      scenarios.groups.teacherResults === 'empty'
        ? { ...collection, reports: [], completed_count: 0 }
        : collection,
    )
  }),
  http.get(`${base}/teacher/topics/:topicId/summary`, async ({ request, params }) => {
    const user = auth(request, 'TEACHER')
    if (user instanceof Response) return user
    const topic = topicFor(user, String(params.topicId))
    if (!topic) return fail(404, 'Topic not found')
    const error = await latency('teacherResults')
    return (
      error ??
      HttpResponse.json({
        draft: topic.summary_draft ?? null,
        published: topic.summary_published ?? null,
      })
    )
  }),
  http.post(`${base}/teacher/topics/:topicId/summary`, async ({ request, params }) => {
    const user = auth(request, 'TEACHER')
    if (user instanceof Response) return user
    const topic = topicFor(user, String(params.topicId))
    if (!topic) return fail(404, 'Topic not found')
    const collection = collectionFor(topic)
    if (!collection.reports.length) return fail(409, '還沒有可用的個人報告。')
    const error = await latency('teacherResults')
    if (error) return error
    topic.summary_draft = buildSummary(topic)
    recordDemoUsage(topic.course_id, 'summary', topic.model_id)
    return HttpResponse.json(topic.summary_draft)
  }),
  http.patch(`${base}/teacher/topics/:topicId/summary`, async ({ request, params }) => {
    const user = auth(request, 'TEACHER')
    if (user instanceof Response) return user
    const topic = topicFor(user, String(params.topicId))
    if (!topic?.summary_draft) return fail(404, '找不到摘要草稿')
    const payload = (await request.json()) as Pick<
      ClassSummary,
      'version' | 'overview' | 'viewpoint_summary'
    >
    if (payload.version !== topic.summary_draft.version)
      return fail(409, '摘要已更新，請重新載入。')
    if (
      (payload.viewpoint_summary !== undefined && !payload.viewpoint_summary?.trim()) ||
      !payload.overview?.trim()
    )
      return fail(422, '請填寫概述與觀點總結。')
    topic.summary_draft = {
      ...topic.summary_draft,
      version: payload.version + 1,
      overview: payload.overview.trim(),
      viewpoint_summary: payload.viewpoint_summary?.trim() ?? topic.summary_draft.viewpoint_summary,
      status: 'draft',
    }
    return HttpResponse.json(topic.summary_draft)
  }),
  ...(['review', 'publish', 'withdraw'] as const).map((action) =>
    http.post(`${base}/teacher/topics/:topicId/summary/${action}`, async ({ request, params }) => {
      const user = auth(request, 'TEACHER')
      if (user instanceof Response) return user
      const topic = topicFor(user, String(params.topicId))
      if (!topic) return fail(404, 'Topic not found')
      const { version } = (await request.json()) as { version: number }
      const target = action === 'withdraw' ? topic.summary_published : topic.summary_draft
      if (!target || version !== target.version) return fail(409, '摘要版本已更新，請重新載入。')
      if (action === 'withdraw') {
        topic.summary_published = undefined
        if (topic.summary_draft?.status === 'published') topic.summary_draft.status = 'draft'
        return HttpResponse.json({ message: '已撤回發布' })
      }
      if (action === 'publish' && target.status !== 'reviewed')
        return fail(409, '請先完成教師審閱。')
      if (action === 'review') target.status = 'reviewed'
      else {
        topic.summary_published = structuredClone({
          ...JSON.parse(JSON.stringify(target)),
          status: 'published',
          published_at: new Date().toISOString(),
        })
        target.status = 'published'
      }
      return HttpResponse.json(action === 'publish' ? topic.summary_published : target)
    }),
  ),
  http.get(`${base}/student/sessions/:sessionId/report`, async ({ request, params }) => {
    const user = auth(request, 'USER')
    if (user instanceof Response) return user
    const session = db.sessions.find(
      (item) => item.id === params.sessionId && item.student_id === user.id,
    )
    const topic = session && db.topics.find((item) => item.id === session.topic_id)
    if (!session || !topic || !enrolled(user, topic)) return fail(404, 'Session not found')
    if (session.status !== 'COMPLETED') return fail(409, 'Session not completed')
    const error = await latency('studentResults')
    return error ?? HttpResponse.json({ status: 'ready', report: reportFor(session) })
  }),
  http.get(`${base}/student/topics/:topicId/summary`, async ({ request, params }) => {
    const user = auth(request, 'USER')
    if (user instanceof Response) return user
    const topic = db.topics.find((item) => item.id === params.topicId)
    if (!topic || !enrolled(user, topic)) return fail(404, 'Topic not found')
    const error = await latency('studentResults')
    if (error) return error
    const published = topic.summary_published
    // Student payload contains no report IDs or drill-through identifiers.
    return HttpResponse.json({
      summary: published
        ? {
            ...published,
            groups: published.groups.map((group) => ({ ...group, report_ids: [] })),
            ungrouped_report_ids: [],
          }
        : null,
    })
  }),
  http.post(`${base}/student/sessions/:sessionId/end`, async ({ request, params }) => {
    const user = auth(request, 'USER')
    if (user instanceof Response) return user
    const session = db.sessions.find(
      (item) => item.id === params.sessionId && item.student_id === user.id,
    )
    const topic = session && db.topics.find((item) => item.id === session.topic_id)
    if (!session || !topic || !enrolled(user, topic)) return fail(404, 'Session not found')
    if (session.status !== 'IN_PROGRESS') return fail(409, 'Session already completed')
    const { action } = (await request.json()) as { action: string }
    if (action === 'abandon') {
      session.status = 'ABANDONED'
      return HttpResponse.json({ status: session.status })
    }
    if (!session.awaiting_end_consent || !session.goal_achieved)
      return fail(409, '尚未達成探究目標，仍可繼續或選擇退出。')
    session.awaiting_end_consent = false
    if (action === 'complete') {
      session.status = 'COMPLETED'
      session.completed_at = new Date().toISOString()
      session.completion_reason = 'goal_met_and_consented'
      reportFor(session)
    } else if (action === 'continue')
      session.messages.push({
        id: newId('msg'),
        role: 'assistant',
        content: '你選擇繼續思考。哪個反例最可能挑戰你目前的觀點？你會如何回應？',
      })
    else return fail(422, '不支援的操作')
    return HttpResponse.json({ status: session.status })
  }),
]
