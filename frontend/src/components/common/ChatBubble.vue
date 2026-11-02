<script setup lang="ts">
/**
 * 對話泡泡。對應 Figma 元件頁「Chat」（node 232:576）。
 *   Dir=Left（AI 導魷）：輔色淺底，左上角是尖角，頭像是魷魚
 *   Dir=Right（學生）：主色淺底，右上角是尖角，頭像是空白圓圈
 *
 * 用法：
 *   <ChatBubble from="ai">什麼是正義？</ChatBubble>
 *   <ChatBubble from="student">我覺得是公平。</ChatBubble>
 *   <ChatBubble from="ai" pending />   AI 還在回覆（串流中）時顯示「…」動畫
 */
import { computed } from 'vue'
import logoIconUrl from '@/assets/brand/logo-icon.svg'

const props = withDefaults(
  defineProps<{
    from: 'ai' | 'student'
    /** 顯示在頭像旁的名字，預設「導魷」／「學生」 */
    name?: string
    /** AI 正在輸入中 */
    pending?: boolean
  }>(),
  { pending: false },
)

const isAi = computed(() => props.from === 'ai')
const displayName = computed(() => props.name ?? (isAi.value ? '導魷' : '學生'))
</script>

<template>
  <div
    class="flex w-full max-w-[750px] flex-col gap-2"
    :class="isAi ? 'items-start self-start' : 'items-end self-end'"
  >
    <div class="flex items-center gap-2" :class="!isAi && 'flex-row-reverse'">
      <span
        class="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card"
        :class="isAi ? 'border-secondary' : 'border-muted-foreground'"
        aria-hidden="true"
      >
        <img v-if="isAi" :src="logoIconUrl" alt="" class="h-7 w-auto" />
      </span>
      <span class="text-body-lg text-foreground">{{ displayName }}</span>
    </div>

    <div
      class="w-full px-4 py-2.5 text-body break-words whitespace-pre-line text-foreground"
      :class="
        isAi ? 'rounded-2xl rounded-tl bg-secondary/80' : 'rounded-2xl rounded-tr bg-primary/80'
      "
    >
      <span v-if="pending" class="inline-flex gap-1 py-2" role="status" aria-label="導魷正在思考">
        <span
          v-for="i in 3"
          :key="i"
          class="size-2 animate-bounce rounded-full bg-foreground/50"
          :style="{ animationDelay: `${(i - 1) * 150}ms` }"
        />
      </span>
      <slot v-else />
    </div>
  </div>
</template>
