/**
 * 假後端：用 MSW 在瀏覽器攔截 /api/v1/... 的請求，回傳假資料。
 * 前端程式完全不用改，後端做好後把 VITE_USE_MOCK 關掉就會打真的 API。
 *
 * 路徑和回傳格式照 docs/API功能規格.md；後端已經做好的部分照 backend/app/schemas。
 * 錯誤訊息用後端的英文原文，畫面上會由 lib/utils.ts 翻成中文。
 */
import { delay, http, HttpResponse } from 'msw'
import {
  aiOpening,
  db,
  syncDbFromStorage,
  DEMO_PASSWORD,
  newId,
  newInviteCode,
  type DbRole,
  type DbSession,
  type DbTopic,
  type DbUser,
} from './db'
import { scenarios, type ApiGroup } from './scenarios'
import { teachingAccess, teachingDenial } from './teachingAccess'
import { teacherAiHandlers, recordDemoUsage } from './teacherAiHandlers'
import { taHandlers } from './taHandlers'
import { defaultSetup, inquiryHandlers, reportFor } from './inquiryHandlers'

const BASE = '*/api/v1'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'
interface Info {
  request: Request
  params: Record<string, string | undefined>
  /** 情境設成「空資料」時為 true（只有 GET） */
  empty: boolean
}

// ---------- 共用小工具 ----------

function fail(status: number, detail: unknown) {
  return HttpResponse.json({ detail }, { status })
}

function validationError(field: string, msg: string) {
  return fail(422, [{ loc: ['body', field], msg, type: 'value_error' }])
}

const noContent = () => new HttpResponse(null, { status: 204 })

async function body<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>
  } catch {
    return {}
  }
}

function tokenFor(user: DbUser) {
  return `mock-token.${user.id}`
}

function userFromRequest(request: Request): DbUser | undefined {
  syncDbFromStorage()
  const header = request.headers.get('Authorization') ?? ''
  const id = header.replace(/^Bearer\s+mock-token\./, '')
  return db.users.find((u) => u.id === id)
}

const PASSWORD_CHANGE_EXEMPT = ['/users/me', '/auth/password', '/auth/logout']

/** 檢查登入與角色；回傳錯誤 Response 或使用者 */
function authorize(request: Request, roles?: DbRole[]): DbUser | Response {
  const user = userFromRequest(request)
  if (!user) return fail(401, 'Not authenticated or token expired')
  const path = new URL(request.url).pathname
  if (user.must_change_password && !PASSWORD_CHANGE_EXEMPT.some((p) => path.endsWith(p))) {
    return fail(403, 'Password change required')
  }
  if (roles?.includes('TEACHER') && user.role === 'USER') {
    const error = teachingDenial(request, user)
    return error ?? user
  }
  if (roles && !roles.includes(user.role)) {
    if (roles.includes('SUPERADMIN')) return fail(403, 'Admin privileges required')
    if (roles.includes('TEACHER')) return fail(403, 'Teacher privileges required')
    return fail(403, 'Student privileges required')
  }
  return user
}

function route(
  group: ApiGroup | null,
  method: Method,
  path: string,
  resolver: (info: Info) => unknown,
) {
  return http[method](`${BASE}${path}`, async (info) => {
    const mode = group ? scenarios.groups[group] : 'normal'
    await delay(scenarios.latency)
    if (mode === 'pending') await delay('infinite')
    if (mode === 'slow') await delay(3000)
    if (mode === 'error') return fail(500, 'Internal Server Error')
    const params = info.params as Info['params']
    const empty = mode === 'empty' && method === 'get'
    return (await resolver({ request: info.request, params, empty })) as Response
  })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 10; i += 1) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

function profile(user: DbUser) {
  return {
    account: user.account,
    name: user.name,
    role: user.role,
    preferred_language: 'zh-TW',
    must_change_password: user.must_change_password,
    has_ta_assignments: db.enrollments.some(
      (member) =>
        member.student_id === user.id &&
        member.role === 'TA' &&
        db.courses.some((course) => course.id === member.course_id),
    ),
  }
}

// ---------- 課程、題目的查詢 ----------

const teacherCourse = (teacher: DbUser, courseId: string) =>
  db.courses.find((c) => c.id === courseId && teachingAccess(teacher, courseId))

const isEnrolled = (studentId: string, courseId: string) =>
  db.enrollments.some(
    (e) => e.student_id === studentId && e.course_id === courseId && e.role !== 'TA',
  )

const studentsOf = (courseId: string) =>
  db.enrollments.filter((e) => e.course_id === courseId && e.role !== 'TA')

const completedSessions = (topicId: string) =>
  db.sessions.filter(
    (s) =>
      s.topic_id === topicId &&
      s.status === 'COMPLETED' &&
      !db.enrollments.some(
        (member) =>
          member.student_id === s.student_id &&
          member.role === 'TA' &&
          db.topics.some((topic) => topic.id === topicId && topic.course_id === member.course_id),
      ),
  )

function teacherTopic(teacher: DbUser, topicId: string) {
  const topic = db.topics.find((t) => t.id === topicId)
  if (!topic || !teacherCourse(teacher, topic.course_id)) return undefined
  return topic
}

function deleteTopicCascade(topicId: string) {
  db.sessions = db.sessions.filter((s) => s.topic_id !== topicId)
  db.conclusions = db.conclusions.filter((k) => k.topic_id !== topicId)
  db.topics = db.topics.filter((t) => t.id !== topicId)
}

function displayName(session: DbSession, viewerId: string) {
  const student = db.users.find((u) => u.id === session.student_id)
  if (session.is_anonymous && session.student_id !== viewerId) return '匿名同學'
  return student?.name ?? '未知學生'
}

function conclusionStats(topicId: string, viewerId: string, showAll: boolean) {
  const done = completedSessions(topicId)
  return db.conclusions
    .filter((k) => k.topic_id === topicId)
    .map((k) => {
      const members = done.filter((s) => s.conclusion_id === k.id)
      return {
        conclusion_id: k.id,
        title: k.title,
        description: k.description || null,
        count: members.length,
        percentage: done.length ? Math.round((members.length / done.length) * 100) : 0,
        students: members.map((s) => ({
          student_id: s.student_id,
          // 老師看得到真實姓名（匿名只影響學生端的統計圖）
          display_name: showAll
            ? (db.users.find((u) => u.id === s.student_id)?.name ?? '')
            : displayName(s, viewerId),
        })),
      }
    })
}

// ---------- 對話 ----------

const FOLLOW_UPS = [
  (s: string) => `你提到「${s}」，為什麼你會這樣認為？背後的理由是什麼？`,
  (s: string) => `如果有人不同意「${s}」，他最可能怎麼反駁你？`,
  () => '有沒有一個例子，會讓你的想法不成立？',
  () => '你剛剛說的這些理由裡，哪一個最重要？如果只能留一個呢？',
  (s: string) => `「${s}」這句話裡，你覺得最關鍵的詞是哪一個？它是什麼意思？`,
  () => '如果情況反過來，換成是你自己，你的答案會改變嗎？',
]

function snippet(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 18 ? `${clean.slice(0, 18)}…` : clean
}

function userRounds(session: DbSession) {
  return session.messages.filter((m) => m.role === 'user').length
}

function topicOf(session: DbSession): DbTopic | undefined {
  return db.topics.find((t) => t.id === session.topic_id)
}

/** 結束對話並自動歸類到一個結論（Demo 用：隨機挑一個） */
export function completeSession(session: DbSession) {
  const options = db.conclusions.filter((k) => k.topic_id === session.topic_id)
  const firstAnswer = session.messages.find((m) => m.role === 'user')?.content ?? ''
  session.status = 'COMPLETED'
  session.conclusion_id = options.length
    ? (options[Math.floor(Math.random() * options.length)]?.id ?? null)
    : null
  session.summary = firstAnswer ? snippet(firstAnswer) : '（沒有作答內容）'
}

function sessionMessages(session: DbSession) {
  const topic = topicOf(session)
  const max = session.setup_snapshot?.max_turns ?? topic?.max_rounds ?? 5
  return {
    session_id: session.id,
    topic_id: session.topic_id,
    status: session.status,
    max_rounds: max,
    remaining_rounds: Math.max(0, max - userRounds(session)),
    awaiting_end_consent: session.awaiting_end_consent ?? false,
    goal_achieved: session.goal_achieved ?? false,
    completion_reason: session.completion_reason,
    messages: session.messages.map((m) => ({
      message_id: m.id,
      role: m.role,
      content: m.content,
    })),
  }
}

const SAMPLE_TRANSCRIPTS = [
  '我覺得這要看情況，不能一概而論。',
  '因為每個人的感受不一樣，所以答案也會不同。',
  '我想先聽聽看不同的意見再決定。',
]

// ---------- 所有 API ----------

export const handlers = [
  ...inquiryHandlers,
  ...taHandlers,
  ...teacherAiHandlers,
  // ===== 登入、註冊、帳號 =====
  route('auth', 'post', '/auth/register', async ({ request }) => {
    const data = await body<{ account: string; password: string; name: string }>(request)
    const account = (data.account ?? '').trim()
    if (!account) return validationError('account', 'Field required')
    if ((data.password ?? '').length < 8) return validationError('password', 'Too short')
    if (account === 'admin') return fail(400, 'Account name reserved')
    if (db.users.some((u) => u.account === account)) return fail(400, 'Account already exists')
    const user: DbUser = {
      id: newId('u'),
      account,
      name: (data.name ?? account).trim() || account,
      password: data.password ?? '',
      role: 'USER',
      must_change_password: false,
      created_at: new Date().toISOString(),
    }
    db.users.push(user)
    return HttpResponse.json(
      {
        account: user.account,
        name: user.name,
        role: user.role,
        message: 'Registration successful',
      },
      { status: 201 },
    )
  }),

  route('auth', 'post', '/auth/login', async ({ request }) => {
    const data = await body<{ account: string; password: string }>(request)
    const user = db.users.find((u) => u.account === (data.account ?? '').trim())
    if (!user || user.password !== data.password) return fail(401, 'Invalid account or password')
    return HttpResponse.json(profile(user), {
      headers: {
        Authorization: `Bearer ${tokenFor(user)}`,
        'Access-Control-Expose-Headers': 'Authorization',
      },
    })
  }),

  route('auth', 'post', '/auth/logout', () => HttpResponse.json({ ok: true })),

  route('auth', 'get', '/users/me', ({ request }) => {
    const user = authorize(request)
    if (user instanceof Response) return user
    return HttpResponse.json(profile(user))
  }),

  route('auth', 'put', '/auth/password', async ({ request }) => {
    const user = authorize(request)
    if (user instanceof Response) return user
    if (!user.must_change_password) return fail(403, '僅初次登入可設定密碼。')
    const data = await body<{ old_password: string; new_password: string }>(request)
    if (data.old_password !== user.password) return fail(400, 'Current password is incorrect')
    if ((data.new_password ?? '').length < 8) return validationError('new_password', 'Too short')
    if (data.new_password === user.password) {
      return fail(400, 'New password must be different from the current password')
    }
    user.password = data.new_password ?? ''
    user.must_change_password = false
    return HttpResponse.json({ message: 'Password updated' })
  }),

  // ===== 管理員 =====
  route('admin', 'get', '/admin/teachers', ({ request, empty }) => {
    const user = authorize(request, ['SUPERADMIN'])
    if (user instanceof Response) return user
    if (empty) return HttpResponse.json([])
    return HttpResponse.json(
      db.users
        .filter((u) => u.role === 'TEACHER')
        .map((u) => ({ id: u.id, account: u.account, name: u.name, created_at: u.created_at })),
    )
  }),

  route('admin', 'post', '/admin/teachers', async ({ request }) => {
    const user = authorize(request, ['SUPERADMIN'])
    if (user instanceof Response) return user
    const data = await body<{ account: string; name: string }>(request)
    const account = (data.account ?? '').trim()
    const name = (data.name ?? '').trim()
    if (!account) return validationError('account', 'Field required')
    if (!name) return validationError('name', 'Field required')
    if (account === 'admin') return fail(400, 'Account name reserved')
    if (db.users.some((u) => u.account === account)) return fail(400, 'Account already exists')
    const password = generatePassword()
    db.users.push({
      id: newId('u'),
      account,
      name,
      password,
      role: 'TEACHER',
      must_change_password: true,
      created_at: new Date().toISOString(),
    })
    return HttpResponse.json(
      { account, name, role: 'TEACHER', password, message: 'Teacher created' },
      { status: 201 },
    )
  }),

  route('admin', 'delete', '/admin/teachers/:teacherId', ({ request, params }) => {
    const user = authorize(request, ['SUPERADMIN'])
    if (user instanceof Response) return user
    const teacher = db.users.find((u) => u.id === params.teacherId)
    if (teacher?.role === 'SUPERADMIN') return fail(400, 'Cannot delete elevated admin account')
    if (!teacher || teacher.role !== 'TEACHER') return fail(404, 'Teacher not found')
    db.users = db.users.filter((u) => u.id !== teacher.id)
    return noContent()
  }),

  route('admin', 'post', '/admin/teachers/:teacherId/reset-password', ({ request, params }) => {
    const user = authorize(request, ['SUPERADMIN'])
    if (user instanceof Response) return user
    const teacher = db.users.find((u) => u.id === params.teacherId && u.role === 'TEACHER')
    if (!teacher) return fail(404, 'Teacher not found')
    teacher.password = generatePassword()
    teacher.must_change_password = true
    return HttpResponse.json({
      account: teacher.account,
      name: teacher.name,
      password: teacher.password,
    })
  }),

  // ===== 老師：課程 =====
  route('teacherCourses', 'get', '/teacher/courses', ({ request, empty }) => {
    const user = authorize(request, ['TEACHER'])
    if (user instanceof Response) return user
    if (empty) return HttpResponse.json([])
    return HttpResponse.json(
      db.courses
        .filter((c) => teachingAccess(user, c.id))
        .map((c) => ({
          course_id: c.id,
          name: c.name,
          description: c.description || null,
          invite_code: teachingAccess(user, c.id)?.permissions.includes('view_members')
            ? c.invite_code
            : '',
          student_count: studentsOf(c.id).length,
          topic_count: db.topics.filter((t) => t.course_id === c.id).length,
        })),
    )
  }),

  route('teacherCourses', 'post', '/teacher/courses', async ({ request }) => {
    const user = authorize(request, ['TEACHER'])
    if (user instanceof Response) return user
    const data = await body<{ name: string; description: string }>(request)
    const name = (data.name ?? '').trim()
    if (!name) return validationError('name', 'Field required')
    const course = {
      id: newId('c'),
      name,
      description: (data.description ?? '').trim(),
      invite_code: newInviteCode(),
      teacher_id: user.id,
      created_at: new Date().toISOString(),
    }
    db.courses.push(course)
    return HttpResponse.json(
      {
        course_id: course.id,
        name: course.name,
        description: course.description || null,
        invite_code: course.invite_code,
        message: 'Course created',
      },
      { status: 201 },
    )
  }),

  route('teacherCourses', 'put', '/teacher/courses/:courseId', async ({ request, params }) => {
    const user = authorize(request, ['TEACHER'])
    if (user instanceof Response) return user
    const course = teacherCourse(user, params.courseId ?? '')
    if (!course) return fail(404, 'Course not found')
    const data = await body<{ name: string; description: string }>(request)
    const name = (data.name ?? '').trim()
    if (!name) return validationError('name', 'Field required')
    course.name = name
    course.description = (data.description ?? '').trim()
    return HttpResponse.json({ course_id: course.id, name, message: 'Course updated' })
  }),

  route('teacherCourses', 'delete', '/teacher/courses/:courseId', ({ request, params }) => {
    const user = authorize(request, ['TEACHER'])
    if (user instanceof Response) return user
    const course = teacherCourse(user, params.courseId ?? '')
    if (!course) return fail(404, 'Course not found')
    db.topics.filter((t) => t.course_id === course.id).forEach((t) => deleteTopicCascade(t.id))
    db.enrollments = db.enrollments.filter((e) => e.course_id !== course.id)
    db.courses = db.courses.filter((c) => c.id !== course.id)
    return HttpResponse.json({ message: 'Course deleted' })
  }),

  // ===== 老師：題目 =====
  route(
    'teacherTopics',
    'get',
    '/teacher/courses/:courseId/topics',
    ({ request, params, empty }) => {
      const user = authorize(request, ['TEACHER'])
      if (user instanceof Response) return user
      const course = teacherCourse(user, params.courseId ?? '')
      if (!course) return fail(404, 'Course not found')
      const topics = empty ? [] : db.topics.filter((t) => t.course_id === course.id)
      return HttpResponse.json({
        course_id: course.id,
        name: course.name,
        invite_code: teachingAccess(user, course.id)?.permissions.includes('view_members')
          ? course.invite_code
          : '',
        access: teachingAccess(user, course.id),
        default_model_id: db.ai_settings?.[course.teacher_id]?.default_model_id ?? 'gpt-6-luna',
        student_count: studentsOf(course.id).length,
        topics: topics.map((t) => ({
          topic_id: t.id,
          title: t.title,
          description: t.description || null,
          age_range: t.age_range,
          max_rounds: t.max_rounds,
          conclusion_count: db.conclusions.filter((k) => k.topic_id === t.id).length,
          answered_count: completedSessions(t.id).length,
          publication_status: t.publication_status ?? 'published',
          setup_version: t.setup_version ?? 1,
        })),
      })
    },
  ),

  route('teacherTopics', 'post', '/teacher/topics', async ({ request }) => {
    const user = authorize(request, ['TEACHER'])
    if (user instanceof Response) return user
    const data = await body<{
      course_id: string
      title: string
      description: string
      age_range: string
      max_rounds: number
    }>(request)
    const course = teacherCourse(user, data.course_id ?? '')
    if (!course) return fail(404, 'Course not found')
    const title = (data.title ?? '').trim()
    if (!title) return validationError('title', 'Field required')
    const topic: DbTopic = {
      id: newId('t'),
      course_id: course.id,
      title,
      description: (data.description ?? '').trim(),
      age_range: data.age_range ?? '13-15',
      max_rounds: Number(data.max_rounds) || 5,
      created_at: new Date().toISOString(),
    }
    db.topics.push(topic)
    return HttpResponse.json(
      {
        topic_id: topic.id,
        course_id: course.id,
        title,
        description: topic.description,
        message: 'Topic created',
      },
      { status: 201 },
    )
  }),

  route('teacherTopics', 'put', '/teacher/topics/:topicId', async ({ request, params }) => {
    const user = authorize(request, ['TEACHER'])
    if (user instanceof Response) return user
    const topic = teacherTopic(user, params.topicId ?? '')
    if (!topic) return fail(404, 'Topic not found')
    const data = await body<{
      title: string
      description: string
      age_range: string
      max_rounds: number
    }>(request)
    if ((topic.publication_status ?? 'published') !== 'draft')
      return fail(409, '活動已發布，無法再修改。')
    const title = (data.title ?? '').trim()
    if (!title) return validationError('title', 'Field required')
    topic.title = title
    topic.description = (data.description ?? topic.description).trim()
    topic.age_range = data.age_range ?? topic.age_range
    topic.max_rounds = Number(data.max_rounds) || topic.max_rounds
    return HttpResponse.json({
      topic_id: topic.id,
      course_id: topic.course_id,
      title,
      message: 'Topic updated',
    })
  }),

  route('teacherTopics', 'delete', '/teacher/topics/:topicId', ({ request, params }) => {
    const user = authorize(request, ['TEACHER'])
    if (user instanceof Response) return user
    const topic = teacherTopic(user, params.topicId ?? '')
    if (!topic) return fail(404, 'Topic not found')
    deleteTopicCascade(topic.id)
    return HttpResponse.json({ message: 'Topic deleted' })
  }),

  // ===== 老師：結果、學生 =====
  route(
    'teacherResults',
    'get',
    '/teacher/courses/:courseId/students',
    ({ request, params, empty }) => {
      const user = authorize(request, ['TEACHER'])
      if (user instanceof Response) return user
      const course = teacherCourse(user, params.courseId ?? '')
      if (!course) return fail(404, 'Course not found')
      if (empty) return HttpResponse.json([])
      return HttpResponse.json(
        studentsOf(course.id).map((e) => {
          const student = db.users.find((u) => u.id === e.student_id)
          return {
            student_id: e.student_id,
            account: student?.account ?? '',
            name: student?.name ?? '',
            joined_at: e.joined_at,
          }
        }),
      )
    },
  ),

  route(
    'teacherResults',
    'delete',
    '/teacher/courses/:courseId/students/:studentId',
    ({ request, params }) => {
      const user = authorize(request, ['TEACHER'])
      if (user instanceof Response) return user
      const course = teacherCourse(user, params.courseId ?? '')
      if (!course || !isEnrolled(params.studentId ?? '', course.id)) {
        return fail(404, 'Student not found')
      }
      db.enrollments = db.enrollments.filter(
        (e) => !(e.course_id === course.id && e.student_id === params.studentId),
      )
      return HttpResponse.json({ message: 'Student removed' })
    },
  ),

  route(
    'teacherResults',
    'get',
    '/teacher/topics/:topicId/conclusions',
    ({ request, params, empty }) => {
      const user = authorize(request, ['TEACHER'])
      if (user instanceof Response) return user
      const topic = teacherTopic(user, params.topicId ?? '')
      if (!topic) return fail(404, 'Topic not found')
      return HttpResponse.json({
        topic_id: topic.id,
        total_answered: empty ? 0 : completedSessions(topic.id).length,
        conclusions: empty ? [] : conclusionStats(topic.id, user.id, true),
      })
    },
  ),

  route(
    'teacherResults',
    'post',
    '/teacher/topics/:topicId/conclusions',
    async ({ request, params }) => {
      const user = authorize(request, ['TEACHER'])
      if (user instanceof Response) return user
      const topic = teacherTopic(user, params.topicId ?? '')
      if (!topic) return fail(404, 'Topic not found')
      const data = await body<{ title: string; description: string }>(request)
      const title = (data.title ?? '').trim()
      if (!title) return validationError('title', 'Field required')
      const conclusion = {
        id: newId('k'),
        topic_id: topic.id,
        title,
        description: (data.description ?? '').trim(),
      }
      db.conclusions.push(conclusion)
      return HttpResponse.json(
        {
          conclusion_id: conclusion.id,
          topic_id: topic.id,
          title,
          description: conclusion.description,
          message: 'Conclusion created',
        },
        { status: 201 },
      )
    },
  ),

  route(
    'teacherResults',
    'delete',
    '/teacher/topics/:topicId/conclusions/:conclusionId',
    ({ request, params }) => {
      const user = authorize(request, ['TEACHER'])
      if (user instanceof Response) return user
      const topic = teacherTopic(user, params.topicId ?? '')
      if (!topic) return fail(404, 'Topic not found')
      const exists = db.conclusions.some(
        (k) => k.id === params.conclusionId && k.topic_id === topic.id,
      )
      if (!exists) return fail(404, 'Conclusion not found')
      db.conclusions = db.conclusions.filter((k) => k.id !== params.conclusionId)
      db.sessions.forEach((s) => {
        if (s.conclusion_id === params.conclusionId) s.conclusion_id = null
      })
      return HttpResponse.json({ message: 'Conclusion deleted' })
    },
  ),

  route(
    'teacherResults',
    'get',
    '/teacher/topics/:topicId/analytics',
    ({ request, params, empty }) => {
      const user = authorize(request, ['TEACHER'])
      if (user instanceof Response) return user
      const topic = teacherTopic(user, params.topicId ?? '')
      if (!topic) return fail(404, 'Topic not found')
      const done = empty ? [] : completedSessions(topic.id)
      return HttpResponse.json({
        total_answered: done.length,
        arguments: done.map((s) => {
          const conclusion = db.conclusions.find((k) => k.id === s.conclusion_id)
          return {
            student_id: s.student_id,
            display_name: db.users.find((u) => u.id === s.student_id)?.name ?? '',
            is_anonymous: s.is_anonymous,
            conclusion_id: conclusion?.id ?? null,
            conclusion_title: conclusion?.title ?? null,
            summary: s.summary,
          }
        }),
      })
    },
  ),

  // ===== 學生：課程 =====
  route('studentCourses', 'get', '/student/courses', ({ request, empty }) => {
    const user = authorize(request, ['USER'])
    if (user instanceof Response) return user
    if (empty) return HttpResponse.json([])
    return HttpResponse.json(
      db.enrollments
        .filter((e) => e.student_id === user.id && e.role !== 'TA')
        .map((e) => db.courses.find((c) => c.id === e.course_id))
        .filter((c) => !!c)
        .map((c) => ({
          course_id: c.id,
          name: c.name,
          invite_code: c.invite_code,
          teacher_name: db.users.find((u) => u.id === c.teacher_id)?.name ?? '',
          active_topic_count: db.topics.filter((t) => t.course_id === c.id).length,
        })),
    )
  }),

  route('studentCourses', 'post', '/student/courses/join', async ({ request }) => {
    const user = authorize(request, ['USER'])
    if (user instanceof Response) return user
    const data = await body<{ invite_code: string }>(request)
    const code = (data.invite_code ?? '').trim().toUpperCase()
    if (!/^[A-Z0-9]{4,12}$/.test(code)) return validationError('invite_code', 'Invalid format')
    const course = db.courses.find((c) => c.invite_code.toUpperCase() === code)
    if (!course) return fail(404, 'Invite code not found')
    if (
      db.enrollments.some(
        (member) => member.student_id === user.id && member.course_id === course.id,
      )
    )
      return fail(409, 'Already enrolled')
    db.enrollments.push({
      course_id: course.id,
      student_id: user.id,
      joined_at: new Date().toISOString(),
    })
    return HttpResponse.json({
      course_id: course.id,
      name: course.name,
      invite_code: course.invite_code,
      message: 'Joined course',
    })
  }),

  route('studentCourses', 'delete', '/student/courses/:courseId', ({ request, params }) => {
    const user = authorize(request, ['USER'])
    if (user instanceof Response) return user
    if (!isEnrolled(user.id, params.courseId ?? '')) return fail(404, 'Course not found')
    db.enrollments = db.enrollments.filter(
      (e) => !(e.course_id === params.courseId && e.student_id === user.id),
    )
    return HttpResponse.json({ message: 'Left course' })
  }),

  // ===== 學生：題目 =====
  route(
    'studentTopics',
    'get',
    '/student/courses/:courseId/topics',
    ({ request, params, empty }) => {
      const user = authorize(request, ['USER'])
      if (user instanceof Response) return user
      const course = db.courses.find((c) => c.id === params.courseId)
      if (!course) return fail(404, 'Course not found')
      if (!isEnrolled(user.id, course.id)) return fail(403, 'Course membership required')
      const topics = empty
        ? []
        : db.topics.filter((t) => t.course_id === course.id && t.publication_status !== 'draft')
      return HttpResponse.json({
        course_id: course.id,
        name: course.name,
        invite_code: teachingAccess(user, course.id)?.permissions.includes('view_members')
          ? course.invite_code
          : '',
        access: teachingAccess(user, course.id),
        default_model_id: db.ai_settings?.[course.teacher_id]?.default_model_id ?? 'gpt-6-luna',
        student_count: studentsOf(course.id).length,
        topics: topics.map((t) => {
          const session = db.sessions
            .filter((s) => s.topic_id === t.id && s.student_id === user.id)
            .slice(-1)[0]
          return {
            topic_id: t.id,
            title: t.title,
            description: t.description || null,
            status: session?.status ?? 'NOT_STARTED',
            session_id: session?.id ?? null,
            age_range: t.age_range,
            max_rounds: t.max_rounds,
            content_language: t.source_language ?? 'zh-TW',
          }
        }),
      })
    },
  ),

  route('studentTopics', 'get', '/student/topics/:topicId/explanation', ({ request, params }) => {
    const user = authorize(request, ['USER'])
    if (user instanceof Response) return user
    const topic = db.topics.find((t) => t.id === params.topicId)
    if (!topic) return fail(404, 'Topic not found')
    if (!isEnrolled(user.id, topic.course_id) || topic.publication_status === 'draft')
      return fail(404, 'Topic not found')
    return HttpResponse.json({
      title: topic.title,
      background: topic.description || '這個問題沒有標準答案，重點是說出你的理由。',
      key_terms: ['理由', '例子', '反例'],
    })
  }),

  // ===== 學生：對話 =====
  route('chat', 'post', '/student/topics/:topicId/sessions', ({ request, params }) => {
    const user = authorize(request, ['USER'])
    if (user instanceof Response) return user
    const topic = db.topics.find((t) => t.id === params.topicId)
    if (!topic) return fail(404, 'Topic not found')
    if (!isEnrolled(user.id, topic.course_id)) return fail(403, 'Course membership required')
    if (topic.publication_status === 'draft') return fail(404, 'Topic not found')
    let session = db.sessions.find(
      (s) => s.topic_id === topic.id && s.student_id === user.id && s.status !== 'ABANDONED',
    )
    if (!session) {
      session = {
        id: newId('sess'),
        topic_id: topic.id,
        student_id: user.id,
        status: 'IN_PROGRESS',
        is_anonymous: true,
        conclusion_id: null,
        summary: '',
        setup_snapshot: JSON.parse(JSON.stringify(defaultSetup(topic))),
        model_id: topic.model_id ?? 'gpt-6-luna',
        messages: [
          {
            id: newId('msg'),
            role: 'assistant',
            content: topic.setup?.opening_message ?? aiOpening(topic),
          },
        ],
      }
      db.sessions.push(session)
    }
    return HttpResponse.json({ session_id: session.id, topic_id: topic.id })
  }),

  route('chat', 'get', '/student/sessions/:sessionId/messages', ({ request, params }) => {
    const user = authorize(request, ['USER'])
    if (user instanceof Response) return user
    const session = db.sessions.find((s) => s.id === params.sessionId)
    if (!session) return fail(404, 'Session not found')
    if (session.student_id !== user.id) return fail(403, 'Not the session owner')
    const topic = topicOf(session)
    if (!topic || !isEnrolled(user.id, topic.course_id))
      return fail(403, 'Course membership required')
    return HttpResponse.json(sessionMessages(session))
  }),

  route(
    'chat',
    'post',
    '/student/sessions/:sessionId/messages/stream',
    async ({ request, params }) => {
      const user = authorize(request, ['USER'])
      if (user instanceof Response) return user
      const session = db.sessions.find((s) => s.id === params.sessionId)
      if (!session) return fail(404, 'Session not found')
      if (session.student_id !== user.id) return fail(403, 'Not the session owner')
      const topic = topicOf(session)
      if (!topic || !isEnrolled(user.id, topic.course_id))
        return fail(403, 'Course membership required')
      const data = await body<{ content: string; request_id: string }>(request)
      const requestId = data.request_id
      if (requestId && session.processed_requests?.[requestId]) {
        return new HttpResponse(
          `event: done\ndata: ${JSON.stringify(session.processed_requests[requestId])}\n\n`,
          { headers: { 'Content-Type': 'text/event-stream' } },
        )
      }
      if (session.status !== 'IN_PROGRESS') return fail(409, 'Session already completed')
      if (session.awaiting_end_consent) return fail(409, '請先選擇結束或繼續探究。')
      const content = (data.content ?? '').trim()
      if (!content) return validationError('content', 'Field required')

      session.messages.push({ id: newId('msg'), role: 'user', content })
      const max = session.setup_snapshot?.max_turns ?? topic.max_rounds ?? 5
      if (userRounds(session) > max) {
        session.messages.pop()
        return fail(409, 'Session already completed')
      }
      const remaining = Math.max(0, max - userRounds(session))
      const isLast = remaining === 0
      const pick = FOLLOW_UPS[(userRounds(session) - 1) % FOLLOW_UPS.length] ?? FOLLOW_UPS[0]
      // Deterministic demo progress, not an AI evaluation or a grading rule.
      session.goal_achieved =
        userRounds(session) >= 3 &&
        session.messages.filter(
          (m) => m.role === 'user' && m.content !== '略過這一題' && m.content.length >= 10,
        ).length >= 3
      session.awaiting_end_consent = !isLast && session.goal_achieved
      const reply = isLast || session.awaiting_end_consent ? '' : (pick?.(snippet(content)) ?? '')
      const messageId = reply ? newId('msg') : ''
      if (reply) session.messages.push({ id: messageId, role: 'assistant', content: reply })
      if (isLast) {
        session.status = 'COMPLETED'
        session.completed_at = new Date().toISOString()
        session.completion_reason = 'max_turns'
        reportFor(session)
      }
      const done = {
        message_id: messageId,
        is_guiding_question: !isLast && !session.awaiting_end_consent,
        remaining_rounds: remaining,
        is_completed: isLast,
        awaiting_end_consent: session.awaiting_end_consent,
      }
      if (requestId) {
        session.processed_requests ??= {}
        session.processed_requests[requestId] = done
      }

      recordDemoUsage(topic.course_id, 'dialogue', session.model_id)
      const encoder = new TextEncoder()
      const speed = scenarios.typingSpeed
      const stream = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < reply.length; i += 2) {
            controller.enqueue(encoder.encode(`data: ${reply.slice(i, i + 2)}\n\n`))
            await sleep(speed * 2)
          }
          controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify(done)}\n\n`))
          controller.close()
        },
      })
      return new HttpResponse(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      })
    },
  ),

  route('chat', 'post', '/student/audio/transcribe', async ({ request }) => {
    const user = authorize(request, ['USER'])
    if (user instanceof Response) return user
    await delay(800)
    const text = SAMPLE_TRANSCRIPTS[Math.floor(Math.random() * SAMPLE_TRANSCRIPTS.length)]
    return HttpResponse.json({ text })
  }),

  // ===== 學生：結果 =====
  route('studentResults', 'get', '/student/sessions/:sessionId/result', ({ request, params }) => {
    const user = authorize(request, ['USER'])
    if (user instanceof Response) return user
    const session = db.sessions.find((s) => s.id === params.sessionId)
    if (!session) return fail(404, 'Session not found')
    if (session.student_id !== user.id) return fail(403, 'Not the session owner')
    if (session.status !== 'COMPLETED') return fail(409, 'Session not completed')
    const conclusion = db.conclusions.find((k) => k.id === session.conclusion_id)
    return HttpResponse.json({
      session_id: session.id,
      topic_id: session.topic_id,
      conclusion_id: conclusion?.id ?? null,
      conclusion_title: conclusion?.title ?? null,
      is_anonymous: session.is_anonymous,
    })
  }),

  route(
    'studentResults',
    'patch',
    '/student/sessions/:sessionId/privacy',
    async ({ request, params }) => {
      const user = authorize(request, ['USER'])
      if (user instanceof Response) return user
      const session = db.sessions.find((s) => s.id === params.sessionId)
      if (!session) return fail(404, 'Session not found')
      if (session.student_id !== user.id) return fail(403, 'Not the session owner')
      const data = await body<{ is_anonymous: boolean }>(request)
      if (typeof data.is_anonymous !== 'boolean') return validationError('is_anonymous', 'Invalid')
      session.is_anonymous = data.is_anonymous
      return HttpResponse.json({
        session_id: session.id,
        is_anonymous: session.is_anonymous,
        message: 'Privacy updated',
      })
    },
  ),

  route(
    'studentResults',
    'get',
    '/student/topics/:topicId/analytics',
    ({ request, params, empty }) => {
      const user = authorize(request, ['USER'])
      if (user instanceof Response) return user
      const topic = db.topics.find((t) => t.id === params.topicId)
      if (!topic || !isEnrolled(user.id, topic.course_id)) return fail(404, 'Topic not found')
      if (!topic.summary_published)
        return HttpResponse.json({ topic_id: topic.id, total_answered: 0, conclusions: [] })
      return HttpResponse.json({
        topic_id: topic.id,
        total_answered: empty ? 0 : topic.summary_published.report_count,
        conclusions: empty
          ? []
          : topic.summary_published.groups.map((group) => ({
              conclusion_id: group.group_id,
              title: group.title,
              count: group.count,
              percentage: group.percentage,
              students: [],
            })),
      })
    },
  ),
]

export { DEMO_PASSWORD }
