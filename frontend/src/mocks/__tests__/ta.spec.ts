import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from '../handlers'
import { db, resetDb } from '../db'
import { resetScenarios, scenarios } from '../scenarios'
const server = setupServer(...handlers),
  base = 'http://localhost:8000/api/v1'
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  resetDb()
  resetScenarios()
  scenarios.latency = 0
  scenarios.typingSpeed = 0
})
async function call(path: string, token = '', method = 'GET', body?: unknown) {
  const init: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }
  if (body !== undefined && method !== 'GET') init.body = JSON.stringify(body)
  const response = await fetch(`${base}${path}`, init)
  return {
    status: response.status,
    data: await response.json(),
    token: (response.headers.get('Authorization') ?? '').replace('Bearer ', ''),
  }
}
async function login(account: string) {
  return call('/auth/login', '', 'POST', { account, password: 'password123' })
}
const setup = {
  age_band: '16-18',
  max_turns: 5,
  topic: '助教測試活動',
  core_question: '如何衡量不同的理由？',
  inquiry_focus: '比較理由與反例',
  background_info: '使用虛構情境進行探究',
  exclusions: '未指定',
  opening_message: '你會如何判斷？請說明理由。',
}

describe('課程助教權限', () => {
  it('提供 ta 示範帳號，只看見指派課程，不計入學生人數', async () => {
    const assistant = await login('ta'),
      teacher = await login('wang'),
      student = await login('s012')
    expect(assistant.status).toBe(200)
    expect(assistant.data).toMatchObject({
      role: 'USER',
      has_ta_assignments: true,
      must_change_password: false,
    })
    const courses = await call('/teacher/courses', assistant.token)
    expect(courses.data.map((course: { course_id: string }) => course.course_id)).toEqual([
      'c-phil',
    ])
    expect((await call('/teacher/courses/c-civic/topics', assistant.token)).status).toBe(403)
    expect((await call('/teacher/courses', student.token)).status).toBe(403)
    expect((await call('/teacher/courses/c-phil/students', teacher.token)).data).toHaveLength(12)
    expect((await call('/teacher/topics/t-lie/reports', assistant.token)).data.roster_count).toBe(
      12,
    )
    expect((await call('/student/courses', assistant.token)).data).toEqual([])
  })

  it('老師逐項勾選後立即限制未授予的操作，助教不能修改自己的權限', async () => {
    const teacher = await login('wang'),
      assistant = await login('ta'),
      outsider = await login('lin')
    const path = '/teacher/courses/c-phil/tas/u-ta-demo'
    expect(
      (await call(path, outsider.token, 'PATCH', { permissions: ['edit_summary'] })).status,
    ).toBe(404)
    expect(
      (await call(path, assistant.token, 'PATCH', { permissions: ['view_reports'] })).status,
    ).toBe(403)
    expect(
      (await call(path, teacher.token, 'PATCH', { permissions: ['publish_summary'] })).status,
    ).toBe(422)
    expect(
      (await call(path, teacher.token, 'PATCH', { permissions: ['edit_summary'] })).status,
    ).toBe(200)
    expect((await call('/teacher/topics/t-lie/reports', assistant.token)).status).toBe(403)
    expect((await call('/teacher/courses/c-phil/students', assistant.token)).status).toBe(403)
    expect(
      (
        await call('/teacher/courses/c-phil/setup-jobs', assistant.token, 'POST', {
          age_band: '16-18',
          max_turns: 5,
          source_language: 'zh-TW',
          description: '讓學生比較不同理由、前提與反例，並說明自己的判斷。',
        })
      ).status,
    ).toBe(403)
    const summary = (await call('/teacher/topics/t-lie/summary', assistant.token)).data.draft
    const changed = await call('/teacher/topics/t-lie/summary', assistant.token, 'PATCH', {
      version: summary.version,
      overview: '助教修訂概述',
      viewpoint_summary: '保留各組條件及未確定立場。',
    })
    expect(changed.status).toBe(200)
    expect(changed.data).toMatchObject({
      status: 'draft',
      viewpoint_summary: '保留各組條件及未確定立場。',
    })
    expect((await call('/teacher/topics/t-lie/analytics', assistant.token)).status).toBe(403)
  })

  it('助教可編輯草稿，發布、審閱、刪除與課程管理由老師執行', async () => {
    const assistant = await login('ta')
    const payload = {
      topic_id: '',
      setup,
      status: 'draft',
      model_id: 'gpt-6-luna',
      source_language: 'zh-TW',
    }
    expect(
      (await call('/teacher/courses/c-phil/inquiries', assistant.token, 'POST', payload)).status,
    ).toBe(200)
    expect(
      (
        await call('/teacher/courses/c-phil/inquiries', assistant.token, 'POST', {
          ...payload,
          status: 'published',
        })
      ).status,
    ).toBe(403)
    for (const path of [
      '/teacher/courses/c-phil',
      '/teacher/topics/t-lie',
      '/teacher/courses/c-phil/students/u-s1',
    ])
      expect((await call(path, assistant.token, 'DELETE')).status).toBe(403)
    for (const action of ['review', 'publish', 'withdraw'])
      expect(
        (
          await call(`/teacher/topics/t-lie/summary/${action}`, assistant.token, 'POST', {
            version: 1,
          })
        ).status,
      ).toBe(403)
    expect(
      (await call('/teacher/courses', assistant.token, 'POST', { name: '不能建立課程' })).status,
    ).toBe(403)
    expect(
      (
        await call('/teacher/topics/t-lie', assistant.token, 'PUT', {
          title: '不可透過舊端點覆寫發布版',
        })
      ).status,
    ).toBe(403)
  })

  it('移除助教即撤銷存取，原本的學生身分與歷史紀錄可恢復', async () => {
    const teacher = await login('wang'),
      student = await login('s001'),
      assistant = await login('ta')
    expect(
      (
        await call('/teacher/courses/c-phil/tas', teacher.token, 'POST', {
          account: 's001',
          permissions: ['view_reports'],
        })
      ).status,
    ).toBe(201)
    expect((await call('/teacher/courses/c-phil/students', teacher.token)).data).toHaveLength(11)
    expect((await call('/teacher/topics/t-lie/reports', teacher.token)).data.reports).toHaveLength(
      11,
    )
    expect((await call('/teacher/topics/t-lie/reports', student.token)).status).toBe(200)
    expect((await call('/teacher/courses/c-phil/tas/u-s1', teacher.token, 'DELETE')).status).toBe(
      200,
    )
    expect((await call('/teacher/courses/c-phil/students', teacher.token)).data).toHaveLength(12)
    expect(
      (await call('/student/courses/c-phil/topics', student.token)).data.topics[0].status,
    ).toBe('COMPLETED')
    await call('/teacher/courses/c-phil/tas/u-ta-demo', teacher.token, 'DELETE')
    expect((await call('/teacher/topics/t-lie/reports', assistant.token)).status).toBe(403)
    expect((await call('/users/me', assistant.token)).data.has_ta_assignments).toBe(false)
  })
})

describe('教師 token 用量及 API key', () => {
  it('只向本人提供用量與遮罩狀態，不保存或回傳完整金鑰', async () => {
    const teacher = await login('wang'),
      other = await login('lin'),
      assistant = await login('ta'),
      student = await login('s012')
    const key = 'test-key-for-unit-tests-only-8426'
    const saved = await call('/teacher/ai-settings', teacher.token, 'PUT', { api_key: key })
    expect(saved.data).toMatchObject({ configured: true, masked_key: '•••• 8426', is_demo: true })
    expect(JSON.stringify(saved.data)).not.toContain(key)
    expect(JSON.stringify(db)).not.toContain(key)
    expect((await call('/teacher/ai-settings', other.token)).data.configured).toBe(false)
    for (const user of [assistant, student])
      for (const path of ['/teacher/ai-settings', '/teacher/ai-usage'])
        expect((await call(path, user.token)).status).toBe(403)
    expect(
      (await call('/teacher/ai-settings', assistant.token, 'PUT', { api_key: key })).status,
    ).toBe(403)
    const usage = (await call('/teacher/ai-usage', teacher.token)).data
    expect(usage.total_tokens).toBe(usage.input_tokens + usage.output_tokens)
    expect(usage.total_tokens).toBe(
      usage.by_stage.reduce(
        (sum: number, row: { input_tokens: number; output_tokens: number }) =>
          sum + row.input_tokens + row.output_tokens,
        0,
      ),
    )
    expect((await call('/teacher/ai-usage', other.token)).data.total_tokens).toBe(0)
  })

  it('模型偏好屬於老師本人，更新與移除金鑰不改寫已發布活動的模型', async () => {
    const teacher = await login('wang'),
      other = await login('lin'),
      assistant = await login('ta'),
      student = await login('s012')
    const path = '/teacher/ai-settings/model'
    expect((await call(path, assistant.token, 'PATCH', { model_id: 'gpt-6-sol' })).status).toBe(403)
    expect((await call(path, teacher.token, 'PATCH', { model_id: 'unknown-model' })).status).toBe(
      422,
    )
    expect(
      (await call(path, teacher.token, 'PATCH', { model_id: 'gpt-6-sol' })).data.default_model_id,
    ).toBe('gpt-6-sol')
    expect((await call('/teacher/ai-settings', other.token)).data.default_model_id).toBe(
      'gpt-6-luna',
    )
    expect(
      (await call('/teacher/courses/c-phil/topics', teacher.token)).data.default_model_id,
    ).toBe('gpt-6-sol')
    expect((await call('/teacher/topics/t-lie/setup', teacher.token)).data.model_id).toBe(
      'gpt-6-luna',
    )
    const session = (await call('/student/topics/t-ai/sessions', student.token, 'POST', {})).data
      .session_id
    expect(db.sessions.find((item) => item.id === session)?.model_id).toBe('gpt-6-luna')
    await call('/teacher/ai-settings', teacher.token, 'PUT', {
      api_key: 'test-only-openrouter-key-2468',
    })
    expect(
      (await call('/teacher/ai-settings', teacher.token, 'DELETE')).data.default_model_id,
    ).toBe('gpt-6-sol')
  })

  it('助教的授權 AI 操作計入課程老師，不計入其他老師', async () => {
    const teacher = await login('wang'),
      assistant = await login('ta'),
      other = await login('lin')
    const before = (await call('/teacher/ai-usage', teacher.token)).data
    expect(
      (
        await call('/teacher/courses/c-phil/opening-message', assistant.token, 'POST', {
          setup,
          source_language: 'zh-TW',
          model_id: 'gpt-6-luna',
        })
      ).status,
    ).toBe(200)
    const after = (await call('/teacher/ai-usage', teacher.token)).data
    expect(after.requests).toBe(before.requests + 1)
    expect(after.total_tokens).toBeGreaterThan(before.total_tokens)
    expect((await call('/teacher/ai-usage', other.token)).data.total_tokens).toBe(0)
    const cleared = await call('/teacher/ai-settings', teacher.token, 'DELETE')
    expect(cleared.data).toMatchObject({ configured: false, masked_key: null })
  })
})
