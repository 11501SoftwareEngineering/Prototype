<script setup lang="ts" generic="T extends string | number">
/**
 * 單選選項（一排可以點的文字）。對應 Figma「新增問題」的年齡層、回合數。
 * 用原生 radio，鍵盤用方向鍵就能切換，螢幕報讀器也唸得出來。
 *
 * 用法：
 *   <OptionGroup v-model="ageRange" label="年齡層"
 *     :options="[{ value: '13-15', label: '13-15' }, …]" />
 */
import { useId } from 'vue'

defineProps<{
  label: string
  options: readonly { value: T; label: string }[]
  error?: string
}>()

const model = defineModel<T>()
const name = useId()
</script>

<template>
  <fieldset>
    <legend class="sr-only">{{ label }}</legend>
    <div class="grid gap-x-3 gap-y-1 sm:grid-cols-[9rem_1fr]">
      <span
        aria-hidden="true"
        class="text-header font-bold text-foreground sm:self-center sm:text-right"
        >{{ label }}：</span
      >
      <div class="flex flex-wrap gap-2">
        <label
          v-for="option in options"
          :key="option.value"
          class="cursor-pointer rounded-lg border border-transparent px-3 py-1.5 text-body-lg text-muted-foreground transition-colors hover:text-foreground has-[:checked]:border-border has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:shadow-elevated has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
        >
          <input v-model="model" type="radio" :name="name" :value="option.value" class="sr-only" />
          {{ option.label }}
        </label>
      </div>
      <p v-if="error" role="alert" class="text-right text-body text-destructive sm:col-start-2">
        {{ error }}
      </p>
    </div>
  </fieldset>
</template>
