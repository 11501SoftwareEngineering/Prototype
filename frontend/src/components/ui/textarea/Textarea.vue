<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

/**
 * 多行輸入框。外觀跟 Input 一樣（Figma「input」元件），用在「課程描述」「輸入問題」。
 */
const props = defineProps<{
  class?: HTMLAttributes['class']
  placeholder?: string
  disabled?: boolean
  rows?: number
}>()

const modelValue = defineModel<string>()
</script>

<template>
  <textarea
    v-model="modelValue"
    data-slot="textarea"
    :rows="rows ?? 5"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="
      cn(
        'flex w-full resize-y rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground shadow-input',
        'placeholder:text-muted-foreground/70',
        'transition-colors hover:border-foreground focus-visible:border-foreground focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  />
</template>
