import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { setupServer } from 'msw/node'
import App from '@/App.vue'
import FormDialog from '@/components/common/FormDialog.vue'
import ChangePasswordDialog from '@/components/common/ChangePasswordDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import { handlers } from '@/mocks/handlers'
import { resetDb } from '@/mocks/db'
import { resetScenarios, scenarios } from '@/mocks/scenarios'

const server = setupServer(...handlers)
let wrapper: VueWrapper | undefined
let queryClient: QueryClient | undefined

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  localStorage.clear()
  resetDb()
  resetScenarios()
  scenarios.latency = 0
})
afterEach(() => {
  wrapper?.unmount()
  queryClient?.clear()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

async function mountApp(account = 'wang') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  await auth.login({ account, password: 'password123' })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      'Home',
      'Login',
      'Register',
      'TeacherCourses',
      'TeacherAiSettings',
      'StudentCourses',
      'AdminTeachers',
    ].map((name, i) => ({
      path: i ? `/${name}` : '/',
      name,
      component: { template: '<div />' },
    })),
  })
  await router.push('/')
  await router.isReady()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
  })
  await flushPromises()
  return auth
}

async function openFromHeader() {
  const trigger = wrapper!.get('button[aria-label="開啟帳號選單"]')
  ;(trigger.element as HTMLButtonElement).focus()
  await trigger.trigger('keydown', { key: 'Enter' })
  await flushPromises()
  const menu = new DOMWrapper(document.querySelector('[role="menu"]')!)
  const changePassword = menu
    .findAll('[role="menuitem"]')
    .find((item) => item.text() === '修改密碼')
  expect(changePassword).toBeDefined()
  await changePassword!.trigger('click')
  await flushPromises()
  return new DOMWrapper(document.querySelector('[role="dialog"]')!)
}

describe('頭像修改密碼與首次設定共用表單', () => {
  it.each(['wang', 's001', 'ta', 'admin'])(
    '%s 可開啟並取消，關閉後不登出且不保留密碼',
    async (account) => {
      const auth = await mountApp(account)
      const logout = vi.spyOn(auth, 'logout')
      const dialog = await openFromHeader()
      expect(dialog.text()).toContain('修改密碼')
      expect(dialog.text()).not.toContain('設定首次登入密碼')
      expect(wrapper!.getComponent(FormDialog).props('dismissible')).toBe(true)
      const fields = dialog.findAll('input[type="password"]')
      expect(fields).toHaveLength(3)
      expect(dialog.find('input[type="email"]').exists()).toBe(false)
      await fields[0]!.setValue('password123')
      await dialog
        .findAll('button')
        .find((button) => button.text() === '取消')!
        .trigger('click')
      await flushPromises()
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(auth.isAuthenticated).toBe(true)
      expect(logout).not.toHaveBeenCalled()
      const reopened = await openFromHeader()
      expect(
        reopened
          .findAll('input')
          .every((input) => (input.element as HTMLInputElement).value === ''),
      ).toBe(true)
    },
  )

  it('一般修改會保留原密碼錯誤提示，成功後關閉並讓新密碼生效', async () => {
    const auth = await mountApp()
    const dialog = await openFromHeader()
    const fields = dialog.findAll('input')
    await fields[0]!.setValue('wrong-password')
    await fields[1]!.setValue('new-password456')
    await fields[2]!.setValue('new-password456')
    await dialog.get('form').trigger('submit')
    await vi.waitFor(() => expect(dialog.find('[role="alert"]').text()).toContain('原密碼輸入錯誤'))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    await fields[0]!.setValue('password123')
    await dialog.get('form').trigger('submit')
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    expect(auth.isAuthenticated).toBe(true)
    await expect(authApi.login({ account: 'wang', password: 'password123' })).rejects.toBeDefined()
    await expect(
      authApi.login({ account: 'wang', password: 'new-password456' }),
    ).resolves.toMatchObject({ user: { account: 'wang' } })
  })

  it('欄位不合規或兩次新密碼不一致時，不呼叫修改 API', async () => {
    await mountApp()
    const change = vi.spyOn(authApi, 'changePassword')
    const dialog = await openFromHeader()
    const fields = dialog.findAll('input')
    await fields[0]!.setValue('password123')
    for (const [password, confirm, error] of [
      ['short', 'short', '新密碼至少要 8 個字元'],
      ['password123', 'password123', '新密碼不能與原密碼相同'],
      ['x'.repeat(129), 'x'.repeat(129), '新密碼最多 128 個字元'],
      ['new-password456', 'different-password', '兩次輸入的新密碼不一樣'],
    ]) {
      await fields[1]!.setValue(password!)
      await fields[2]!.setValue(confirm!)
      await dialog.get('form').trigger('submit')
      expect(dialog.text()).toContain(error)
    }
    expect(change).not.toHaveBeenCalled()
  })

  it('首次登入仍自動開啟且不可略過，設定完成後解除限制', async () => {
    const auth = await mountApp('chen')
    const dialog = new DOMWrapper(document.querySelector('[role="dialog"]')!)
    expect(wrapper!.findComponent(ChangePasswordDialog).exists()).toBe(true)
    expect(wrapper!.getComponent(FormDialog).props()).toMatchObject({
      title: '設定首次登入密碼',
      dismissible: false,
      cancelText: '登出',
    })
    await dialog.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    const fields = dialog.findAll('input')
    await fields[0]!.setValue('password123')
    await fields[1]!.setValue('new-password456')
    await fields[2]!.setValue('new-password456')
    await dialog.get('form').trigger('submit')
    await vi.waitFor(() => expect(auth.mustChangePassword).toBe(false))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
