<script setup lang="ts">
// 「沒有權限」「找不到頁面」共用的畫面。
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import AppLogo from '@/components/common/AppLogo.vue'
import { Button } from '@/components/ui/button'
import { HOME_ROUTE, useAuthStore } from '@/stores/auth'

defineProps<{ title: string; description: string }>()

const authStore = useAuthStore()
const home = computed<RouteLocationRaw>(() =>
  authStore.userRole ? { name: HOME_ROUTE[authStore.userRole] } : { name: 'Home' },
)
</script>

<template>
  <div class="flex flex-col items-center gap-6 px-4 py-20 text-center">
    <AppLogo :size="120" />
    <h1 class="text-h1-title text-foreground">{{ title }}</h1>
    <p class="max-w-md text-body-lg text-muted-foreground">{{ description }}</p>
    <Button as-child size="lg">
      <RouterLink :to="home">回到首頁</RouterLink>
    </Button>
  </div>
</template>
