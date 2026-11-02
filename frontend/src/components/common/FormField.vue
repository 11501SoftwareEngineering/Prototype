<script setup lang="ts">
/**
 * 表單欄位：左邊粗體標籤「帳號：」，右邊輸入框，下面右對齊顯示提示或錯誤訊息。
 * 對應 Figma 登入、註冊、新增課程等畫面的欄位排法；手機寬度時標籤會換到輸入框上面。
 *
 * 用法（slot 會給你 id 和 aria 屬性，綁到輸入框上）：
 *   <FormField label="帳號" hint="英文或數字" :error="errors.account">
 *     <template #default="field">
 *       <Input v-model="account" v-bind="field" autocomplete="username" />
 *     </template>
 *   </FormField>
 */
import { computed, useId } from 'vue'

const props = defineProps<{
  label: string
  hint?: string
  error?: string
  /** 標籤要不要跟輸入框頂端對齊（多行輸入框用） */
  alignTop?: boolean
}>()

const id = useId()
const messageId = `${id}-message`
const message = computed(() => props.error || props.hint)
const fieldAttrs = computed(() => ({
  id,
  'aria-invalid': props.error ? true : undefined,
  'aria-describedby': message.value ? messageId : undefined,
}))
</script>

<template>
  <div class="grid gap-x-3 gap-y-1 sm:grid-cols-[9rem_1fr]">
    <label
      :for="id"
      class="text-header font-bold text-foreground sm:text-right"
      :class="alignTop ? 'sm:pt-3' : 'sm:self-center'"
    >
      {{ label }}：
    </label>
    <slot v-bind="fieldAttrs" />
    <p
      v-if="message"
      :id="messageId"
      :role="error ? 'alert' : undefined"
      class="text-right text-body sm:col-start-2"
      :class="error ? 'text-destructive' : 'text-muted-foreground'"
    >
      {{ message }}
    </p>
  </div>
</template>
