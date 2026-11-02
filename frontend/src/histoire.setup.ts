import { defineSetupVue3 } from '@histoire/plugin-vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import './assets/main.css'

// ListCard 的 to 會用到 RouterLink，所以給展示頁一個假的 router
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
})

export const setupVue3 = defineSetupVue3(({ app }) => {
  app.use(router)
})
