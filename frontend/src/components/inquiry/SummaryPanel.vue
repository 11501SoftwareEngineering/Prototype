<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight } from '@lucide/vue'
import type { ClassSummary, ViewpointGroup } from '@/api/inquiry'
import { useLocale } from '@/composables/useLocale'
import ViewpointTimeline from './ViewpointTimeline.vue'
const props = withDefaults(
  defineProps<{ summary: ClassSummary; interactive?: boolean; showTimeline?: boolean }>(),
  { showTimeline: true },
)
const emit = defineEmits<{ group: [group: ViewpointGroup] }>()
const { t } = useLocale()
const color = (index: number) => `hsl(var(--chart-${(index % 5) + 1}))`
const slices = computed(() => {
  let offset = 0
  return props.summary.groups.map((group, index) => {
    const size = props.summary.report_count ? (group.count / props.summary.report_count) * 100 : 0
    const slice = { group, color: color(index), size, offset }
    offset += size
    return slice
  })
})
</script>
<template>
  <div class="space-y-7">
    <section class="surface-panel grid items-center gap-8 p-6 sm:grid-cols-[180px_1fr] sm:p-8">
      <div class="relative mx-auto size-40">
        <svg
          viewBox="0 0 42 42"
          class="size-full -rotate-90"
          role="img"
          :aria-label="`${t('可用報告')} ${summary.report_count}`"
        >
          <circle
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            stroke="hsl(var(--muted))"
            stroke-width="4"
          />
          <circle
            v-for="slice in slices"
            :key="slice.group.group_id"
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            :stroke="slice.color"
            stroke-width="4"
            :stroke-dasharray="`${slice.size} ${100 - slice.size}`"
            :stroke-dashoffset="-slice.offset"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <strong class="text-3xl font-medium">{{ summary.report_count }}</strong
          ><span class="mt-1 text-[11px] text-muted-foreground">{{ t('可用報告') }}</span>
        </div>
      </div>
      <div>
        <p class="eyebrow mb-2">PERSPECTIVES AT A GLANCE</p>
        <h2 class="text-lg font-bold">{{ t('全班觀點分布') }}</h2>
        <p class="mt-3 text-sm leading-7 text-muted-foreground">{{ summary.overview }}</p>
        <p class="mt-3 text-xs leading-6 text-muted-foreground">
          {{ summary.report_count }} / {{ summary.completed_count }} · {{ t('可用報告') }} /
          {{ t('完成對話')
          }}<template v-if="summary.ungrouped_count">
            · {{ t('未形成觀點') }} {{ summary.ungrouped_count }}</template
          >
        </p>
      </div>
    </section>
    <section class="surface-panel border-l-[3px] border-l-primary p-6 sm:p-8">
      <h2 class="mb-4 text-base font-bold">{{ t('觀點總結') }}</h2>
      <p class="text-sm leading-8">{{ summary.viewpoint_summary || summary.overview }}</p>
    </section>
    <div class="grid gap-4 md:grid-cols-2">
      <component
        :is="interactive ? 'button' : 'article'"
        v-for="(group, index) in summary.groups"
        :key="group.group_id"
        :type="interactive ? 'button' : undefined"
        :aria-label="interactive ? `篩選學生報告：${group.title}` : undefined"
        class="perspective-card"
        :class="{ 'is-interactive': interactive }"
        @click="interactive && $emit('group', group)"
        ><div class="mb-4 flex items-center gap-2">
          <span class="size-2 rounded-full" :style="{ background: color(index) }" /><span
            class="text-[10px] tracking-widest text-muted-foreground"
            >PERSPECTIVE {{ String(index + 1).padStart(2, '0') }}</span
          ><ArrowUpRight v-if="interactive" class="ml-auto size-4 text-muted-foreground" />
        </div>
        <h3 class="text-base font-bold leading-7">{{ group.title }}</h3>
        <p class="mb-6 mt-2 text-sm leading-7 text-muted-foreground">{{ group.description }}</p>
        <div class="mt-auto flex items-baseline justify-between">
          <span class="text-2xl font-medium"
            >{{ group.count
            }}<span class="ml-1.5 text-xs text-muted-foreground"
              >/ {{ summary.report_count }}</span
            ></span
          ><span class="text-sm text-muted-foreground">{{ group.percentage }}%</span>
        </div>
        <p v-if="interactive" class="mt-4 text-[11px] text-muted-foreground">
          點擊查看此 tag 的學生報告
        </p>
        <div class="mt-3 h-1 rounded-full bg-muted">
          <div
            class="h-1 rounded-full"
            :style="{ width: `${group.percentage}%`, background: color(index) }"
          /></div
      ></component>
    </div>
    <ViewpointTimeline
      v-if="showTimeline"
      :events="summary.viewpoint_timeline ?? []"
      :groups="summary.groups"
      :interactive="interactive"
      @group="emit('group', $event)"
    />
  </div>
</template>
