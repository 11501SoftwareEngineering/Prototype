import { http, HttpResponse, delay } from 'msw'
import { db, syncDbFromStorage } from './db'
import { mockModels } from './models'
import { scenarios } from './scenarios'
import type { AiKeySettings, TokenUsage, UsageStage } from '@/api/teacherAi'
const base = '*/api/v1/teacher'
function teacher(request: Request) {
  syncDbFromStorage()
  const id = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+mock-token\./, '')
  const user = db.users.find((item) => item.id === id)
  if (!user)
    return HttpResponse.json({ detail: 'Not authenticated or token expired' }, { status: 401 })
  if (user.must_change_password)
    return HttpResponse.json({ detail: 'Password change required' }, { status: 403 })
  return user.role === 'TEACHER'
    ? user
    : HttpResponse.json({ detail: 'Teacher privileges required' }, { status: 403 })
}
function period() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}`
}
export function usageFor(teacherId: string): TokenUsage {
  db.ai_usage ??= {}
  let usage = db.ai_usage[teacherId]
  if (!usage || usage.period !== period()) {
    const seeded = teacherId === 'u-wang'
    const rows = [
      ['setup', 3600, 1800, 12],
      ['dialogue', 12900, 8300, 94],
      ['report', 7300, 3200, 12],
      ['summary', 2400, 1100, 4],
    ] as const
    usage = {
      usage_monthly_usd: seeded ? 0.0056 : 0,
      limit_usd: null,
      remaining_limit_usd: null,
      period: period(),
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      requests: 0,
      updated_at: new Date().toISOString(),
      is_demo: true,
      by_stage: rows.map(([stage, input, output, requests]) => ({
        stage,
        input_tokens: seeded ? input : 0,
        output_tokens: seeded ? output : 0,
        requests: seeded ? requests : 0,
      })),
    }
    db.ai_usage[teacherId] = usage
  }
  if (!Object.prototype.hasOwnProperty.call(usage, 'usage_monthly_usd'))
    usage.usage_monthly_usd = teacherId === 'u-wang' ? 0.0056 : 0
  usage.limit_usd ??= null
  usage.remaining_limit_usd ??= null
  usage.input_tokens = usage.by_stage.reduce((sum, row) => sum + row.input_tokens, 0)
  usage.output_tokens = usage.by_stage.reduce((sum, row) => sum + row.output_tokens, 0)
  usage.total_tokens = usage.input_tokens + usage.output_tokens
  usage.requests = usage.by_stage.reduce((sum, row) => sum + row.requests, 0)
  return usage
}
/** Fixed demo increments; production must record provider-reported usage. */
export function recordDemoUsage(courseId: string, stage: UsageStage, modelId?: string) {
  const ownerId = db.courses.find((course) => course.id === courseId)?.teacher_id
  if (!ownerId) return
  const usage = usageFor(ownerId),
    row = usage.by_stage.find((item) => item.stage === stage)!
  row.input_tokens += stage === 'dialogue' ? 240 : 800
  row.output_tokens += stage === 'dialogue' ? 110 : 420
  const pricing = mockModels.find(
    (model) => model.id === (modelId ?? settingsFor(ownerId).default_model_id),
  )?.pricing
  if (
    usage.usage_monthly_usd != null &&
    pricing?.input_per_million_usd != null &&
    pricing.output_per_million_usd != null
  )
    usage.usage_monthly_usd +=
      ((stage === 'dialogue' ? 240 : 800) * pricing.input_per_million_usd +
        (stage === 'dialogue' ? 110 : 420) * pricing.output_per_million_usd) /
      1000000
  else usage.usage_monthly_usd = null
  row.requests += 1
  usage.updated_at = new Date().toISOString()
  usageFor(ownerId)
}
const settingsFor = (id: string): AiKeySettings => ({
  configured: false,
  masked_key: null,
  updated_at: null,
  is_demo: true,
  default_model_id: 'gpt-6-luna',
  provider: 'openrouter',
  ...db.ai_settings?.[id],
})
export const teacherAiHandlers = [
  http.get(`${base}/ai-usage`, async ({ request }) => {
    const user = teacher(request)
    if (user instanceof Response) return user
    await delay(scenarios.latency)
    return HttpResponse.json({ ...usageFor(user.id), updated_at: new Date().toISOString() })
  }),
  http.get(`${base}/ai-settings`, async ({ request }) => {
    const user = teacher(request)
    if (user instanceof Response) return user
    await delay(scenarios.latency)
    return HttpResponse.json(settingsFor(user.id))
  }),
  http.put(`${base}/ai-settings`, async ({ request }) => {
    const user = teacher(request)
    if (user instanceof Response) return user
    const body = (await request.json()) as { api_key: unknown }
    if (
      typeof body.api_key !== 'string' ||
      body.api_key.trim().length < 10 ||
      body.api_key.length > 1024
    )
      return HttpResponse.json({ detail: '請填寫有效的 API key。' }, { status: 422 })
    // Never retain the key itself in this browser-backed demo database.
    const settings: AiKeySettings = {
      ...settingsFor(user.id),
      configured: true,
      masked_key: `•••• ${body.api_key.trim().slice(-4)}`,
      updated_at: new Date().toISOString(),
      is_demo: true,
    }
    db.ai_settings ??= {}
    db.ai_settings[user.id] = settings
    return HttpResponse.json(settings)
  }),
  http.patch(`${base}/ai-settings/model`, async ({ request }) => {
    const user = teacher(request)
    if (user instanceof Response) return user
    const { model_id } = (await request.json()) as { model_id: string }
    if (!mockModels.some((model) => model.id === model_id))
      return HttpResponse.json({ detail: '請選擇可用的模型。' }, { status: 422 })
    db.ai_settings ??= {}
    db.ai_settings[user.id] = {
      ...settingsFor(user.id),
      default_model_id: model_id,
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(settingsFor(user.id))
  }),
  http.delete(`${base}/ai-settings`, ({ request }) => {
    const user = teacher(request)
    if (user instanceof Response) return user
    db.ai_settings ??= {}
    db.ai_settings[user.id] = {
      ...settingsFor(user.id),
      configured: false,
      masked_key: null,
      updated_at: new Date().toISOString(),
      is_demo: true,
    }
    return HttpResponse.json(settingsFor(user.id))
  }),
]
