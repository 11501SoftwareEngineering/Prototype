<script setup lang="ts">
/**
 * 表單對話框。對應 Figma「新增課程」「新增問題」「新增結論」「建立教師帳號」「加入課程」。
 *   置中大標題 → 欄位 → 錯誤訊息（右對齊紅字）→ 右下角「取消」「新增」兩個大按鈕
 *
 * 用法：
 *   <FormDialog v-model:open="open" title="新增課程" submit-text="新增"
 *     :loading="mutation.isPending.value" :error="formError" @submit="handleSubmit">
 *     <FormField label="課程名稱" v-slot="field"><Input v-model="name" v-bind="field" /></FormField>
 *   </FormDialog>
 *
 * - 按 Enter 會送出（原生 <form>），Esc 或「取消」關閉
 * - loading 時按鈕變成「處理中…」且不能重複送出
 * - :dismissible="false"：不能用 Esc、點背景關閉，「取消」按鈕改成發出 cancel 事件（強制改密碼用）
 */
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

withDefaults(
  defineProps<{
    title: string
    description?: string
    submitText?: string
    cancelText?: string
    loading?: boolean
    /** 整個表單層級的錯誤（例如後端回傳的錯誤），顯示在按鈕上方 */
    error?: string
    dismissible?: boolean
  }>(),
  { submitText: '新增', cancelText: '取消', loading: false, dismissible: true },
)

const open = defineModel<boolean>('open', { default: false })
defineEmits<{ submit: []; cancel: [] }>()

function preventIfLocked(event: Event, dismissible: boolean) {
  if (!dismissible) event.preventDefault()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :show-close-button="false"
      @escape-key-down="preventIfLocked($event, dismissible)"
      @interact-outside="preventIfLocked($event, dismissible)"
      class="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-elevated sm:max-w-[626px] sm:p-10"
    >
      <DialogTitle class="text-center text-h1-title text-foreground">{{ title }}</DialogTitle>
      <DialogDescription
        :class="description ? 'mt-2 text-center text-body text-muted-foreground' : 'sr-only'"
      >
        {{ description || title }}
      </DialogDescription>

      <form class="mt-8 flex flex-col gap-5" novalidate @submit.prevent="$emit('submit')">
        <slot />

        <p v-if="error" role="alert" class="text-right text-body text-destructive">{{ error }}</p>

        <div class="mt-2 flex justify-end gap-4">
          <DialogClose v-if="dismissible" as-child>
            <Button type="button" variant="secondary" size="lg" :disabled="loading">
              {{ cancelText }}
            </Button>
          </DialogClose>
          <Button
            v-else
            type="button"
            variant="secondary"
            size="lg"
            :disabled="loading"
            @click="$emit('cancel')"
          >
            {{ cancelText }}
          </Button>
          <Button type="submit" size="lg" :disabled="loading">
            {{ loading ? '處理中…' : submitText }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
