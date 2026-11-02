<script setup lang="ts">
/**
 * 搜尋框。對應 Figma 元件頁「SearchBar」（node 234:1210）。
 *   Default：白底、#EBE9E1 外框、外陰影、圓角 16px、高 36px
 *   Hover / Active（輸入中）：外框變成文字輔色 #787973
 *
 * 用法：
 *   <SearchInput v-model="keyword" label="搜尋老師" />
 *
 * - 按 ⊗ 或 Esc 會清空，焦點留在輸入框
 * - label 給螢幕報讀器用（畫面上不顯示），placeholder 不能取代 label
 */
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'
import { CloseRingIcon, SearchIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    label?: string
    placeholder?: string
    disabled?: boolean
    class?: HTMLAttributes['class']
  }>(),
  { label: '搜尋', placeholder: '搜尋' },
)

const keyword = defineModel<string>({ default: '' })
const inputRef = ref<HTMLInputElement | null>(null)

function handleClear() {
  keyword.value = ''
  inputRef.value?.focus()
}
</script>

<template>
  <div
    :class="
      cn(
        'flex h-9 w-full items-center gap-1 rounded-2xl border border-border bg-card p-2 shadow-elevated transition-colors',
        'hover:border-muted-foreground focus-within:border-muted-foreground focus-within:ring-[3px] focus-within:ring-ring/50',
        disabled && 'pointer-events-none opacity-50',
        props.class,
      )
    "
  >
    <SearchIcon class="size-6 shrink-0" />
    <input
      ref="inputRef"
      v-model="keyword"
      type="search"
      :aria-label="label"
      :placeholder="placeholder"
      :disabled="disabled"
      class="min-w-0 flex-1 bg-transparent text-body-lg text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
      @keydown.esc="handleClear"
    />
    <button
      type="button"
      aria-label="清除搜尋"
      :disabled="disabled || !keyword"
      class="flex size-6 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 enabled:hover:brightness-75"
      @click="handleClear"
    >
      <CloseRingIcon class="size-6" />
    </button>
  </div>
</template>
