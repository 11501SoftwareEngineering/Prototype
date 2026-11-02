import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import App from '../App.vue'
import AnnouncementsView from '@/views/common/AnnouncementsView.vue'
import CourseView from '@/views/student/CourseView.vue'
import { studentApi } from '@/api/student'

vi.mock('@/api/student', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/student')>()
  return {
    ...actual,
    studentApi: { getCourseTopics: vi.fn<typeof actual.studentApi.getCourseTopics>() },
  }
})

const stub = { template: '<div />' }

function createAppRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Home', component: AnnouncementsView },
      { path: '/login', name: 'Login', component: stub },
      { path: '/register', name: 'Register', component: stub },
      { path: '/student/courses', name: 'StudentCourses', component: stub },
      { path: '/student/courses/:courseId', name: 'StudentCourse', component: CourseView },
      { path: '/student/courses/:courseId/topics/:topicId', name: 'StudentChat', component: stub },
    ],
  })
}

describe('App', () => {
  let wrapper: VueWrapper | undefined
  let queryClient: QueryClient | undefined

  afterEach(() => {
    wrapper?.unmount()
    queryClient?.clear()
    vi.clearAllMocks()
  })

  it('未登入時顯示公告、註冊和登入按鈕、頁尾', async () => {
    const router = createAppRouter()
    queryClient = new QueryClient()
    await router.push('/')
    await router.isReady()
    wrapper = mount(App, {
      global: { plugins: [createPinia(), router, [VueQueryPlugin, { queryClient }]] },
    })

    await vi.waitFor(() => expect(wrapper?.find('main h1').text()).toBe('公告'))
    expect(wrapper.find('header').text()).toContain('問導魷')
    expect(wrapper.find('header a[href="/login"]').text()).toBe('登入')
    expect(wrapper.find('header a[href="/register"]').text()).toBe('註冊')
    expect(wrapper.find('footer').text()).toContain('隱私權')
    expect(studentApi.getCourseTopics).not.toHaveBeenCalled()
  })

  it('Header 只顯示我的課程，課程名稱保留於頁面標題且只查詢一次', async () => {
    vi.mocked(studentApi.getCourseTopics).mockResolvedValue({
      course_id: 'course-1',
      name: '公民思辨',
      invite_code: 'CLASS1',
      topics: [
        {
          topic_id: 't1',
          title: '課程問題',
          description: '',
          status: 'NOT_STARTED',
          session_id: null,
        },
      ],
    })
    const router = createAppRouter()
    const pinia = createPinia()
    pinia.state.value.auth = {
      token: 'test-token',
      user: {
        account: 's1',
        name: '王小明',
        role: 'STUDENT',
        preferred_language: 'zh-TW',
        must_change_password: false,
      },
    }
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await router.push('/student/courses/course-1')
    await router.isReady()
    wrapper = mount(App, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await vi.waitFor(() => expect(wrapper?.find('main article').text()).toContain('課程問題'))
    const nav = wrapper.find('header nav')
    expect(nav.text()).toContain('我的課程')
    expect(nav.text()).not.toContain('公民思辨')
    expect(wrapper.find('main h1').text()).toBe('公民思辨')
    expect(wrapper.find('header').text()).toContain('王小明')
    expect(studentApi.getCourseTopics).toHaveBeenCalledTimes(1)
  })
})
