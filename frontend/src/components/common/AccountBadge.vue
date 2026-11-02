<script setup lang="ts">
/**
 * 帳戶資訊（Header 右上角）。對應 Figma 元件頁「帳戶」（node 225:670）。
 *   右邊圓形頭像，左邊兩行文字：帳戶名稱（文字主色）、身分（文字輔色），都靠右對齊
 *
 * 用法：<AccountBadge :name="user.name" role-label="學生" />
 */
import avatarUrl from '@/assets/brand/avatar.svg'

defineProps<{
  name: string
  /** 顯示用的身分文字，例如「學生」「老師」「管理員」 */
  roleLabel: string
}>()
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div class="text-right text-body-lg">
      <p class="max-w-40 truncate text-foreground" :title="name">{{ name }}</p>
      <p class="text-muted-foreground">{{ roleLabel }}</p>
    </div>
    <img :src="avatarUrl" alt="" width="41" height="41" class="size-[41px] shrink-0" />
  </div>
</template>
