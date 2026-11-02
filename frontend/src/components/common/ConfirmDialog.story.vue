<script setup lang="ts">
import { ref } from 'vue'
import { Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import ConfirmDialog from './ConfirmDialog.vue'

const openDelete = ref(false)
const openNormal = ref(false)
const openLoading = ref(true)
const log = ref('')
</script>

<template>
  <Story title="ConfirmDialog 確認對話框" group="common" :layout="{ type: 'single', iframe: true }">
    <Variant title="刪除（危險操作）">
      <div class="space-y-3 bg-background p-6">
        <Button variant="destructive" @click="openDelete = true">刪除 <Trash2 /></Button>
        <p class="text-caption text-muted-foreground">
          {{ log || '點按鈕打開對話框，按 Esc、點背景或「取消」都會關閉。' }}
        </p>
        <ConfirmDialog
          v-model:open="openDelete"
          title="確定要刪除這位老師嗎？"
          description="刪除後「王老師」將無法登入，這個動作無法復原。"
          confirm-text="刪除"
          destructive
          @confirm="((log = '已按下刪除'), (openDelete = false))"
        />
      </div>
    </Variant>

    <Variant title="一般確認">
      <div class="bg-background p-6">
        <Button variant="secondary" @click="openNormal = true">退出課程</Button>
        <ConfirmDialog
          v-model:open="openNormal"
          title="確定要退出「哲學概論」嗎？"
          description="退出後需要重新輸入邀請碼才能加入。"
          @confirm="openNormal = false"
        />
      </div>
    </Variant>

    <Variant title="送出中（按鈕不能再按）">
      <div class="h-80 bg-background p-6">
        <Button variant="destructive" @click="openLoading = true">再打開一次</Button>
        <ConfirmDialog
          v-model:open="openLoading"
          title="確定要刪除這位老師嗎？"
          description="處理中時按鈕會停用，避免重複送出。"
          confirm-text="刪除"
          destructive
          loading
        />
      </div>
    </Variant>
  </Story>
</template>
