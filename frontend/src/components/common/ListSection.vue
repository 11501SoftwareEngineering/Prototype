<script setup lang="ts">
/**
 * 列表區塊：大標題 → 搜尋框＋主要按鈕 → 卡片列表。
 * Figma 的「我的課程」「問題列表」「老師管理」「結果列表」「學生列表」都是這個排法。
 * 手機寬度時，按鈕會換到搜尋框下面、靠右。
 *
 * 用法：
 *   <ListSection v-model:search="keyword" title="我的課程" search-label="搜尋課程">
 *     <template #actions><Button>新增課程 <AddRingIcon /></Button></template>
 *     <template #toolbar>（標題和搜尋框中間的東西，例如統計數字）</template>
 *     <QueryState …><ListCard … /></QueryState>
 *   </ListSection>
 */
import SearchInput from '@/components/common/SearchInput.vue'

withDefaults(
  defineProps<{
    title: string
    searchLabel?: string
    /** 標題用 h1（整頁只有一個列表）還是 h2（一頁有兩個列表） */
    level?: 1 | 2
  }>(),
  { searchLabel: '搜尋', level: 1 },
)

const search = defineModel<string>('search', { default: '' })
</script>

<template>
  <section class="min-w-0">
    <div class="mb-2 flex items-center justify-between gap-4">
      <component :is="`h${level}`" class="text-h1-title text-foreground">{{ title }}</component>
      <div v-if="$slots.heading" class="flex shrink-0 items-center gap-2">
        <slot name="heading" />
      </div>
    </div>
    <div v-if="$slots.toolbar" class="mb-3">
      <slot name="toolbar" />
    </div>
    <div class="mb-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
      <SearchInput v-model="search" :label="searchLabel" class="sm:flex-1" />
      <div v-if="$slots.actions" class="flex shrink-0 justify-end gap-3">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </section>
</template>
