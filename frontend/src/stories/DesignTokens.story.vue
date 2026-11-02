<script setup lang="ts">
/**
 * 設計規範總覽：寫畫面前先來這裡找顏色、字級和陰影，不要自己發明新的數值。
 * 數值來源：src/assets/main.css（顏色）、tailwind.config.js（字級、陰影）。
 */
const colors = [
  { name: 'background', usage: '頁面背景', className: 'bg-background' },
  { name: 'foreground', usage: '主要文字', className: 'bg-foreground' },
  { name: 'card', usage: '卡片、對話框背景', className: 'bg-card' },
  { name: 'primary', usage: '主要按鈕、Header', className: 'bg-primary' },
  { name: 'secondary', usage: '次要按鈕、Footer', className: 'bg-secondary' },
  { name: 'muted', usage: '骨架、停用背景', className: 'bg-muted' },
  { name: 'muted-foreground', usage: '次要文字、說明', className: 'bg-muted-foreground' },
  { name: 'destructive', usage: '刪除、錯誤', className: 'bg-destructive' },
  { name: 'border', usage: '邊框、分隔線', className: 'bg-border' },
]

const textStyles = [
  { name: 'text-h1-title', usage: '頁面大標題、大按鈕', sample: '老師管理' },
  { name: 'text-header', usage: 'Header 文字、小按鈕', sample: '新增老師' },
  { name: 'text-footer', usage: 'Footer 連結', sample: '隱私權　版權　開發者' },
  { name: 'text-h2-title', usage: '卡片標題、對話框標題', sample: '帳號：teacher01' },
  { name: 'text-body-lg', usage: '大段內文', sample: '蘇格拉底式提問引導學生思考。' },
  { name: 'text-body', usage: '一般內文、說明文字', sample: '預設密碼：只會在建立時顯示一次' },
  { name: 'text-caption', usage: '註解、時間', sample: '2026-10-23 發布' },
]

const shadows = [
  { name: 'shadow-elevated', usage: '卡片、實心按鈕' },
  { name: 'shadow-input', usage: '輸入框（內陰影）' },
]
</script>

<template>
  <Story title="色票與字級" group="tokens" :layout="{ type: 'single', iframe: true }">
    <Variant title="顏色">
      <div class="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
        <div
          v-for="c in colors"
          :key="c.name"
          class="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div :class="c.className" class="h-16 border-b border-border" />
          <div class="space-y-1 p-3">
            <code class="text-body font-bold text-foreground">{{ c.className }}</code>
            <p class="text-caption text-muted-foreground">{{ c.usage }}</p>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="字級">
      <div class="space-y-6 p-6">
        <div v-for="t in textStyles" :key="t.name" class="border-b border-border pb-4">
          <p :class="t.name" class="text-foreground">{{ t.sample }}</p>
          <p class="mt-1 text-caption text-muted-foreground">
            <code>{{ t.name }}</code
            >　{{ t.usage }}
          </p>
        </div>
      </div>
    </Variant>

    <Variant title="陰影與圓角">
      <div class="flex flex-wrap gap-6 bg-background p-6">
        <div
          v-for="s in shadows"
          :key="s.name"
          :class="s.name"
          class="flex size-40 flex-col justify-end rounded-xl bg-card p-3"
        >
          <code class="text-body font-bold text-foreground">{{ s.name }}</code>
          <p class="text-caption text-muted-foreground">{{ s.usage }}</p>
        </div>
        <div
          v-for="r in ['rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-full']"
          :key="r"
          :class="r"
          class="flex size-40 items-end border border-border bg-card p-3"
        >
          <code class="text-body font-bold text-foreground">{{ r }}</code>
        </div>
      </div>
    </Variant>
  </Story>
</template>
