<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

/**
 * 對應 Figma 的「input」元件（node 70:93 / 70:94）。
 *
 * Figma 原本用 state=Default / hover / Active 三個變體來表示樣式，
 * 但在網頁上滑鼠移過去（hover）跟被點選打字中（focus）本來就是瀏覽器
 * 原生會處理的狀態，所以這裡直接用 CSS 的 :hover / :focus 偽類來做，
 * 不用另外寫 props 去切換 class，元件用起來才會跟原生 <input> 一樣直覺。
 */

interface Props {
  class?: HTMLAttributes['class']
  type?: string
  placeholder?: string
  disabled?: boolean
}

const props = defineProps<Props>()

const modelValue = defineModel<string>()
</script>

<template>
  <input
    v-model="modelValue"
    data-slot="input"
    :type="type || 'text'"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="
      cn(
        // 版面尺寸與圓角：對齊 Figma 的 --radius/8 (8px)
        'flex h-[52px] w-full rounded-lg px-4 py-3 text-base',
        // 顏色：背景色 #F7F6F2 = bg-background，外框 #EBE9E1 = border-border
        'bg-background text-foreground border border-border',
        // Figma 的 input 內陰影 -> 對應 tailwind.config.js 的 boxShadow.input（同一個 Figma Effect style）
        'shadow-input',
        'placeholder:text-muted-foreground/70',
        // hover / Active(focus)：邊框轉為文字主色 #4F595D = border-foreground
        'transition-colors hover:border-foreground focus-visible:border-foreground focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  />
</template>
