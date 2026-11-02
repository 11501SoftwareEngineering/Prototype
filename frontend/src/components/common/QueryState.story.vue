<script setup lang="ts">
import { reactive } from 'vue'
import { Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import ListCard from './ListCard.vue'
import QueryState from './QueryState.vue'

const teachers = [
  { id: '1', account: 'wang', name: '王老師' },
  { id: '2', account: 'lin', name: '林老師' },
]
const state = reactive({ mode: '有資料' as '載入中' | '錯誤' | '沒有資料' | '有資料' })
const apiError = { isAxiosError: true, response: { data: { detail: '非管理員無權存取' } } }
</script>

<template>
  <Story
    title="QueryState 載入／錯誤／空資料"
    group="common"
    :layout="{ type: 'single', iframe: true }"
  >
    <Variant title="切換狀態（右側調整）">
      <div class="bg-background p-6">
        <QueryState
          :loading="state.mode === '載入中'"
          :error="state.mode === '錯誤' ? new Error('network') : null"
          :empty="state.mode === '沒有資料'"
          empty-text="目前還沒有老師帳號"
          error-text="無法取得老師列表"
        >
          <ListCard
            v-for="t in teachers"
            :key="t.id"
            :title="`帳號：${t.account}`"
            :description="t.name"
          >
            <template #actions
              ><Button variant="destructive">刪除 <Trash2 /></Button
            ></template>
          </ListCard>
        </QueryState>
      </div>
      <template #controls>
        <HstSelect
          v-model="state.mode"
          title="狀態"
          :options="['載入中', '錯誤', '沒有資料', '有資料']"
        />
      </template>
    </Variant>

    <Variant title="載入中（骨架卡片）">
      <div class="bg-background p-6"><QueryState loading /></div>
    </Variant>

    <Variant title="錯誤：顯示後端回傳的訊息">
      <div class="bg-background p-6"><QueryState :error="apiError" /></div>
    </Variant>

    <Variant title="錯誤：網路斷線（顯示預設訊息）">
      <div class="bg-background p-6">
        <QueryState :error="new Error('Network Error')" error-text="無法連線，請稍後再試" />
      </div>
    </Variant>

    <Variant title="沒有資料">
      <div class="bg-background p-6"><QueryState empty empty-text="目前還沒有加入任何課程" /></div>
    </Variant>
  </Story>
</template>
