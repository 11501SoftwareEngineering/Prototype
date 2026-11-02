<script setup lang="ts">
/**
 * 問導魷 LOGO。對應 Figma 元件頁「LOGO」（node 189:572）：米白圓角底＋魷魚圖示。
 *
 * 用法：
 *   <AppLogo />              預設 130px（登入、註冊頁）
 *   <AppLogo :size="48" />   Header 用的小尺寸
 *   <AppLogo icon-only />    只有魷魚圖示、沒有底（對話泡泡頭像）
 */
import { computed } from 'vue'
import logoIconUrl from '@/assets/brand/logo-icon.svg'

const props = withDefaults(defineProps<{ size?: number; iconOnly?: boolean }>(), {
  size: 130,
  iconOnly: false,
})

// Figma 裡圖示佔外框寬度的 58%（左右各留 22% / 20%）
const iconWidth = computed(() => (props.iconOnly ? props.size : props.size * 0.58))
</script>

<template>
  <div
    role="img"
    aria-label="問導魷"
    class="flex shrink-0 items-center justify-center"
    :class="!iconOnly && 'rounded-2xl bg-background'"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <img :src="logoIconUrl" alt="" :style="{ width: `${iconWidth}px` }" class="h-auto" />
  </div>
</template>
