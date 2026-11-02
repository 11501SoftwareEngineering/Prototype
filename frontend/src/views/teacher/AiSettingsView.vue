<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { ArrowLeft, KeyRound, ShieldCheck } from '@lucide/vue'
import { teacherAiApi, teacherAiKeys } from '@/api/teacherAi'
import ModelUsagePanel from '@/components/teacher/ModelUsagePanel.vue'
import QueryState from '@/components/common/QueryState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { Button } from '@/components/ui/button'
const client = useQueryClient(),
  apiKey = ref(''),
  notice = ref(''),
  error = ref(''),
  removeOpen = ref(false)
const query = useQuery({
  queryKey: teacherAiKeys.settings,
  queryFn: teacherAiApi.getSettings,
  staleTime: 0,
})
const saving = useMutation({
  mutationFn: () => {
    const value = apiKey.value.trim()
    apiKey.value = ''
    return teacherAiApi.setKey(value)
  },
  onSuccess: (settings) => {
    client.setQueryData(teacherAiKeys.settings, settings)
    notice.value = settings.is_demo ? '已更新示範設定狀態，未保存實際金鑰。' : '已儲存 API key。'
    error.value = ''
  },
  onError: () => (error.value = '無法儲存 API key，請確認金鑰後再試。'),
})
const removing = useMutation({
  mutationFn: teacherAiApi.removeKey,
  onSuccess: (settings) => {
    client.setQueryData(teacherAiKeys.settings, settings)
    removeOpen.value = false
    notice.value = '已移除 API key 設定。'
    error.value = ''
  },
  onError: () => (error.value = '無法移除設定，請稍後再試。'),
})
</script>
<template>
  <div class="inquiry-content max-w-5xl">
    <RouterLink
      :to="{ name: 'TeacherCourses' }"
      class="mb-7 inline-flex items-center gap-2 text-xs text-muted-foreground"
      ><ArrowLeft class="size-3.5" />我的課程</RouterLink
    >
    <p class="eyebrow mb-2">YOUR AI SETTINGS</p>
    <h1 class="workspace-title mb-3">AI 用量與 OpenRouter 金鑰</h1>
    <p class="mb-8 text-sm leading-7 text-muted-foreground">
      查看本帳號的 token 使用量，設定課程 AI 使用的 API key。
    </p>
    <ModelUsagePanel detailed />
    <section class="surface-panel p-6 sm:p-8">
      <h2 class="mb-5 flex items-center gap-2 text-base font-bold">
        <KeyRound class="size-4" />OpenRouter API key
      </h2>
      <QueryState
        :loading="query.isPending.value"
        :error="query.error.value"
        @retry="query.refetch()"
        ><div class="mb-6 flex flex-wrap items-center gap-3 text-xs">
          <span class="status-tag" :class="query.data.value?.configured ? 'published' : ''">{{
            query.data.value?.configured ? '已設定' : '尚未設定'
          }}</span
          ><span v-if="query.data.value?.masked_key" class="font-mono text-muted-foreground">{{
            query.data.value.masked_key
          }}</span>
        </div>
        <p
          v-if="query.data.value?.is_demo"
          class="mb-5 rounded-lg bg-primary/10 px-4 py-3 text-xs leading-7"
        >
          示範模式僅保存設定狀態，請使用測試文字。
        </p>
        <form @submit.prevent="saving.mutate()">
          <label for="teacher-api-key" class="field-label">{{
            query.data.value?.configured ? '輸入新的 OpenRouter API key' : '填入 OpenRouter API key'
          }}</label
          ><input
            id="teacher-api-key"
            v-model="apiKey"
            type="password"
            autocomplete="off"
            autocapitalize="off"
            :spellcheck="false"
            maxlength="1024"
            class="workspace-input font-mono"
            placeholder="輸入 OpenRouter API key"
            :disabled="saving.isPending.value || removing.isPending.value"
          />
          <p class="mt-3 flex items-start gap-2 text-[11px] leading-7 text-muted-foreground">
            <ShieldCheck
              class="mt-1 size-3.5 shrink-0"
            />金鑰送出後會清空輸入欄位，不寫入網址或瀏覽器的持久化資料，助教不會取得金鑰。
          </p>
          <div class="mt-6 flex flex-wrap justify-end gap-3">
            <Button
              v-if="query.data.value?.configured"
              type="button"
              variant="outline"
              :disabled="saving.isPending.value || removing.isPending.value"
              @click="removeOpen = true"
              >移除設定</Button
            ><Button
              type="submit"
              :disabled="
                apiKey.trim().length < 10 || saving.isPending.value || removing.isPending.value
              "
              >{{ saving.isPending.value ? '儲存中' : '儲存 API key' }}</Button
            >
          </div>
        </form></QueryState
      >
      <p v-if="notice" role="status" class="mt-5 text-xs leading-7 text-chart-1">{{ notice }}</p>
      <p v-if="error" role="alert" class="mt-5 text-xs leading-7 text-destructive">{{ error }}</p>
    </section>
    <ConfirmDialog
      v-model:open="removeOpen"
      title="移除 API key 設定？"
      description="移除後需要重新設定金鑰，課程、對話與報告會保留。"
      confirm-text="移除設定"
      destructive
      :loading="removing.isPending.value"
      :error="error"
      @confirm="removing.mutate()"
    />
  </div>
</template>
