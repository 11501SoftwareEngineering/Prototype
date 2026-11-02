<script setup lang="ts">
/**
 * 顯示一次性初始密碼（建立老師帳號、重設密碼之後）。
 * 後端只會回傳這一次，關掉就看不到了，所以提供「複製」按鈕。
 */
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

const props = defineProps<{
  title: string
  account: string
  name: string
  password: string
}>()

const open = defineModel<boolean>('open', { default: false })
const copied = ref(false)

watch(
  () => props.password,
  () => (copied.value = false),
)

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(`帳號：${props.account}\n密碼：${props.password}`)
    copied.value = true
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :show-close-button="false"
      class="w-[calc(100%-2rem)] gap-6 rounded-2xl border border-border bg-card p-6 shadow-elevated sm:max-w-md sm:p-8"
    >
      <DialogTitle class="text-center text-h1-title text-foreground">{{ title }}</DialogTitle>
      <DialogDescription class="text-center text-body text-muted-foreground">
        請把初始密碼交給{{ name }}。這組密碼只會顯示這一次，對方第一次登入後需要改密碼。
      </DialogDescription>
      <dl
        class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg bg-background p-4 text-body-lg"
      >
        <dt class="text-muted-foreground">帳號</dt>
        <dd class="break-all font-bold text-foreground">{{ account }}</dd>
        <dt class="text-muted-foreground">初始密碼</dt>
        <dd class="break-all font-mono font-bold text-foreground">{{ password }}</dd>
      </dl>
      <div class="flex justify-end gap-4">
        <Button variant="secondary" @click="handleCopy">{{ copied ? '已複製' : '複製' }}</Button>
        <Button @click="open = false">完成</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
