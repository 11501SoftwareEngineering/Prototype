import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import './assets/main.css'

import App from './App.vue'
import router from './router'
import { queryClient } from './queryClient'

async function enableMocking() {
  // Demo 模式：在瀏覽器裡啟動假後端（src/mocks），所有 /api/v1 請求都會被攔截
  if (import.meta.env.VITE_USE_MOCK !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
  // 按 Ctrl+F5（強制重新整理）時，瀏覽器會讓這一頁跳過 Service Worker，
  // 假後端就攔不到請求（會出現「無法連線到伺服器」）。這時自動再重新整理一次。
  if (!navigator.serviceWorker.controller) {
    const key = 'msw-reloaded'
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      location.reload()
      return new Promise<never>(() => {})
    }
  } else {
    sessionStorage.removeItem('msw-reloaded')
  }
}

async function bootstrap() {
  await enableMocking()

  const app = createApp(App)
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  app.use(pinia)
  app.use(router)
  app.use(VueQueryPlugin, { queryClient })
  app.mount('#app')
}

void bootstrap()
