<script setup lang="ts">
import { computed } from 'vue'
import { Quote, GitBranch, CircleHelp } from '@lucide/vue'
import type { IndividualReport } from '@/api/inquiry'
import { useLocale } from '@/composables/useLocale'
import ViewpointTimeline from './ViewpointTimeline.vue'
const props = defineProps<{ report: IndividualReport; showTranscriptLink?: boolean }>()
defineEmits<{ evidence: [messageId: string] }>()
const { t } = useLocale()
const summaryText = computed(
  () =>
    props.report.viewpoint_summary ??
    (props.report.final_viewpoint
      ? `學生目前表示「${props.report.final_viewpoint}」。${props.report.inquiry_summary}`
      : `學生尚未形成明確觀點，不能推定其支持或反對。${props.report.inquiry_summary}`),
)
const evidenceLabel = computed(() =>
  props.report.evidence_status === 'sufficient'
    ? '已表達立場'
    : props.report.evidence_status === 'insufficient'
      ? '證據不足'
      : '部分',
)
</script>

<template>
  <div class="report-reader">
    <div class="mb-5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span class="status-tag">{{ report.anonymous_id }}</span
      ><span>{{ report.completed_turns }} {{ t('回合') }}</span
      ><span>v{{ report.version }}</span
      ><span class="ml-auto status-tag">{{ t(evidenceLabel) }}</span>
    </div>
    <p class="mb-5 text-xs leading-6 text-muted-foreground">
      報告整理學生實際表達的內容，不判定標準答案。未回答或證據不足的地方會保留。
    </p>
    <section
      class="rounded-xl border-l-[3px] border-primary bg-workspace p-6 text-workspace-foreground sm:p-7"
    >
      <p class="mb-4 flex items-center gap-2 text-xs font-medium text-workspace-accent">
        <Quote class="size-4" />{{ t('觀點總結') }}
      </p>
      <h3 class="text-base font-medium leading-8 sm:text-lg sm:leading-9">{{ summaryText }}</h3>
    </section>
    <ViewpointTimeline
      class="mt-7"
      :events="report.viewpoint_timeline ?? []"
      :show-evidence="showTranscriptLink"
      @evidence="$emit('evidence', $event)"
    />
    <div class="mt-8 grid gap-x-7 gap-y-6 md:grid-cols-2">
      <section class="border-b border-border pb-6">
        <h3 class="report-section-title">{{ t('目前立場') }}</h3>
        <p class="text-sm leading-8">{{ report.final_viewpoint || t('尚未形成明確觀點') }}</p>
      </section>
      <section class="border-b border-border pb-6">
        <h3 class="report-section-title">{{ t('最強理由') }}</h3>
        <p class="text-sm leading-8">
          {{
            report.strongest_reason?.text ??
            '目前沒有足夠依據判定哪一項理由最強，以下保留已表達的內容供檢視。'
          }}
        </p>
        <button
          v-if="report.strongest_reason && showTranscriptLink"
          class="mt-2 text-xs text-muted-foreground underline underline-offset-4"
          @click="$emit('evidence', report.strongest_reason.evidence.message_id)"
        >
          {{ t('證據') }} · {{ t('回合') }} {{ report.strongest_reason.evidence.turn }}
        </button>
      </section>
      <section class="border-b border-border pb-6">
        <h3 class="report-section-title">{{ t('已檢驗的挑戰') }}</h3>
        <p class="mb-3 text-[11px] leading-6 text-muted-foreground">
          已提出追問不等於充分檢驗；以下保留學生實際回應及未作答處。
        </p>
        <div v-if="report.tested_challenges?.length" class="space-y-4">
          <div v-for="(challenge, index) in report.tested_challenges" :key="index">
            <p class="text-xs leading-7 text-muted-foreground">{{ challenge.challenge }}</p>
            <p class="mt-1 text-sm leading-8">
              {{ challenge.response ?? '學生尚未回答此追問，無法確認已完成檢驗。' }}
            </p>
            <button
              v-if="challenge.evidence && showTranscriptLink"
              class="mt-1 text-xs text-muted-foreground underline underline-offset-4"
              @click="$emit('evidence', challenge.evidence.message_id)"
            >
              {{ t('證據') }} · {{ t('回合') }} {{ challenge.evidence.turn }}
            </button>
          </div>
        </div>
        <p v-else class="text-sm leading-8 text-muted-foreground">
          對話未保存足以確認的挑戰與回應，不能推定學生已檢驗反例。
        </p>
      </section>
      <section class="border-b border-border pb-6">
        <h3 class="report-section-title"><GitBranch class="size-4" />{{ t('修正或辯護') }}</h3>
        <p v-if="report.revision_or_defense" class="text-sm leading-8">
          {{ report.revision_or_defense }}
        </p>
        <ol v-else-if="report.viewpoint_changes.length" class="space-y-3">
          <li v-for="change in report.viewpoint_changes" :key="change.turn">
            <span class="text-[11px] text-muted-foreground">{{ t('回合') }} {{ change.turn }}</span>
            <p class="text-sm leading-8">{{ change.text }}</p>
          </li>
        </ol>
        <p v-else class="text-sm leading-8 text-muted-foreground">
          尚無足夠對話內容，判定學生是否修正或辯護原本的立場。
        </p>
      </section>
      <section class="border-b border-border pb-6">
        <h3 class="report-section-title">{{ t('與探究重點的連結') }}</h3>
        <p class="text-sm leading-8">
          {{ report.focus_connection ?? '目前資料不足以確認學生如何將其判斷連結到探究重點。' }}
        </p>
      </section>
      <section class="border-b border-border pb-6">
        <h3 class="report-section-title"><CircleHelp class="size-4" />{{ t('尚待追問') }}</h3>
        <ul v-if="report.open_questions.length" class="space-y-2 text-sm leading-8">
          <li v-for="question in report.open_questions" :key="question">{{ question }}</li>
        </ul>
        <p v-else class="text-sm leading-8 text-muted-foreground">
          目前未列出追加問題，仍可回看對話確認是否有未說明的前提。
        </p>
      </section>
    </div>
    <section class="mt-8 rounded-xl border-l-[3px] border-primary bg-muted/70 p-5">
      <h3 class="mb-3 text-sm font-bold">{{ t('未完成或證據不足') }}</h3>
      <ul class="space-y-2 text-sm leading-8 text-muted-foreground">
        <li v-for="note in report.limitations" :key="note">{{ note }}</li>
        <li v-if="!report.limitations.length">
          目前未列出其他限制；這不代表對話已查證所有事實或解決所有反例。
        </li>
      </ul>
    </section>
  </div>
</template>
