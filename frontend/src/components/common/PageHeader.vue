<script setup lang="ts">
/**
 * 頁面標題列：左邊大標題（可加說明），右邊放這一頁的主要操作。
 * 對應 Figma 各頁最上方的「老師管理」「我的課程」標題。
 *
 * 用法：
 *   <PageHeader title="老師管理" />
 *
 *   <PageHeader title="我的課程" description="輸入邀請碼加入新課程">
 *     <template #actions><Button size="sm">加入課程 <CirclePlus /></Button></template>
 *   </PageHeader>
 */
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0">
      <h1 class="text-h1-title font-bold text-foreground">{{ title }}</h1>
      <p v-if="description" class="mt-2 text-body text-muted-foreground">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-3">
      <slot name="actions" />
    </div>
  </header>
</template>
