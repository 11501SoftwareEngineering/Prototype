import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import AnnouncementsView from '../AnnouncementsView.vue'
import { apiClient } from '@/api/client'
import type { Announcement } from '@/data/announcements'

const fixture = vi.hoisted(() => ({ announcements: [] as Announcement[] }))
vi.mock('@/data/announcements', () => fixture)
vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn<typeof apiClient.get>() },
}))

describe('AnnouncementsView', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Backend unavailable'))
    fixture.announcements.splice(0, fixture.announcements.length, {
      id: 'static-1',
      title: '靜態公告標題',
      content: '公告內容',
      published_at: '2026-10-04T18:00:00Z',
    })
  })

  afterEach(() => wrapper?.unmount())

  it('renders static data and the Taipei date without a query plugin or backend request', () => {
    wrapper = mount(AnnouncementsView)
    expect(wrapper.find('h1').text()).toBe('公告')
    expect(wrapper.find('article').text()).toContain('靜態公告標題')
    expect(wrapper.find('article').text()).toContain('公告內容')
    expect(wrapper.find('time').text()).toBe('2026-10-05')
    expect(wrapper.find('time').attributes('datetime')).toBe('2026-10-04T18:00:00Z')
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('shows an empty state without requesting data', () => {
    fixture.announcements.splice(0)
    wrapper = mount(AnnouncementsView)
    expect(wrapper.find('[role="status"]').text()).toBe('目前沒有公告')
    expect(wrapper.find('article').exists()).toBe(false)
    expect(apiClient.get).not.toHaveBeenCalled()
  })
})
