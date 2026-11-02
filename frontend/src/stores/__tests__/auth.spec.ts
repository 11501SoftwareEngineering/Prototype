import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createApp, nextTick } from 'vue'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { AxiosError, type AxiosAdapter } from 'axios'
import { isCancelledError } from '@tanstack/vue-query'
import { authApi } from '@/api/auth'
import { apiClient } from '@/api/client'
import { queryClient } from '@/queryClient'
import router from '@/router'
import { useAuthStore, type User } from '../auth'

const student: User = {
  account: 'student-1',
  name: 'Student',
  role: 'STUDENT',
  preferred_language: 'zh-TW',
  must_change_password: false,
}
const coursePath = '/student/courses/course-1/topics'

function errorResponse(status: number) {
  const error = new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST)
  const adapter: AxiosAdapter = async (config) => {
    error.config = config
    error.response = {
      config,
      data: { detail: 'Request failed' },
      headers: {},
      status,
      statusText: '',
    }
    throw error
  }
  return { error, adapter }
}

describe('session cleanup', () => {
  let pinia: ReturnType<typeof createPinia>
  let authStore: ReturnType<typeof useAuthStore>

  beforeEach(async () => {
    localStorage.clear()
    queryClient.clear()
    pinia = createPinia().use(piniaPluginPersistedstate)
    createApp({}).use(pinia)
    setActivePinia(pinia)
    authStore = useAuthStore()
    // 登出時會通知後端，測試裡不真的打 API
    vi.spyOn(authApi, 'logout').mockResolvedValue({} as never)
    authStore.setAuth('expired-token', student)
    await nextTick()
    await router.push('/student/courses')
    await router.isReady()
  })

  afterEach(() => {
    queryClient.clear()
    disposePinia(pinia)
    localStorage.clear()
    vi.restoreAllMocks()
  })

  const endSession = {
    'manual logout': () => authStore.logout(),
    'API 401': async () => {
      const { adapter, error } = errorResponse(401)
      await expect(apiClient.get(coursePath, { adapter })).rejects.toBe(error)
      await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
    },
  }

  it.each(['manual logout', 'API 401'] as const)(
    '%s clears Pinia, persisted credentials, and query/mutation caches before redirecting',
    async (trigger) => {
      queryClient.setQueryData(['student', 'course', 'course-1'], { name: 'Private course' })
      queryClient.setQueryData(['teacher', 'courses'], [student])
      queryClient.getMutationCache().build(queryClient, { mutationKey: ['student', 'join-course'] })
      expect(localStorage.getItem('auth')).toContain('expired-token')

      await endSession[trigger]()
      await nextTick()

      expect(authStore.token).toBeNull()
      expect(authStore.user).toBeNull()
      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.userRole).toBeNull()
      expect(localStorage.getItem('access_token')).toBeNull()
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
      expect(router.currentRoute.value.path).toBe('/login')

      // A page reload must not restore the expired session from persisted Pinia state.
      authStore.$hydrate()
      expect(authStore.token).toBeNull()
      expect(authStore.user).toBeNull()
      const { adapter, error } = errorResponse(403)
      await expect(apiClient.get(coursePath, { adapter })).rejects.toBe(error)
      expect(error.config?.headers.Authorization).toBeUndefined()
    },
  )

  it.each(['manual logout', 'API 401'] as const)(
    '%s cancels pending queries and keeps late results out of the next session',
    async (trigger) => {
      let signal: AbortSignal | undefined
      let finishRequest!: (value: string) => void
      const queryKey = ['student', 'course', 'course-1']
      const pendingQuery = queryClient.fetchQuery({
        queryKey,
        retry: false,
        queryFn: (context) => {
          signal = context.signal
          return new Promise<string>((resolve) => {
            finishRequest = resolve
          })
        },
      })
      // Attach the rejection handler before cleanup cancels the pending query.
      const cancelled = pendingQuery.catch((error) => error)
      expect(signal?.aborted).toBe(false)

      await endSession[trigger]()

      expect(signal?.aborted).toBe(true)
      expect(isCancelledError(await cancelled)).toBe(true)
      authStore.setAuth('new-token', { ...student, account: 'student-2' })
      queryClient.setQueryData(queryKey, 'New account course')
      finishRequest('Old account course')
      await flushPromises()
      expect(queryClient.getQueryData(queryKey)).toBe('New account course')
    },
  )

  it.each([403, 500])('preserves the session and cache for HTTP %s', async (status) => {
    const { adapter, error } = errorResponse(status)
    queryClient.setQueryData(['student', 'course', 'course-1'], 'Private course')

    await expect(apiClient.get(coursePath, { adapter })).rejects.toBe(error)

    expect(authStore.token).toBe('expired-token')
    expect(authStore.user).toEqual(student)
    expect(localStorage.getItem('access_token')).toBe('expired-token')
    expect(queryClient.getQueryData(['student', 'course', 'course-1'])).toBe('Private course')
    expect(router.currentRoute.value.path).toBe('/student/courses')
  })

  it('handles concurrent 401 responses without the login guard restoring a protected route', async () => {
    const first = errorResponse(401)
    const second = errorResponse(401)
    const results = await Promise.allSettled([
      apiClient.get(coursePath, { adapter: first.adapter }),
      apiClient.get(coursePath, { adapter: second.adapter }),
    ])

    expect(results).toEqual([
      { status: 'rejected', reason: first.error },
      { status: 'rejected', reason: second.error },
    ])
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
    expect(authStore.isAuthenticated).toBe(false)
    await router.push('/student/courses')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/student/courses')
  })
})
