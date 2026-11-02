import { apiClient } from './client'
export type UsageStage = 'setup' | 'dialogue' | 'report' | 'summary'
export interface UsageRow {
  stage: UsageStage
  input_tokens: number
  output_tokens: number
  requests: number
}
export interface TokenUsage {
  usage_monthly_usd?: number | null
  limit_usd?: number | null
  remaining_limit_usd?: number | null
  period: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  requests: number
  updated_at: string
  by_stage: UsageRow[]
  is_demo: boolean
}
export interface AiKeySettings {
  default_model_id?: string
  provider?: 'openrouter'
  configured: boolean
  masked_key: string | null
  updated_at: string | null
  is_demo: boolean
}
export const teacherAiKeys = {
  usage: ['teacher', 'ai', 'usage'] as const,
  settings: ['teacher', 'ai', 'settings'] as const,
}
export const teacherAiApi = {
  async getUsage() {
    return (await apiClient.get<TokenUsage>('/teacher/ai-usage')).data
  },
  async getSettings() {
    return (await apiClient.get<AiKeySettings>('/teacher/ai-settings')).data
  },
  async setKey(apiKey: string) {
    return (await apiClient.put<AiKeySettings>('/teacher/ai-settings', { api_key: apiKey })).data
  },
  async setModel(modelId: string) {
    return (
      await apiClient.patch<AiKeySettings>('/teacher/ai-settings/model', { model_id: modelId })
    ).data
  },
  async removeKey() {
    return (await apiClient.delete<AiKeySettings>('/teacher/ai-settings')).data
  },
}
