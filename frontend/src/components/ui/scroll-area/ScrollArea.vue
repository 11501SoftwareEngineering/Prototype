<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()

const viewport = ref<HTMLElement | null>(null)

// 這是簡化版的 ScrollArea(純瀏覽器原生 overflow-y-auto),不是 shadcn-vue 官方版本
// (官方版本用 reka-ui 的 ScrollArea primitive 做自訂捲軸樣式)。
// 之後想要更漂亮的自訂捲軸,可以在自己電腦上執行:
//   pnpm dlx shadcn-vue@latest add scroll-area
// 執行後這個檔案會被換成官方版本,用法(class 跟 <slot/>)不會變。
defineExpose({ viewport })
</script>

<template>
  <div ref="viewport" data-slot="scroll-area" :class="cn('overflow-y-auto', props.class)">
    <slot />
  </div>
</template>
