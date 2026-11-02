import { defineConfig } from 'histoire'
import { HstVue } from '@histoire/plugin-vue'

// 元件展示頁：pnpm story:dev（開發）、pnpm story:build（輸出靜態網站）
export default defineConfig({
  plugins: [HstVue()],
  setupFile: './src/histoire.setup.ts',
  // 用 # 路由＋相對路徑，build 出來的靜態網站放在任何網址底下都能開
  routerMode: 'hash',
  vite: { base: './' },
  storyMatch: ['src/**/*.story.vue'],
  theme: {
    title: '問導魷 元件庫',
    defaultColorScheme: 'light',
  },
  tree: {
    groups: [
      { id: 'top', title: '' },
      { id: 'tokens', title: '設計規範' },
      { id: 'ui', title: '基礎元件（components/ui）' },
      { id: 'common', title: '組合元件（components/common）' },
      { id: 'patterns', title: '頁面範例' },
    ],
  },
  responsivePresets: [
    { label: '手機', width: 390, height: 844 },
    { label: '平板', width: 820, height: 1180 },
    { label: '桌機', width: 1440, height: 900 },
  ],
  backgroundPresets: [
    { label: '頁面背景', color: 'hsl(48 23.8% 95.9%)', contrastColor: '#4F595D' },
    { label: '卡片（白）', color: '#ffffff', contrastColor: '#4F595D' },
  ],
})
