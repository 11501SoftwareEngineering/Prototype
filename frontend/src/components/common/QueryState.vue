<script setup lang="ts">
/**
 * 統一處理「載入中 / 錯誤 / 沒有資料」三種狀態，資料準備好才顯示內容。
 * 每個從 API 拿資料的頁面都用它包起來，就不會漏掉任何一種狀態。
 *
 * 用法（搭配 useQuery）：
 *   const { data, isPending, isError, error, refetch } = useQuery(...)
 *
 *   <QueryState
 *     :loading="isPending" :error="isError ? error : null"
 *     :empty="data?.length === 0" empty-text="目前還沒有老師帳號"
 *     @retry="refetch()"
 *   >
 *     <ListCard v-for="t in data" ... />
 *   </QueryState>
 *
 * 想自訂某個狀態的畫面，可以用 #loading、#error、#empty 這三個 slot 覆蓋。
 */
import { computed } from 'vue'
import { CircleAlert, Inbox } from '@lucide/vue'
import { RefreshIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    /** 有錯誤時傳入錯誤物件（例如 useQuery 的 error），沒有錯誤傳 null */
    error?: unknown
    empty?: boolean
    emptyText?: string
    errorText?: string
    /** 載入中要顯示幾張骨架卡片 */
    skeletonCount?: number
  }>(),
  {
    loading: false,
    error: undefined,
    empty: false,
    emptyText: '目前沒有資料',
    errorText: '無法載入資料，請稍後再試',
    skeletonCount: 3,
  },
)

defineEmits<{ retry: [] }>()

const errorMessage = computed(() => getApiErrorMessage(props.error, props.errorText))
</script>

<template>
  <!-- 載入中 -->
  <div v-if="loading" role="status" aria-live="polite" class="space-y-3">
    <span class="sr-only">載入中…</span>
    <slot name="loading">
      <div
        v-for="i in skeletonCount"
        :key="i"
        class="flex animate-pulse items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-elevated"
        aria-hidden="true"
      >
        <div class="w-full space-y-3">
          <div class="h-5 w-2/5 rounded bg-muted" />
          <div class="h-4 w-1/4 rounded bg-muted" />
        </div>
        <div class="h-[34px] w-24 shrink-0 rounded-lg bg-muted" />
      </div>
    </slot>
  </div>

  <!-- 錯誤 -->
  <div
    v-else-if="error"
    role="alert"
    class="flex flex-col items-center gap-4 rounded-2xl border border-destructive bg-card px-6 py-10 shadow-elevated text-center"
  >
    <slot name="error" :message="errorMessage">
      <CircleAlert class="size-10 text-destructive" aria-hidden="true" />
      <p class="text-body-lg text-foreground">{{ errorMessage }}</p>
      <Button variant="secondary" @click="$emit('retry')">
        重新載入
        <RefreshIcon />
      </Button>
    </slot>
  </div>

  <!-- 沒有資料 -->
  <div
    v-else-if="empty"
    class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-muted-foreground/40 bg-card/60 px-6 py-10 text-center"
  >
    <slot name="empty">
      <Inbox class="size-10 text-muted-foreground" aria-hidden="true" />
      <p class="text-body-lg text-muted-foreground">{{ emptyText }}</p>
    </slot>
  </div>

  <!-- 有資料 -->
  <div v-else class="space-y-3">
    <slot />
  </div>
</template>
