<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppFooter from '@/components/common/AppFooter.vue'
import AppHeader from '@/components/common/AppHeader.vue'
import ChangePasswordDialog from '@/components/common/ChangePasswordDialog.vue'
import { useAuthStore } from '@/stores/auth'

// Demo 模式（VITE_USE_MOCK=true）才載入 Debug 面板，正式版不會打包進來
const DebugPanel =
  import.meta.env.VITE_USE_MOCK === 'true'
    ? defineAsyncComponent(() => import('@/mocks/DebugPanel.vue'))
    : null

const authStore = useAuthStore()

// 老師第一次登入要先改密碼：強制打開、不能關
const passwordOpen = computed({
  get: () => authStore.mustChangePassword,
  set: () => undefined,
})

// 重新整理後，用保存的 token 跟後端確認身分（GET /users/me）
onMounted(() => {
  if (authStore.isAuthenticated) void authStore.fetchCurrentUser()
})
</script>

<template>
  <div class="socratic-app flex min-h-dvh flex-col bg-background text-foreground">
    <a
      href="#main"
      class="sr-only z-50 rounded-lg bg-card px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >跳到主要內容</a
    >
    <AppHeader />
    <main id="main" class="flex flex-1 flex-col">
      <RouterView />
    </main>
    <AppFooter />
    <ChangePasswordDialog
      v-if="authStore.isAuthenticated && authStore.mustChangePassword"
      v-model:open="passwordOpen"
    />
    <component :is="DebugPanel" v-if="DebugPanel" />
  </div>
</template>
