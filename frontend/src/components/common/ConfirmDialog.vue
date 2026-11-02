<script setup lang="ts">
/**
 * 確認對話框：刪除、退出課程這類「做了就回不去」的操作，一定要先問一次。
 *
 * 用法：
 *   const deleteOpen = ref(false)
 *   const deleting = ref<Teacher | null>(null)
 *   function askDelete(t: Teacher) { deleting.value = t; deleteOpen.value = true }
 *
 *   <ConfirmDialog
 *     v-model:open="deleteOpen"
 *     title="確定要刪除這位老師嗎？"
 *     :description="`刪除後「${deleting?.name}」將無法登入，這個動作無法復原。`"
 *     confirm-text="刪除" destructive
 *     :loading="deleteMutation.isPending.value"
 *     @confirm="deleteMutation.mutate(deleting!.id, { onSuccess: () => (deleteOpen = false) })"
 *   />
 *
 * - loading 時按鈕會變成「處理中…」並且不能再按，避免重複送出
 * - 按 Esc、點背景或「取消」都會關閉
 * - 開啟時焦點會移到對話框裡，關閉後回到原本的按鈕（reka-ui 自動處理）
 */
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

withDefaults(
  defineProps<{
    title: string
    description?: string
    confirmText?: string
    cancelText?: string
    /** 危險操作（刪除）：確認按鈕改用紅色 */
    destructive?: boolean
    loading?: boolean
    /** 操作失敗時顯示的錯誤訊息 */
    error?: string
  }>(),
  { confirmText: '確定', cancelText: '取消', destructive: false, loading: false },
)

const open = defineModel<boolean>('open', { default: false })
defineEmits<{ confirm: [] }>()
</script>

<template>
  <!-- 版面對應 Figma「Comfire」（node 266:2383）：置中標題＋說明，下方「取消」「確認」 -->
  <Dialog v-model:open="open">
    <DialogContent
      :show-close-button="false"
      class="w-[calc(100%-2rem)] gap-6 rounded-2xl border border-border bg-card p-6 shadow-elevated sm:max-w-[404px] sm:p-8"
    >
      <DialogHeader class="gap-3 text-center sm:text-center">
        <DialogTitle class="text-h1-title text-foreground">{{ title }}</DialogTitle>
        <DialogDescription
          v-if="description || $slots.default"
          class="text-body-lg text-muted-foreground"
        >
          <slot>{{ description }}</slot>
        </DialogDescription>
      </DialogHeader>

      <p v-if="error" role="alert" class="text-center text-body text-destructive">{{ error }}</p>

      <DialogFooter class="flex-row justify-center gap-4 sm:justify-center">
        <DialogClose as-child>
          <Button variant="secondary" size="lg" :disabled="loading">{{ cancelText }}</Button>
        </DialogClose>
        <Button
          :variant="destructive ? 'destructive' : 'default'"
          size="lg"
          :disabled="loading"
          @click="$emit('confirm')"
        >
          {{ loading ? '處理中…' : confirmText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
