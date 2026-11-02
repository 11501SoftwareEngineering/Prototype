import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import CourseView from '../CourseView.vue'
import { studentApi, type CourseTopics } from '@/api/student'

vi.mock('@/api/student', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/student')>()
  return {
    ...actual,
    studentApi: { getCourseTopics: vi.fn<typeof actual.studentApi.getCourseTopics>() },
  }
})
const getCourseTopics = vi.mocked(studentApi.getCourseTopics)

const course: CourseTopics = {
  course_id: 'course-1',
  name: '公民思辨',
  invite_code: 'CLASS1',
  topics: [
    {
      topic_id: 'topic-1',
      title: '民主與自由',
      description: '公共生活',
      status: 'NOT_STARTED',
      session_id: null,
      age_range: '13-15',
      max_rounds: 5,
    },
    {
      topic_id: 'topic-2',
      title: '社會責任',
      description: 'Responsibility',
      status: 'COMPLETED',
      session_id: 'session-2',
      age_range: '16-18',
      max_rounds: 10,
    },
  ],
}

describe('student CourseView', () => {
  let client: QueryClient
  let router: Router
  let wrapper: VueWrapper | undefined
  let container: HTMLDivElement

  beforeEach(async () => {
    getCourseTopics.mockReset()
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    const stub = { template: '<div />' }
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/student/courses/:courseId', name: 'StudentCourse', component: CourseView },
        {
          path: '/student/courses/:courseId/topics/:topicId',
          name: 'StudentChat',
          component: stub,
        },
        {
          path: '/student/courses/:courseId/sessions/:sessionId/result',
          name: 'StudentResult',
          component: stub,
        },
      ],
    })
    container = document.createElement('div')
    document.body.append(container)
    await router.push('/student/courses/course-1')
    await router.isReady()
  })

  afterEach(() => {
    wrapper?.unmount()
    client.clear()
    container.remove()
  })

  function mountView() {
    wrapper = mount(CourseView, {
      attachTo: container,
      global: { plugins: [router, [VueQueryPlugin, { queryClient: client }]] },
    })
    return wrapper
  }

  const cards = (view: VueWrapper) => view.findAll('article')

  it('loads the course topics and shows age range, rounds and status', async () => {
    getCourseTopics.mockResolvedValueOnce(course)
    const view = mountView()
    expect(view.find('[role="status"]').exists()).toBe(true)
    await vi.waitFor(() => expect(cards(view)).toHaveLength(2))
    expect(view.text()).not.toContain('年齡層')
    expect(view.text()).toContain('回合數：10')
    expect(view.text()).toContain('已完成')
    expect(getCourseTopics).toHaveBeenCalledWith('course-1', expect.any(AbortSignal))
  })

  it('filters topics locally and explains when nothing matches', async () => {
    getCourseTopics.mockResolvedValueOnce(course)
    const view = mountView()
    await vi.waitFor(() => expect(cards(view)).toHaveLength(2))
    await view.find('input[type="search"]').setValue('  RESPONSIBILITY  ')
    expect(cards(view)).toHaveLength(1)
    expect(cards(view)[0]?.text()).toContain('社會責任')
    await view.find('input[type="search"]').setValue('不存在的問題')
    expect(view.text()).toContain('找不到符合的問題')
    expect(getCourseTopics).toHaveBeenCalledTimes(1)
  })

  it('tells students when the teacher has not added topics yet', async () => {
    getCourseTopics.mockResolvedValueOnce({ ...course, topics: [] })
    const view = mountView()
    await vi.waitFor(() => expect(view.text()).toContain('老師還沒有出題目'))
  })

  it('shows the translated API error and retries', async () => {
    getCourseTopics.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: { detail: 'Course membership required' } },
    })
    getCourseTopics.mockResolvedValueOnce(course)
    const view = mountView()
    await vi.waitFor(() =>
      expect(view.find('[role="alert"]').text()).toContain('你還沒有加入這門課程'),
    )
    await view.find('[role="alert"] button').trigger('click')
    await vi.waitFor(() => expect(cards(view)).toHaveLength(2))
  })

  it('opens the chat for unfinished topics and the result for finished ones', async () => {
    getCourseTopics.mockResolvedValueOnce(course)
    const view = mountView()
    await vi.waitFor(() => expect(cards(view)).toHaveLength(2))
    const links = view.findAll('article a')
    expect(links[0]?.attributes('href')).toBe('/student/courses/course-1/topics/topic-1')
    expect(links[1]?.attributes('href')).toBe('/student/courses/course-1/sessions/session-2/result')
  })

  it('does not invent missing age or round counts', async () => {
    getCourseTopics.mockResolvedValueOnce({
      ...course,
      topics: [
        {
          topic_id: 'x',
          title: '未設定',
          description: null,
          status: 'NOT_STARTED',
          session_id: null,
        },
      ],
    })
    const view = mountView()
    await vi.waitFor(() => expect(cards(view)).toHaveLength(1))
    expect(view.text()).not.toContain('年齡層')
    expect(view.text()).toContain('回合數：未提供')
  })
})
