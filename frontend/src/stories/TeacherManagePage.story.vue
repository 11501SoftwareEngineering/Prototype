<script setup lang="ts">
/**
 * 頁面範例：用元件組出老師管理頁（對照 Figma「管理帳號」畫面）。
 * 實際頁面把假資料換成 useQuery 拿到的資料即可，結構完全一樣。
 */
import { computed, reactive, ref } from 'vue'
import { RotateCw, Trash2 } from '@lucide/vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ListCard from '@/components/common/ListCard.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import QueryState from '@/components/common/QueryState.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import { AddRingIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

const state = reactive({ mode: '有資料' as '載入中' | '錯誤' | '沒有資料' | '有資料' })
const teachers = ref([
  { id: '1', account: 'wang', name: '王老師' },
  { id: '2', account: 'lin', name: '林老師' },
  { id: '3', account: 'chen', name: '陳老師' },
])
const keyword = ref('')
const filtered = computed(() =>
  teachers.value.filter((t) =>
    `${t.account}${t.name}`.toLowerCase().includes(keyword.value.trim().toLowerCase()),
  ),
)
const deleteOpen = ref(false)
const deleting = ref<{ id: string; name: string } | null>(null)
function askDelete(t: { id: string; name: string }) {
  deleting.value = t
  deleteOpen.value = true
}
function doDelete() {
  teachers.value = teachers.value.filter((t) => t.id !== deleting.value?.id)
  deleteOpen.value = false
}
</script>

<template>
  <Story title="老師管理頁" group="patterns" :layout="{ type: 'single', iframe: true }">
    <Variant title="完整頁面">
      <div class="min-h-[600px] bg-background px-4 py-10">
        <div class="mx-auto max-w-[960px]">
          <PageHeader title="老師管理" />
          <div class="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
            <SearchInput v-model="keyword" label="搜尋老師" />
            <Button class="shrink-0 self-end sm:self-auto">新增老師 <AddRingIcon /></Button>
          </div>
          <QueryState
            :loading="state.mode === '載入中'"
            :error="state.mode === '錯誤' ? new Error('x') : null"
            :empty="state.mode === '沒有資料' || filtered.length === 0"
            :empty-text="keyword ? '找不到符合的老師' : '目前還沒有老師帳號'"
            error-text="無法取得老師列表"
          >
            <ListCard
              v-for="t in state.mode === '沒有資料' ? [] : filtered"
              :key="t.id"
              :title="`帳號：${t.account}`"
              :description="t.name"
            >
              <template #actions>
                <Button variant="secondary">重設密碼 <RotateCw /></Button>
                <Button variant="destructive" @click="askDelete(t)">刪除 <Trash2 /></Button>
              </template>
            </ListCard>
          </QueryState>
        </div>
        <ConfirmDialog
          v-model:open="deleteOpen"
          title="確定要刪除這位老師嗎？"
          :description="`刪除後「${deleting?.name}」將無法登入，這個動作無法復原。`"
          confirm-text="刪除"
          destructive
          @confirm="doDelete"
        />
      </div>
      <template #controls>
        <HstSelect
          v-model="state.mode"
          title="資料狀態"
          :options="['載入中', '錯誤', '沒有資料', '有資料']"
        />
      </template>
    </Variant>
  </Story>
</template>
