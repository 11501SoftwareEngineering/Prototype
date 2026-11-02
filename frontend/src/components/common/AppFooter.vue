<script setup lang="ts">
// 頁尾。電腦版一排（Figma Footer），手機版直排加分隔線（Figma Footer_phone）。
// 五個項目目前都還沒有對應的頁面，先用純文字呈現，做好頁面再換成 <RouterLink>。
const links = ['隱私權', '版權', '開發者', '聯絡我們', 'Bug']
</script>

<template>
  <footer class="shrink-0 border-t border-border bg-background px-4 py-4">
    <ul
      class="mx-auto flex max-w-md flex-col divide-y divide-muted-foreground/60 px-4 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-8 sm:divide-y-0 sm:px-0"
    >
      <li
        v-for="link in links"
        :key="link"
        class="py-1 text-center font-heading text-[11px] text-muted-foreground sm:py-0"
      >
        {{ link }}
      </li>
    </ul>
  </footer>
</template>
