import type { ModelOption } from '@/api/inquiry'
// Reference demo prices from localhost:5173; never presented as live prices.
const prices = (input: number, output: number) => ({
  input_per_million_usd: input,
  output_per_million_usd: output,
  currency: 'USD' as const,
  source: 'demo' as const,
  updated_at: new Date().toISOString(),
})
export const mockModels: ModelOption[] = [
  {
    id: 'gpt-6-luna',
    provider_model_id: 'openai/gpt-6-luna',
    name: 'GPT-6 Luna',
    description: '快速 · 低成本',
    pricing: prices(0.1, 0.5),
  },
  {
    id: 'gpt-5.4-mini',
    provider_model_id: 'openai/gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    description: '品質與成本平衡',
    pricing: prices(0.75, 4.5),
  },
  {
    id: 'gpt-4.1-mini',
    provider_model_id: 'openai/gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: '舊版基準模型',
    pricing: prices(0.4, 1.6),
  },
  {
    id: 'gpt-6-sol',
    provider_model_id: 'openai/gpt-6-sol',
    name: 'GPT-6 Sol',
    description: '高品質 · 高成本',
    pricing: prices(2, 10),
  },
]
