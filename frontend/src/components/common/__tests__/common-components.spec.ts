import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import SearchInput from '../SearchInput.vue'
import ListCard from '../ListCard.vue'
import NewsCard from '../NewsCard.vue'
import QueryState from '../QueryState.vue'
import ChatInput from '../ChatInput.vue'
import AppCheckbox from '../AppCheckbox.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
})

describe('SearchInput', () => {
  it('點清除鈕或按 Esc 會清空內容', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: '王',
        'onUpdate:modelValue': (v: string) => wrapper.setProps({ modelValue: v }),
      },
    })
    await wrapper.find('button[aria-label="清除搜尋"]').trigger('click')
    expect(wrapper.props('modelValue')).toBe('')

    await wrapper.setProps({ modelValue: '林' })
    await wrapper.find('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.props('modelValue')).toBe('')
  })

  it('沒有內容時清除鈕停用，而且有給螢幕報讀器的 label', () => {
    const wrapper = mount(SearchInput, { props: { label: '搜尋老師' } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input').attributes('aria-label')).toBe('搜尋老師')
  })
})

describe('ListCard', () => {
  it('顯示標題、說明和按鈕', () => {
    const wrapper = mount(ListCard, {
      props: { title: '帳號：wang', description: '王老師' },
      slots: { actions: '<button>刪除</button>' },
    })
    expect(wrapper.text()).toContain('帳號：wang')
    expect(wrapper.text()).toContain('王老師')
    expect(wrapper.text()).toContain('刪除')
  })

  it('傳入 to 時標題變成連結', () => {
    const wrapper = mount(ListCard, {
      props: { title: '哲學概論', to: '/student/courses/c1' },
      global: { plugins: [router] },
    })
    expect(wrapper.find('a').attributes('href')).toBe('/student/courses/c1')
  })

  it('expandable 時點標題可以展開和收合', async () => {
    const wrapper = mount(ListCard, {
      props: {
        title: '哲學概論',
        expandable: true,
        expanded: false,
        'onUpdate:expanded': (v: boolean) => wrapper.setProps({ expanded: v }),
      },
      slots: { details: '<p>學生帳號 s001</p>' },
    })
    expect(wrapper.text()).not.toContain('s001')
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toContain('s001')
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('true')
  })
})

describe('NewsCard', () => {
  it('日期用台北時區顯示，點標題切換展開', async () => {
    const wrapper = mount(NewsCard, {
      props: {
        title: '公告',
        content: '內文',
        date: '2026-10-22T20:00:00Z',
        expanded: false,
        'onUpdate:expanded': (v: boolean) => wrapper.setProps({ expanded: v }),
      },
    })
    expect(wrapper.find('time').text()).toBe('2026-10-23')
    expect(wrapper.find('p').classes()).toContain('line-clamp-1')
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('p').classes()).not.toContain('line-clamp-1')
  })
})

describe('QueryState', () => {
  it('依序顯示載入中、錯誤、空資料、內容', async () => {
    const wrapper = mount(QueryState, {
      props: { loading: true },
      slots: { default: '<p>資料</p>' },
    })
    expect(wrapper.find('[role="status"]').exists()).toBe(true)

    await wrapper.setProps({
      loading: false,
      error: { isAxiosError: true, response: { data: { detail: '非管理員無權存取' } } },
    })
    expect(wrapper.find('[role="alert"]').text()).toContain('非管理員無權存取')

    await wrapper.setProps({ error: null, empty: true, emptyText: '目前沒有老師' })
    expect(wrapper.text()).toContain('目前沒有老師')

    await wrapper.setProps({ empty: false })
    expect(wrapper.text()).toContain('資料')
  })

  it('按重新載入會觸發 retry', async () => {
    const wrapper = mount(QueryState, { props: { error: new Error('x') } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})

describe('ChatInput', () => {
  it('有內容時送出，送出內容會去掉前後空白', async () => {
    const wrapper = mount(ChatInput, { props: { modelValue: '  我覺得是公平  ' } })
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('send')?.[0]).toEqual(['我覺得是公平'])
  })

  it('空白、回覆中、回合用完時不能送出', async () => {
    const wrapper = mount(ChatInput, { props: { modelValue: '   ' } })
    await wrapper.find('form').trigger('submit')
    await wrapper.setProps({ modelValue: '內容', sending: true })
    await wrapper.find('form').trigger('submit')
    await wrapper.setProps({ sending: false, remaining: 0, total: 5 })
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('send')).toBeUndefined()
    expect(wrapper.text()).toContain('剩餘回合數：0/5')
  })
})

describe('AppCheckbox', () => {
  it('點擊會切換勾選狀態', async () => {
    const wrapper = mount(AppCheckbox, {
      props: {
        modelValue: false,
        'onUpdate:modelValue': (v: boolean) => wrapper.setProps({ modelValue: v }),
      },
      slots: { default: '匿名分享' },
    })
    await wrapper.find('input').setValue(true)
    expect(wrapper.props('modelValue')).toBe(true)
  })
})
