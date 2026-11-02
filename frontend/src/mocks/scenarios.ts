/**
 * Debug 面板的「情境」設定：讓每一組 API 假裝成空資料、錯誤、很慢或一直載入。
 * 設定存在 localStorage，重新整理後還在。
 */
import { reactive, watch } from 'vue'

export type ScenarioMode = 'normal' | 'empty' | 'error' | 'slow' | 'pending'

export const SCENARIO_LABELS: Record<ScenarioMode, string> = {
  normal: '正常',
  empty: '空資料',
  error: '伺服器錯誤',
  slow: '很慢（3 秒）',
  pending: '一直載入',
}

export const API_GROUPS = {
  auth: '登入／註冊／帳號',
  admin: '管理員：老師帳號',
  teacherCourses: '老師：課程列表',
  teacherTopics: '老師：問題列表',
  teacherResults: '老師：結果與學生',
  studentCourses: '學生：課程列表',
  studentTopics: '學生：問題列表',
  chat: '學生：對話',
  studentResults: '學生：結果',
} as const

export type ApiGroup = keyof typeof API_GROUPS

interface ScenarioState {
  groups: Record<ApiGroup, ScenarioMode>
  /** 每個請求固定加上的延遲（毫秒），模擬真實網路 */
  latency: number
  /** AI 回覆逐字顯示的速度（每個字幾毫秒） */
  typingSpeed: number
}

const STORAGE_KEY = 'socratesbot-mock-scenarios'

function defaults(): ScenarioState {
  const groups = Object.fromEntries(
    Object.keys(API_GROUPS).map((key) => [key, 'normal']),
  ) as Record<ApiGroup, ScenarioMode>
  return { groups, latency: 300, typingSpeed: 30 }
}

function load(): ScenarioState {
  const base = defaults()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<ScenarioState>
      return { ...base, ...saved, groups: { ...base.groups, ...saved.groups } }
    }
  } catch {
    // 讀不到就用預設值
  }
  return base
}

export const scenarios = reactive<ScenarioState>(load())

watch(
  scenarios,
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios))
    } catch {
      // 存不了沒關係
    }
  },
  { deep: true },
)

export function resetScenarios() {
  Object.assign(scenarios, defaults())
}
