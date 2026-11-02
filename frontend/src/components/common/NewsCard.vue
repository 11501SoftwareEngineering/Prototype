<script setup lang="ts">
/**
 * 公告卡片。對應 Figma 元件頁「Card_News」（node 70:203）。
 *   標題（H4 20px）＋右上角日期（Caption 14px）＋內文（Body2 16px）
 *   收合時內文只顯示一行，點卡片展開全文，再點一次收合
 *
 * 用法：
 *   <NewsCard v-for="a in announcements" :key="a.id"
 *     :title="a.title" :date="a.published_at" :content="a.content" />
 */
import type { HTMLAttributes } from 'vue'
import { computed, useId } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  title: string
  content: string
  /** ISO 日期字串，會用台北時區顯示成 YYYY-MM-DD */
  date?: string
  class?: HTMLAttributes['class']
}>()

const expanded = defineModel<boolean>('expanded', { default: false })
const contentId = useId()

const displayDate = computed(() => {
  if (!props.date) return ''
  const d = new Date(props.date)
  if (Number.isNaN(d.getTime())) return props.date
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
})
</script>

<template>
  <article
    :class="
      cn(
        'relative rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-elevated transition-colors',
        'hover:border-[1.5px] hover:border-muted-foreground hover:bg-background focus-within:ring-[3px] focus-within:ring-ring/50',
        props.class,
      )
    "
  >
    <div class="flex items-start justify-between gap-4 p-[5px] pb-2">
      <h3 class="min-w-0">
        <button
          type="button"
          class="text-left text-h2-title text-foreground outline-none after:absolute after:inset-0 after:rounded-2xl"
          :aria-expanded="expanded"
          :aria-controls="contentId"
          @click="expanded = !expanded"
        >
          {{ title }}
        </button>
      </h3>
      <time
        v-if="displayDate"
        :datetime="date"
        class="shrink-0 pt-0.5 text-caption text-muted-foreground"
      >
        {{ displayDate }}
      </time>
    </div>
    <p
      :id="contentId"
      class="px-[5px] text-body whitespace-pre-line text-muted-foreground"
      :class="!expanded && 'line-clamp-1'"
    >
      {{ content }}
    </p>
  </article>
</template>
