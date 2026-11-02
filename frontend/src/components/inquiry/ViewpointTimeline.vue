<script setup lang="ts">
import { ArrowRight, ArrowUpRight, GitBranch } from '@lucide/vue'
import type { ViewpointGroup, ViewpointTimelinePoint } from '@/api/inquiry'
import { useLocale } from '@/composables/useLocale'
const props = defineProps<{
  events: ViewpointTimelinePoint[]
  groups?: ViewpointGroup[]
  interactive?: boolean
  showEvidence?: boolean
}>()
const emit = defineEmits<{ evidence: [messageId: string]; group: [group: ViewpointGroup] }>()
const { t } = useLocale()
const labels: Record<ViewpointTimelinePoint['change_type'], string> = {
  initial: '初步表態',
  clarified: '補充理由或條件',
  revised: '觀點修正',
  maintained: '立場維持',
  uncertain: '轉為不確定',
  unassessed: '尚待判讀',
  mixed: '多種觀點變化',
}
function openGroup(id: string) {
  const group = props.groups?.find((item) => item.group_id === id)
  if (group) emit('group', group)
}
</script>
<template>
  <section class="surface-panel p-5 sm:p-7">
    <h2 class="mb-2 flex items-center gap-2 text-base font-bold">
      <GitBranch class="size-4 text-muted-foreground" />{{ t('觀點變化時間軸') }}
    </h2>
    <p class="mb-7 text-xs leading-7 text-muted-foreground">
      沿著提問與回覆，查看觀點總結在何處補充、修正或維持。只有學生明確說明時，才標示提問與改變的因果連結。
    </p>
    <ol v-if="events.length" class="ml-2 space-y-0">
      <li
        v-for="(point, index) in events"
        :key="`${point.turn}-${index}`"
        class="relative border-l border-border pb-7 pl-6 last:border-transparent last:pb-0 sm:pl-8"
      >
        <span
          class="absolute -left-[5px] top-1.5 size-[9px] rounded-full border-2 border-card"
          :class="
            ['revised', 'clarified', 'uncertain', 'mixed'].includes(point.change_type)
              ? 'bg-primary ring-2 ring-primary/20'
              : 'bg-muted-foreground/50'
          "
        />
        <div class="mb-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span class="font-mono">Q{{ point.turn }}</span
          ><span
            class="status-tag"
            :class="{ 'border-primary/30 bg-primary/10': point.change_type === 'revised' }"
            >{{ t(labels[point.change_type]) }}</span
          ><span v-if="point.affected_count">{{ point.affected_count }} {{ t('份報告') }}</span>
        </div>
        <h3 class="mb-4 text-sm font-bold leading-7">{{ point.question }}</h3>
        <div
          class="grid gap-3"
          :class="point.before_summary ? 'md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : ''"
        >
          <div v-if="point.before_summary" class="min-w-0 rounded-lg bg-muted/60 p-4">
            <p class="mb-2 text-[10px] text-muted-foreground">{{ t('提問前的觀點總結') }}</p>
            <p class="text-xs leading-7">{{ point.before_summary }}</p>
          </div>
          <ArrowRight
            v-if="point.before_summary"
            class="hidden size-4 self-center text-muted-foreground md:block"
          />
          <div class="min-w-0 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p class="mb-2 text-[10px] text-muted-foreground">
              {{ t(point.before_summary ? '回覆後的觀點總結' : '初步觀點總結') }}
            </p>
            <p class="text-xs leading-7">{{ point.after_summary }}</p>
          </div>
        </div>
        <p class="mt-3 text-[11px] leading-6 text-muted-foreground">{{ point.explanation }}</p>
        <details v-if="point.answer" class="mt-3">
          <summary class="w-fit cursor-pointer text-[11px] text-muted-foreground">
            {{ t('學生回覆與證據') }}
          </summary>
          <blockquote class="mt-3 border-l-2 border-primary pl-4 text-xs leading-7">
            {{ point.answer.quote }}
          </blockquote>
          <div v-if="showEvidence" class="mt-2 flex flex-wrap gap-3">
            <button
              v-if="point.question_message_id"
              class="text-[11px] underline underline-offset-4"
              @click="$emit('evidence', point.question_message_id)"
            >
              {{ t('查看這個提問') }}</button
            ><button
              class="text-[11px] underline underline-offset-4"
              @click="$emit('evidence', point.answer.message_id)"
            >
              {{ t('查看學生回覆') }}
            </button>
          </div>
        </details>
        <div
          v-if="interactive && point.related_group_ids?.length"
          class="mt-4 flex flex-wrap gap-2"
        >
          <button
            v-for="id in point.related_group_ids"
            :key="id"
            type="button"
            class="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-[10px] text-muted-foreground hover:border-primary"
            @click="openGroup(id)"
          >
            <span class="max-w-48 truncate">{{
              groups?.find((group) => group.group_id === id)?.title
            }}</span
            ><ArrowUpRight class="size-3 shrink-0" />
          </button>
        </div>
      </li>
    </ol>
    <p v-else class="text-xs leading-7 text-muted-foreground">
      目前尚無足夠紀錄，可靠辨識哪些提問之後出現觀點變化。可先查看個人報告與保存的對話。
    </p>
  </section>
</template>
