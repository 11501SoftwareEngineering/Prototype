import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { addManyConclusions, finishTopicForClass } from '../actions'
import { handlers } from '../handlers'
import { resetDb } from '../db'
import { resetScenarios, scenarios } from '../scenarios'

const server = setupServer(...handlers)
const API = 'http://localhost:8000/api/v1'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  resetDb()
  resetScenarios()
  scenarios.latency = 0
  scenarios.typingSpeed = 0
})
afterEach(() => server.resetHandlers())

async function call(path: string, init: RequestInit & { token?: string } = {}) {
  const headers = new Headers(init.headers)
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  const res = await fetch(`${API}${path}`, { ...init, headers })
  const text = await res.text()
  return { res, data: text ? JSON.parse(text) : null }
}

async function login(account: string, password = 'password123') {
  const { res, data } = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account, password }),
  })
  return { res, data, token: (res.headers.get('Authorization') ?? '').replace('Bearer ', '') }
}

describe('假後端', () => {
  it('登入用後端的角色名稱，token 放在 Authorization header', async () => {
    const { res, data, token } = await login('s001')
    expect(res.status).toBe(200)
    expect(data).toMatchObject({ account: 's001', role: 'USER', must_change_password: false })
    expect(token).toMatch(/^mock-token\./)
    expect((await login('s001', 'wrong')).data.detail).toBe('Invalid account or password')
  })

  it('需要改密碼的老師，改完之前其他 API 會回 403', async () => {
    const { token } = await login('chen')
    const blocked = await call('/teacher/courses', { token })
    expect(blocked.res.status).toBe(403)
    expect(blocked.data.detail).toBe('Password change required')
    const changed = await call('/auth/password', {
      method: 'PUT',
      token,
      body: JSON.stringify({ old_password: 'password123', new_password: 'newpassword1' }),
    })
    expect(changed.res.status).toBe(200)
    expect((await call('/teacher/courses', { token })).res.status).toBe(200)
  })

  it('學生不能打老師的 API', async () => {
    const { token } = await login('s001')
    const { res, data } = await call('/teacher/courses', { token })
    expect(res.status).toBe(403)
    expect(data.detail).toBe('Teacher privileges required')
  })

  it('加入課程：代碼不存在、已經加入、成功', async () => {
    const { token } = await login('s001')
    const join = (code: string) =>
      call('/student/courses/join', {
        method: 'POST',
        token,
        body: JSON.stringify({ invite_code: code }),
      })
    expect((await join('NOPE99')).data.detail).toBe('Invite code not found')
    expect((await join('PHIL01')).data.detail).toBe('Already enrolled')
    const ok = await join('ethic3')
    expect(ok.res.status).toBe(200)
    expect(ok.data.name).toBe('倫理學入門')
    const { data: courses } = await call('/student/courses', { token })
    expect(courses).toHaveLength(3)
  })

  it('情境：空資料、錯誤只影響指定的 API 群組', async () => {
    const { token } = await login('s001')
    scenarios.groups.studentCourses = 'empty'
    expect((await call('/student/courses', { token })).data).toEqual([])
    scenarios.groups.studentCourses = 'error'
    const failed = await call('/student/courses', { token })
    expect(failed.res.status).toBe(500)
    expect((await call('/users/me', { token })).res.status).toBe(200)
  })

  it('對話串流：逐段回傳文字，最後一個事件帶剩餘回合數', async () => {
    const { token } = await login('s012')
    const { data: session } = await call('/student/topics/t-ai/sessions', {
      method: 'POST',
      token,
    })
    const res = await fetch(`${API}/student/sessions/${session.session_id}/messages/stream`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '我覺得可以' }),
    })
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
    const text = await res.text()
    expect(text).toContain('data: ')
    const done = JSON.parse(text.split('event: done\ndata: ')[1] ?? '{}')
    expect(done).toMatchObject({ remaining_rounds: 9, is_completed: false })
    const { data: history } = await call(`/student/sessions/${session.session_id}/messages`, {
      token,
    })
    expect(history.messages).toHaveLength(3)
  })

  it('未發布的舊分析不提供學生；教師仍可讀取授權歷史分析', async () => {
    const student = await login('s001')
    const { data: stats } = await call('/student/topics/t-ai/analytics', { token: student.token })
    const names = stats.conclusions.flatMap((k: { students: { display_name: string }[] }) =>
      k.students.map((s) => s.display_name),
    )
    expect(names).toEqual([])
    const teacher = await login('wang')
    const { data: teacherStats } = await call('/teacher/topics/t-lie/conclusions', {
      token: teacher.token,
    })
    const teacherNames = teacherStats.conclusions.flatMap(
      (k: { students: { display_name: string }[] }) => k.students.map((s) => s.display_name),
    )
    expect(teacherNames).not.toContain('匿名同學')
  })

  it('Debug「新增很多結論」：結論變多，而且每個結論都分到作答', async () => {
    finishTopicForClass('t-lie')
    expect(addManyConclusions('t-lie')).toContain('已新增 5 個結論')
    const { token } = await login('wang')
    const { data } = await call('/teacher/topics/t-lie/conclusions', { token })
    expect(data.conclusions).toHaveLength(8)
    expect(data.total_answered).toBe(12)
    expect(data.conclusions.every((k: { count: number }) => k.count > 0)).toBe(true)
  })
})

const settings = {
  age_band: '16-18',
  max_turns: 5,
  topic: '界線與選擇',
  core_question: '何時可以為了多數而犧牲少數？',
  inquiry_focus: '比較理由與反例',
  background_info: '這是虛構思想實驗',
  exclusions: '未指定',
  opening_message: '你會如何選擇？請說明一個理由。',
}
const post = (token: string, data: unknown) => ({
  token,
  method: 'POST',
  body: JSON.stringify(data),
})

describe('新版三階段流程', () => {
  it('善意的謊言直接提供完成報告與已發布的全班摘要', async () => {
    const teacher = await login('wang'),
      student = await login('s012')
    const reports = (await call('/teacher/topics/t-lie/reports', { token: teacher.token })).data
    expect(reports.reports).toHaveLength(12)
    expect(
      reports.reports.every((report: { reasons: unknown[] }) => report.reasons.length === 3),
    ).toBe(true)
    const summary = (await call('/teacher/topics/t-lie/summary', { token: teacher.token })).data
    expect(summary.draft).toMatchObject({
      status: 'published',
      report_count: 12,
      completed_count: 12,
      roster_count: 12,
      ungrouped_count: 2,
    })
    expect(summary.draft.groups).toHaveLength(3)
    expect(summary.draft.viewpoint_summary).toContain('2 位仍未確定立場')
    expect(summary.draft.viewpoint_timeline).toHaveLength(4)
    for (const point of summary.draft.viewpoint_timeline) {
      expect(point).not.toHaveProperty('answer')
      expect(point).not.toHaveProperty('question_message_id')
      expect(
        point.related_group_ids.every((id: string) =>
          summary.draft.groups.some((group: { group_id: string }) => group.group_id === id),
        ),
      ).toBe(true)
    }
    expect(summary.published).toEqual(summary.draft)
    expect(
      (
        await call('/student/topics/t-lie/summary', { token: student.token })
      ).data.summary.groups.every(
        (group: { report_ids: string[] }) => group.report_ids.length === 0,
      ),
    ).toBe(true)
    const topics = (await call('/teacher/courses/c-phil/topics', { token: teacher.token })).data
      .topics
    expect(topics.some((topic: { topic_id: string }) => topic.topic_id === 't-demo-c-phil')).toBe(
      false,
    )
  })

  it('觀點總結保留未確定立場，理由證據對應真實保存的學生回答', async () => {
    const student = await login('s011')
    const session = (await call('/student/topics/t-lie/sessions', post(student.token, {}))).data
      .session_id
    const report = (await call(`/student/sessions/${session}/report`, { token: student.token }))
      .data.report
    expect(report).toMatchObject({
      final_viewpoint: null,
      viewpoint_status: 'undetermined',
      evidence_status: 'partial',
      strongest_reason: null,
    })
    expect(report.viewpoint_summary).toContain('不能據此歸為支持或反對')
    expect(report.viewpoint_timeline).toHaveLength(5)
    expect(report.viewpoint_timeline[1].change_type).toBe('uncertain')
    expect(report.viewpoint_timeline[3].attribution).toBe('explicit')
    expect(report.viewpoint_timeline[0].before_summary).toBeNull()
    for (let index = 1; index < report.viewpoint_timeline.length; index++)
      expect(report.viewpoint_timeline[index].before_summary).toBe(
        report.viewpoint_timeline[index - 1].after_summary,
      )
    const history = (await call(`/student/sessions/${session}/messages`, { token: student.token }))
      .data.messages
    for (const reason of report.reasons) {
      expect(
        history.some(
          (message: { message_id: string; role: string; content: string }) =>
            message.message_id === reason.evidence.message_id &&
            message.role === 'user' &&
            message.content === reason.evidence.quote,
        ),
      ).toBe(true)
    }
  })

  it('範本及已儲存設定可依回饋重產，也可只更新開場而不改動已發布設定', async () => {
    const teacher = await login('wang'),
      outsider = await login('lin')
    const payload = {
      setup: settings,
      feedback: '請加入貼近學生生活的例子',
      source_language: 'zh-TW',
      model_id: 'gpt-6-luna',
    }
    const path = '/teacher/courses/c-phil'
    expect((await call(`${path}/opening-message`, post(outsider.token, payload))).res.status).toBe(
      404,
    )
    const revised = (await call(`${path}/setup-revisions`, post(teacher.token, payload))).data
    expect(revised.question_count).toBe(0)
    expect(revised.setup.inquiry_focus).toContain(payload.feedback)
    expect(revised.setup.opening_message).not.toBe(settings.opening_message)
    const opening = (
      await call(
        `${path}/opening-message`,
        post(teacher.token, { ...payload, setup: revised.setup }),
      )
    ).data
    expect(opening.opening_message).not.toBe(revised.setup.opening_message)
    expect(Object.keys(opening)).toEqual(['opening_message'])
    const again = (
      await call(
        `${path}/setup-jobs/${revised.job_id}/refine`,
        post(teacher.token, { setup: revised.setup, feedback: '再加一個反例' }),
      )
    ).data
    expect(again.question_count).toBe(0)
    expect(
      (await call('/teacher/topics/t-lie/setup', { token: teacher.token })).data.setup.topic,
    ).toBe('善意的謊言是對的嗎？')
  })

  it('限制三題釐清，回饋不重設題數，並隔離教師的設定工作', async () => {
    const teacher = await login('wang'),
      outsider = await login('lin'),
      student = await login('s012')
    const input = {
      age_band: '16-18',
      max_turns: 5,
      source_language: 'zh-TW',
      description: '請以電車難題討論倫理判斷，讓學生比較人數與行動界線。',
    }
    expect(
      (await call('/teacher/courses/c-phil/setup-jobs', post(student.token, input))).res.status,
    ).toBe(403)
    const prepared = await call('/teacher/courses/c-phil/setup-jobs', post(teacher.token, input))
    expect(prepared.data.questions).toHaveLength(3)
    expect(prepared.data.setup).not.toBeNull()
    const url = `/teacher/courses/c-phil/setup-jobs/${prepared.data.job_id}`
    expect((await call(`${url}/answers`, post(outsider.token, { answers: {} }))).res.status).toBe(
      404,
    )
    const answered = await call(
      `${url}/answers`,
      post(teacher.token, { answers: { exclusions: '不討論真實同學' } }),
    )
    expect(answered.data.question_count).toBe(3)
    expect(answered.data.setup).toMatchObject({
      age_band: '16-18',
      max_turns: 5,
      exclusions: '不討論真實同學',
    })
    const refined = await call(
      `${url}/refine`,
      post(teacher.token, { setup: answered.data.setup, feedback: '加入反例探究' }),
    )
    expect(refined.data.question_count).toBe(3)
    expect(refined.data.questions).toEqual([])
  })

  it('草稿可修訂，發布後禁止老師與助教覆寫或另存來規避鎖定', async () => {
    const teacher = await login('wang'),
      assistant = await login('ta')
    const path = '/teacher/courses/c-phil/inquiries'
    const beforeCount = (await call('/teacher/courses/c-phil/topics', { token: teacher.token }))
      .data.topics.length
    const payload = {
      topic_id: '',
      setup: settings,
      status: 'draft',
      model_id: 'gpt-6-luna',
      source_language: 'zh-TW',
    }
    const created = await call(path, post(teacher.token, payload))
    expect(created.res.status).toBe(200)
    const revised = await call(
      path,
      post(teacher.token, {
        ...payload,
        topic_id: created.data.topic_id,
        expected_version: created.data.version,
        setup: { ...settings, topic: '修訂後的草稿' },
      }),
    )
    expect(revised.res.status).toBe(200)
    expect(revised.data.setup.topic).toBe('修訂後的草稿')
    const published = await call(
      path,
      post(teacher.token, {
        ...revised.data,
        expected_version: revised.data.version,
        status: 'published',
      }),
    )
    expect(published.res.status).toBe(200)
    for (const token of [teacher.token, assistant.token]) {
      const blocked = await call(
        path,
        post(token, {
          ...published.data,
          expected_version: published.data.version,
          status: 'draft',
          model_id: 'gpt-6-sol',
          source_language: 'en',
          setup: { ...settings, topic: '不能變更', max_turns: 15 },
        }),
      )
      expect(blocked.res.status).toBe(409)
      expect(blocked.data.detail).toBe('活動已發布，無法再修改。')
    }
    expect(
      (
        await call(
          path,
          post(teacher.token, {
            ...published.data,
            expected_version: published.data.version,
          }),
        )
      ).res.status,
    ).toBe(409)
    expect(
      (
        await call(`/teacher/topics/${published.data.topic_id}`, {
          token: teacher.token,
          method: 'PUT',
          body: JSON.stringify({ title: '不可透過舊端點更改', max_rounds: 15 }),
        })
      ).res.status,
    ).toBe(409)
    expect(
      (
        await call(`/teacher/topics/${published.data.topic_id}/setup`, {
          token: teacher.token,
        })
      ).data,
    ).toEqual(published.data)
    expect(
      (await call('/teacher/courses/c-phil/topics', { token: teacher.token })).data.topics,
    ).toHaveLength(beforeCount + 1)
  })

  it('不限制同課程同時發布的活動數量，也不要求預設結論類別', async () => {
    const teacher = await login('wang')
    const ids: string[] = []
    for (let index = 0; index < 4; index++) {
      const created = await call(
        '/teacher/courses/c-phil/inquiries',
        post(teacher.token, {
          topic_id: '',
          setup: { ...settings, topic: `探究 ${index}` },
          status: 'published',
          model_id: 'gpt-6-luna',
          source_language: 'zh-TW',
        }),
      )
      expect(created.res.status).toBe(200)
      ids.push(created.data.topic_id)
    }
    const topics = (await call('/teacher/courses/c-phil/topics', { token: teacher.token })).data
      .topics
    expect(
      topics.filter(
        (topic: { topic_id: string; publication_status: string }) =>
          ids.includes(topic.topic_id) && topic.publication_status === 'published',
      ),
    ).toHaveLength(4)
    expect(
      topics.some(
        (topic: { topic_id: string; publication_status: string }) =>
          topic.topic_id === 't-lie' && topic.publication_status === 'published',
      ),
    ).toBe(true)
  })

  it('每則學生回覆完成一回合；重試不重複扣回合，達上限產生報告', async () => {
    const student = await login('s012')
    const teacher = await login('wang')
    const created = await call(
      '/teacher/courses/c-phil/inquiries',
      post(teacher.token, {
        topic_id: '',
        setup: settings,
        status: 'published',
        model_id: 'gpt-6-luna',
        source_language: 'zh-TW',
      }),
    )
    const session = (
      await call(`/student/topics/${created.data.topic_id}/sessions`, post(student.token, {}))
    ).data.session_id
    const url = `/student/sessions/${session}`
    async function reply(index: number) {
      const res = await fetch(`${API}${url}/messages/stream`, {
        ...post(student.token, { content: '我想再思考', request_id: `request-${index}` }),
        headers: { Authorization: `Bearer ${student.token}`, 'Content-Type': 'application/json' },
      })
      return { status: res.status, text: await res.text() }
    }
    for (let i = 1; i <= 5; i++) expect((await reply(i)).status).toBe(200)
    expect((await reply(5)).status).toBe(200)
    const history = (await call(`${url}/messages`, { token: student.token })).data
    expect(history.remaining_rounds).toBe(0)
    expect(
      history.messages.filter((message: { role: string }) => message.role === 'user'),
    ).toHaveLength(5)
    expect(
      history.messages.filter((message: { role: string }) => message.role === 'assistant'),
    ).toHaveLength(5)
    const report = (await call(`${url}/report`, { token: student.token })).data
    expect(report.report).toMatchObject({ completed_turns: 5, completion_reason: 'max_turns' })
    expect((await reply(6)).status).toBe(409)
    const other = await login('s011')
    expect((await call(`${url}/report`, { token: other.token })).res.status).toBe(404)
  })

  it('提前完成需要明確同意；拒絕結束時繼續原對話', async () => {
    const student = await login('s012')
    const session = (await call('/student/topics/t-ai/sessions', post(student.token, {}))).data
      .session_id
    const url = `/student/sessions/${session}`
    expect((await call(`${url}/end`, post(student.token, { action: 'complete' }))).res.status).toBe(
      409,
    )
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${API}${url}/messages/stream`, {
        ...post(student.token, {
          content: `我認為需要考慮使用方式與個人的理由${i}`,
          request_id: `consent-${i}`,
        }),
        headers: { Authorization: `Bearer ${student.token}`, 'Content-Type': 'application/json' },
      })
      await res.text()
    }
    expect((await call(`${url}/messages`, { token: student.token })).data).toMatchObject({
      status: 'IN_PROGRESS',
      awaiting_end_consent: true,
      remaining_rounds: 7,
    })
    expect((await call(`${url}/end`, post(student.token, { action: 'complete' }))).res.status).toBe(
      200,
    )
    expect(
      (await call(`${url}/report`, { token: student.token })).data.report.completion_reason,
    ).toBe('goal_met_and_consented')
  })

  it('摘要未審閱不可發布，發布版不可被新草稿覆寫，學生看不到個人報告 ID', async () => {
    const teacher = await login('wang'),
      student = await login('s012')
    const url = '/teacher/topics/t-ai/summary'
    const draft = (await call(url, post(teacher.token, {}))).data
    expect(
      draft.groups.reduce(
        (sum: number, group: { count: number }) => sum + group.count,
        draft.ungrouped_count,
      ),
    ).toBe(draft.report_count)
    expect(
      (await call('/student/topics/t-ai/summary', { token: student.token })).data.summary,
    ).toBeNull()
    expect(
      (await call(`${url}/publish`, post(teacher.token, { version: draft.version }))).res.status,
    ).toBe(409)
    await call(`${url}/review`, post(teacher.token, { version: draft.version }))
    expect(
      (await call(`${url}/publish`, post(teacher.token, { version: draft.version }))).res.status,
    ).toBe(200)
    const published = (await call('/student/topics/t-ai/summary', { token: student.token })).data
      .summary
    expect(
      published.groups.every((group: { report_ids: string[] }) => group.report_ids.length === 0),
    ).toBe(true)
    expect(JSON.stringify(published)).not.toContain('王小明')
    await call(url, post(teacher.token, {}))
    expect(
      (await call('/student/topics/t-ai/summary', { token: student.token })).data.summary,
    ).toEqual(published)
  })

  it('刪除整個課程會移除活動、對話、報告、摘要及成員關係', async () => {
    const teacher = await login('wang'),
      student = await login('s001')
    await call('/teacher/topics/t-lie/summary', post(teacher.token, {}))
    expect(
      (await call('/teacher/courses/c-phil', { token: teacher.token, method: 'DELETE' })).res
        .status,
    ).toBe(200)
    expect((await call('/teacher/topics/t-lie/reports', { token: teacher.token })).res.status).toBe(
      404,
    )
    expect((await call('/teacher/topics/t-lie/summary', { token: teacher.token })).res.status).toBe(
      404,
    )
    expect(
      (await call('/student/courses', { token: student.token })).data.some(
        (course: { course_id: string }) => course.course_id === 'c-phil',
      ),
    ).toBe(false)
  })

  it('刪除活動會清除對話、報告及摘要，保留課程、其他活動及成員', async () => {
    const teacher = await login('wang'),
      outsider = await login('lin'),
      student = await login('s012')
    const session = (await call('/student/topics/t-lie/sessions', post(student.token, {}))).data
      .session_id
    await call('/teacher/topics/t-lie/summary', post(teacher.token, {}))
    expect(
      (await call('/teacher/topics/t-lie', { token: outsider.token, method: 'DELETE' })).res.status,
    ).toBe(404)
    expect(
      (await call('/teacher/topics/t-lie', { token: student.token, method: 'DELETE' })).res.status,
    ).toBe(403)
    expect(
      (await call('/teacher/topics/t-lie', { token: teacher.token, method: 'DELETE' })).res.status,
    ).toBe(200)
    expect(
      (await call(`/student/sessions/${session}/messages`, { token: student.token })).res.status,
    ).toBe(404)
    expect(
      (await call(`/student/sessions/${session}/report`, { token: student.token })).res.status,
    ).toBe(404)
    expect((await call('/teacher/topics/t-lie/reports', { token: teacher.token })).res.status).toBe(
      404,
    )
    expect((await call('/teacher/topics/t-lie/summary', { token: teacher.token })).res.status).toBe(
      404,
    )
    const course = await call('/student/courses/c-phil/topics', { token: student.token })
    expect(course.res.status).toBe(200)
    expect(
      course.data.topics.some((topic: { topic_id: string }) => topic.topic_id === 't-lie'),
    ).toBe(false)
    expect(
      course.data.topics.some((topic: { topic_id: string }) => topic.topic_id === 't-ai'),
    ).toBe(true)
    expect(
      (await call('/teacher/courses/c-phil/students', { token: teacher.token })).data,
    ).toHaveLength(12)
  })

  it('只允許初次登入改密碼，完成後不提供後續修改', async () => {
    const teacher = await login('chen')
    expect(
      (
        await call('/auth/password', {
          token: teacher.token,
          method: 'PUT',
          body: JSON.stringify({ old_password: 'password123', new_password: 'firstpassword456' }),
        })
      ).res.status,
    ).toBe(200)
    expect(
      (
        await call('/auth/password', {
          token: teacher.token,
          method: 'PUT',
          body: JSON.stringify({
            old_password: 'firstpassword456',
            new_password: 'laterpassword789',
          }),
        })
      ).res.status,
    ).toBe(403)
  })
})
