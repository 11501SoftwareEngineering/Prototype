<script setup lang="ts">
import { ref } from 'vue'
import NewsCard from './NewsCard.vue'

const longText = '公告內文'.repeat(60)
const open = ref(true)
</script>

<template>
  <Story title="NewsCard 公告卡片" group="common" :layout="{ type: 'single', iframe: true }">
    <Variant title="對照 Figma：收合（點卡片展開）">
      <div class="space-y-4 bg-background p-6">
        <NewsCard title="公告標題" date="2026-10-23T09:00:00+08:00" :content="longText" />
        <NewsCard
          title="系統維護公告"
          date="2026-10-20T09:00:00+08:00"
          content="10/25（六）凌晨 2:00～4:00 進行系統維護，期間暫停服務。"
        />
      </div>
    </Variant>

    <Variant title="對照 Figma：展開">
      <div class="bg-background p-6">
        <NewsCard
          v-model:expanded="open"
          title="公告標題"
          date="2026-10-23T09:00:00+08:00"
          :content="longText"
        />
      </div>
    </Variant>

    <Variant title="沒有日期 / 有換行">
      <div class="space-y-4 bg-background p-6">
        <NewsCard title="沒有日期的公告" content="只有標題和內文。" />
        <NewsCard
          v-model:expanded="open"
          title="有換行的公告"
          :content="'第一行\n第二行\n第三行'"
        />
      </div>
    </Variant>
  </Story>
</template>
