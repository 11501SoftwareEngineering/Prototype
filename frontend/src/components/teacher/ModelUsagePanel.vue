<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Coins, KeyRound, RefreshCw } from '@lucide/vue'
import { inquiryApi, inquiryKeys } from '@/api/inquiry'
import { teacherAiApi, teacherAiKeys, type UsageStage } from '@/api/teacherAi'
import QueryState from '@/components/common/QueryState.vue'
import { Button } from '@/components/ui/button'
defineProps<{ detailed?: boolean }>()
const client = useQueryClient(),
  selected = ref('gpt-6-luna'),
  notice = ref(''),
  error = ref('')
const models = useQuery({ queryKey: inquiryKeys.models, queryFn: inquiryApi.getModels })
const settings = useQuery({ queryKey: teacherAiKeys.settings, queryFn: teacherAiApi.getSettings })
const usage = useQuery({
  queryKey: teacherAiKeys.usage,
  queryFn: teacherAiApi.getUsage,
  refetchInterval: 15000,
})
watch(
  () => settings.data.value?.default_model_id,
  (id) => {
    if (id) selected.value = id
  },
  { immediate: true },
)
const active = computed(() => models.data.value?.find((model) => model.id === selected.value))
const number = (value: number | undefined) =>
  value === undefined ? '—' : new Intl.NumberFormat('zh-TW').format(value)
const stageLabels: Record<UsageStage, string> = {
  setup: '課程設定',
  dialogue: '學生對話',
  report: '個人報告',
  summary: '全班摘要',
}
const money = (value: number | null | undefined, digits = 4) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? `US$${new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 6) }).format(value)}`
    : '尚無資料'
const date = (value: string | undefined) =>
  value
    ? new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '—'
const saving = useMutation({
  mutationFn: () => teacherAiApi.setModel(selected.value),
  onSuccess: async (value) => {
    client.setQueryData(teacherAiKeys.settings, value)
    await client.invalidateQueries({ queryKey: ['teacher', 'course'] })
    error.value = ''
    notice.value = '已設定為新活動的預設模型。'
  },
  onError: () => {
    selected.value = settings.data.value?.default_model_id ?? 'gpt-6-luna'
    error.value = '無法更新模型，請稍後再試。'
  },
})
async function refresh() {
  await Promise.allSettled([models.refetch(), settings.refetch(), usage.refetch()])
}
</script>
<template>
  <section
    class="mb-8 rounded-xl border border-border bg-workspace p-6 text-workspace-foreground sm:p-8"
  >
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="flex items-center gap-3 text-base font-bold">
          <Coins class="size-5 shrink-0 text-workspace-accent" />AI 模型與用量
        </h2>
        <span v-if="usage.data.value" class="text-[11px] text-workspace-foreground/75">{{
          usage.data.value.period
        }}</span>
        <span
          v-if="usage.data.value?.is_demo"
          class="rounded-full border border-workspace-foreground/20 px-2 py-1 text-[9px] text-workspace-foreground/75"
          >示範資料</span
        >
      </div>
      <div class="flex items-center gap-2">
        <button
          class="rounded-full border border-workspace-foreground/20 p-2.5 hover:bg-workspace-foreground/5"
          aria-label="更新模型、金額與 Token 用量"
          :disabled="
            usage.isFetching.value ||
            models.isFetching.value ||
            settings.isFetching.value ||
            saving.isPending.value
          "
          @click="refresh"
        >
          <RefreshCw class="size-4" />
        </button>
        <Button
          v-if="!detailed"
          as-child
          variant="outline"
          class="border-workspace-foreground/25 bg-transparent text-workspace-foreground hover:bg-workspace-foreground/10 hover:text-workspace-foreground"
          ><RouterLink :to="{ name: 'TeacherAiSettings' }"
            ><KeyRound class="size-3.5" />API key 設定</RouterLink
          ></Button
        >
      </div>
    </div>
    <QueryState
      :loading="models.isPending.value || settings.isPending.value || usage.isPending.value"
      :error="models.error.value ?? settings.error.value ?? usage.error.value"
      @retry="refresh"
      ><div class="grid grid-cols-2 gap-5 sm:grid-cols-4" aria-label="Token 使用量">
        <div
          v-for="stat in [
            { label: '總 token', value: usage.data.value?.total_tokens },
            { label: '輸入 token', value: usage.data.value?.input_tokens },
            { label: '輸出 token', value: usage.data.value?.output_tokens },
            { label: 'AI 請求次數', value: usage.data.value?.requests },
          ]"
          :key="stat.label"
        >
          <p class="text-[11px] text-workspace-foreground/75">{{ stat.label }}</p>
          <p class="mt-2 text-xl font-medium tabular-nums">{{ number(stat.value) }}</p>
        </div>
      </div>
      <div class="mt-6 grid gap-7 border-t border-workspace-foreground/15 pt-6 md:grid-cols-2">
        <div>
          <label for="teacher-default-model" class="mb-3 block text-xs">新活動預設模型</label
          ><select
            id="teacher-default-model"
            v-model="selected"
            class="workspace-input border-workspace-foreground/25 bg-workspace text-workspace-foreground"
            :disabled="saving.isPending.value"
            @change="saving.mutate()"
          >
            <option
              v-for="model in models.data.value"
              :key="model.id"
              :value="model.id"
              class="bg-workspace"
            >
              {{ model.name }} · {{ model.description }}
            </option>
          </select>
          <p class="mt-3 text-[11px] leading-6 text-workspace-foreground/75">
            用於新活動的預設模型，活動設定可再確認。
          </p>
          <p
            v-if="active?.provider_model_id"
            class="mt-4 font-mono text-[10px] text-workspace-foreground/75"
          >
            {{ active.provider_model_id }}
          </p>
          <p v-if="notice" role="status" class="mt-3 text-xs leading-6 text-workspace-accent">
            {{ notice }}
          </p>
          <p v-if="error" role="alert" class="mt-3 text-xs leading-6 text-workspace-accent">
            {{ error }}
          </p>
        </div>
        <div>
          <p class="mb-3 text-xs">OpenRouter 本月已用</p>
          <p class="text-3xl font-medium tabular-nums text-workspace-accent">
            {{ money(usage.data.value?.usage_monthly_usd) }}
          </p>
          <p class="mt-3 text-[11px] leading-6 text-workspace-foreground/75">
            {{
              usage.data.value?.limit_usd === undefined
                ? '尚無金鑰額度資料。'
                : usage.data.value.limit_usd === null
                  ? '此金鑰未設定支出上限，無法推算剩餘 token。'
                  : `金鑰支出上限 ${money(usage.data.value.limit_usd)}；剩餘 ${money(usage.data.value.remaining_limit_usd)}。`
            }}
          </p>
          <p class="mt-3 text-[10px] text-workspace-foreground/75">
            更新時間：{{ date(usage.data.value?.updated_at) }}
          </p>
        </div>
      </div>
      <div
        v-if="detailed"
        class="mt-6 overflow-x-auto border-t border-workspace-foreground/15 pt-5"
      >
        <h3 class="mb-2 text-xs font-medium">各階段 Token 使用量</h3>
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="text-workspace-foreground/75">
              <th class="py-3 font-normal">階段</th>
              <th class="py-3 text-right font-normal">輸入</th>
              <th class="py-3 text-right font-normal">輸出</th>
              <th class="py-3 text-right font-normal">次數</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in usage.data.value?.by_stage"
              :key="row.stage"
              class="border-t border-workspace-foreground/15"
            >
              <th class="py-3 font-medium">{{ stageLabels[row.stage] }}</th>
              <td class="py-3 text-right tabular-nums">{{ number(row.input_tokens) }}</td>
              <td class="py-3 text-right tabular-nums">{{ number(row.output_tokens) }}</td>
              <td class="py-3 text-right tabular-nums">{{ number(row.requests) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <details class="mt-6 border-t border-workspace-foreground/15 pt-5">
        <summary class="w-fit cursor-pointer text-xs font-medium text-workspace-accent">
          查看各模型價格
        </summary>
        <p
          v-if="models.data.value?.some((model) => model.pricing?.source === 'demo')"
          class="mt-3 text-[10px] leading-6 text-workspace-foreground/75"
        >
          此處為示範價格，實際費用以 OpenRouter 計費為準。
        </p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div
            v-for="model in models.data.value"
            :key="model.id"
            class="rounded-lg border border-workspace-foreground/15 p-4"
            :class="{ 'border-workspace-accent/50': model.id === selected }"
          >
            <h3 class="mb-2 text-xs font-medium">{{ model.name }}</h3>
            <p class="text-[11px] leading-6 text-workspace-foreground/75">
              {{ money(model.pricing?.input_per_million_usd, 2) }} / 百萬輸入 tokens
            </p>
            <p class="text-[11px] leading-6 text-workspace-foreground/75">
              {{ money(model.pricing?.output_per_million_usd, 2) }} / 百萬輸出 tokens
            </p>
          </div>
        </div>
      </details></QueryState
    >
  </section>
</template>
