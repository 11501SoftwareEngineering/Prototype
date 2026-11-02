<script setup lang="ts">
/**
 * 公告首頁（未登入也看得到）。對應 Figma「Home」（node 1:9）。
 * 公告內容在 src/data/announcements.ts，不需要 API。
 */
import { computed } from 'vue'
import NewsCard from '@/components/common/NewsCard.vue'
import { announcements } from '@/data/announcements'

const sorted = computed(() =>
  [...announcements].sort((a, b) => b.published_at.localeCompare(a.published_at)),
)
</script>

<template>
  <div class="mx-auto w-full max-w-[960px] px-4 py-10 sm:py-12">
    <h1 class="mb-5 text-h1-title text-foreground">公告</h1>
    <p
      v-if="sorted.length === 0"
      role="status"
      class="rounded-2xl border border-dashed border-muted-foreground/40 px-6 py-10 text-center text-body-lg text-muted-foreground"
    >
      目前沒有公告
    </p>
    <ul v-else class="space-y-5">
      <li v-for="item in sorted" :key="item.id">
        <NewsCard :title="item.title" :content="item.content" :date="item.published_at" />
      </li>
    </ul>
  </div>
</template>
