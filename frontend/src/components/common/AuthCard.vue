<script setup lang="ts">
// 登入、註冊頁中間的白色卡片（Figma Login / Register）。
</script>

<template>
  <div class="flex justify-center px-4 py-10 sm:py-16">
    <div
      class="w-full max-w-[626px] rounded-2xl border border-border bg-card px-5 py-8 shadow-elevated sm:px-14 sm:py-12"
    >
      <slot />
    </div>
  </div>
</template>
