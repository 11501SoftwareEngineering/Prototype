<script setup lang="ts">
/**
 * Debug 面板（只在 Demo 模式出現：VITE_USE_MOCK=true）。
 *   身分：一鍵切換學生／老師／管理員
 *   情境：讓每組 API 變成空資料、錯誤、很慢、一直載入
 *   假資料：新增課程、問題、學生，讓全班完成作答，結束對話，新增公告，重置
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { ROLE_LABELS } from '@/api/auth'
import { getApiErrorMessage } from '@/lib/utils'
import { homeRouteFor, useAuthStore } from '@/stores/auth'
import {
  addAnnouncement,
  addCourse,
  addStudents,
  addTopic,
  clearAnnouncements,
  finishMyChat,
  addManyConclusions,
  finishTopicForClass,
  topicFromRoute,
  resetAllData,
} from './actions'
import { DEMO_PASSWORD } from './db'
import {
  API_GROUPS,
  resetScenarios,
  SCENARIO_LABELS,
  scenarios,
  type ApiGroup,
  type ScenarioMode,
} from './scenarios'

const STORAGE_KEY = 'socratesbot-debug-panel'
function loadOpen() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'open'
  } catch {
    return false
  }
}

const open = ref(loadOpen())
const tab = ref<'identity' | 'scenario' | 'data'>('identity')
const message = ref('')

function toggle() {
  open.value = !open.value
  try {
    localStorage.setItem(STORAGE_KEY, open.value ? 'open' : 'closed')
  } catch {
    // 記不住開關狀態沒關係
  }
}

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()

const ACCOUNTS = [
  { account: 's001', label: '學生 王小明', note: '有一題完成、一題進行中' },
  { account: 's012', label: '學生 鄭心怡', note: '還沒開始作答' },
  { account: 'ta', label: '助教 示範助教', note: '老師可勾選權限' },
  { account: 'wang', label: '老師 王老師', note: '有兩門課' },
  { account: 'chen', label: '老師 陳老師', note: '第一次登入，要先改密碼' },
  { account: 'admin', label: '管理員', note: '管理老師帳號' },
]

const busy = ref(false)
async function loginAs(account: string) {
  busy.value = true
  message.value = ''
  try {
    const user = await authStore.login({ account, password: DEMO_PASSWORD })
    await router.push({ name: homeRouteFor(user) })
    message.value = `已切換成 ${user.name}`
  } catch (err) {
    const reason = getApiErrorMessage(err)
    message.value = reason.startsWith('無法連線')
      ? '假後端沒有接到請求，請按 F5 重新整理頁面（不要用 Ctrl+F5）'
      : `登入失敗：${reason}（密碼改過了的話，先重置假資料）`
  } finally {
    busy.value = false
  }
}

const courseId = computed(() => String(route.params.courseId ?? ''))
const topicId = computed(() => String(route.params.topicId ?? ''))
const isStudentChat = computed(() => route.name === 'StudentChat')
const isTeacherTopic = computed(() => route.name === 'TeacherTopic')
// 老師問題頁、學生結果頁都可以用「新增很多結論」
const resultTopicId = computed(() => topicFromRoute(route.params))

async function run(action: () => string) {
  message.value = action()
  await queryClient.invalidateQueries()
}

const announcementTitle = ref('')
const announcementContent = ref('')
async function handleAddAnnouncement() {
  await run(() => addAnnouncement(announcementTitle.value, announcementContent.value))
  announcementTitle.value = ''
  announcementContent.value = ''
  if (route.name !== 'Announcements') await router.push({ name: 'Announcements' })
}

async function handleReset() {
  resetAllData()
  resetScenarios()
  message.value = '假資料和情境都已重置'
  if (authStore.isAuthenticated) await authStore.logout()
}

function setAll(mode: ScenarioMode) {
  for (const key of Object.keys(scenarios.groups) as ApiGroup[]) scenarios.groups[key] = mode
  void queryClient.invalidateQueries()
}

function handleScenarioChange() {
  void queryClient.invalidateQueries()
}

const activeCount = computed(
  () => Object.values(scenarios.groups).filter((mode) => mode !== 'normal').length,
)

const tabs = [
  { id: 'identity', label: '身分' },
  { id: 'scenario', label: '情境' },
  { id: 'data', label: '假資料' },
] as const

const btn =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40'
</script>

<template>
  <div class="fixed bottom-24 left-3 z-[60] sm:bottom-3 flex flex-col items-start gap-2 font-sans">
    <section
      v-if="open"
      id="debug-panel"
      aria-label="Debug 面板"
      class="flex max-h-[min(640px,calc(100dvh-5rem))] w-[min(360px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-foreground/20 bg-card text-sm shadow-2xl"
    >
      <header
        class="flex items-center justify-between border-b border-border bg-workspace px-4 py-2 text-workspace-foreground"
      >
        <p class="font-bold">Debug 面板（假資料模式）</p>
        <button
          type="button"
          class="rounded px-2 text-lg leading-none hover:bg-background/20"
          aria-label="關閉 Debug 面板"
          @click="toggle"
        >
          ×
        </button>
      </header>

      <div role="tablist" class="flex border-b border-border">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="tab === t.id"
          class="flex-1 px-3 py-2 text-sm"
          :class="tab === t.id ? 'border-b-2 border-foreground font-bold' : 'text-muted-foreground'"
          @click="tab = t.id"
        >
          {{ t.label }}
          <span
            v-if="t.id === 'scenario' && activeCount"
            class="ml-1 rounded-full bg-destructive px-1.5 text-xs text-foreground"
            >{{ activeCount }}</span
          >
        </button>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto p-4">
        <!-- 身分 -->
        <template v-if="tab === 'identity'">
          <p class="text-muted-foreground">
            目前：
            <strong class="text-foreground">{{
              authStore.user
                ? `${authStore.user.name}（${ROLE_LABELS[authStore.user.role]}）`
                : '未登入'
            }}</strong>
          </p>
          <button
            v-for="a in ACCOUNTS"
            :key="a.account"
            type="button"
            :class="btn"
            :disabled="busy"
            @click="loginAs(a.account)"
          >
            <span class="block font-bold">{{ a.label }}</span>
            <span class="block text-xs text-muted-foreground"
              >帳號 {{ a.account }}・{{ a.note }}</span
            >
          </button>
          <button
            type="button"
            :class="btn"
            :disabled="!authStore.isAuthenticated"
            @click="authStore.logout()"
          >
            登出（看未登入的畫面）
          </button>
          <p class="text-xs text-muted-foreground">所有假帳號的密碼都是 {{ DEMO_PASSWORD }}</p>
        </template>

        <!-- 情境 -->
        <template v-else-if="tab === 'scenario'">
          <p class="text-muted-foreground">讓某一組 API 故意出狀況，檢查畫面有沒有處理好。</p>
          <div v-for="(label, key) in API_GROUPS" :key="key" class="flex items-center gap-2">
            <label :for="`scenario-${key}`" class="min-w-0 flex-1 truncate">{{ label }}</label>
            <select
              :id="`scenario-${key}`"
              v-model="scenarios.groups[key]"
              class="rounded-md border border-border bg-background px-2 py-1 text-sm"
              :class="scenarios.groups[key] !== 'normal' && 'border-destructive font-bold'"
              @change="handleScenarioChange"
            >
              <option v-for="(text, mode) in SCENARIO_LABELS" :key="mode" :value="mode">
                {{ text }}
              </option>
            </select>
          </div>
          <div class="flex gap-2">
            <button type="button" :class="btn" @click="setAll('normal')">全部恢復正常</button>
            <button type="button" :class="btn" @click="setAll('error')">全部錯誤</button>
          </div>
          <label class="block">
            <span class="flex justify-between"
              ><span>每個請求延遲</span><span>{{ scenarios.latency }} ms</span></span
            >
            <input
              v-model.number="scenarios.latency"
              type="range"
              min="0"
              max="2000"
              step="100"
              class="w-full"
            />
          </label>
          <label class="block">
            <span class="flex justify-between"
              ><span>AI 打字速度（每字）</span><span>{{ scenarios.typingSpeed }} ms</span></span
            >
            <input
              v-model.number="scenarios.typingSpeed"
              type="range"
              min="0"
              max="150"
              step="10"
              class="w-full"
            />
          </label>
          <p class="text-xs text-muted-foreground">
            「空資料」只影響讀取（GET）；「一直載入」可以用來看骨架畫面。
          </p>
        </template>

        <!-- 假資料 -->
        <template v-else>
          <button type="button" :class="btn" @click="run(addCourse)">新增一門課程</button>
          <button
            type="button"
            :class="btn"
            :disabled="!courseId"
            @click="run(() => addTopic(courseId))"
          >
            在這門課新增一個問題
          </button>
          <button
            type="button"
            :class="btn"
            :disabled="!courseId"
            @click="run(() => addStudents(courseId))"
          >
            在這門課加入 5 位學生
          </button>
          <button
            type="button"
            :class="btn"
            :disabled="!isTeacherTopic"
            @click="run(() => finishTopicForClass(topicId))"
          >
            讓全班完成這一題（老師問題頁）
          </button>
          <button
            type="button"
            :class="btn"
            :disabled="!resultTopicId"
            @click="run(() => addManyConclusions(resultTopicId))"
          >
            這一題新增 5 個結論並重新分配作答（老師問題頁／學生結果頁）
          </button>
          <button
            type="button"
            :class="btn"
            :disabled="!isStudentChat"
            @click="run(() => finishMyChat(topicId))"
          >
            直接結束這段對話（學生對話頁）
          </button>
          <fieldset class="space-y-2 rounded-md border border-border p-3">
            <legend class="px-1 text-xs text-muted-foreground">新增公告</legend>
            <input
              v-model="announcementTitle"
              aria-label="公告標題"
              placeholder="標題（沒填就用測試標題）"
              class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
            <textarea
              v-model="announcementContent"
              aria-label="公告內容"
              rows="3"
              placeholder="內容（可以換行）"
              class="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
            <button type="button" :class="btn" @click="handleAddAnnouncement">新增這則公告</button>
          </fieldset>
          <button type="button" :class="btn" @click="run(clearAnnouncements)">清空公告</button>
          <p class="text-xs text-muted-foreground">
            灰色的按鈕要先進到對應的頁面。假資料存在這個瀏覽器裡，重新整理不會不見。
          </p>
          <button
            type="button"
            class="w-full rounded-md bg-destructive px-3 py-2 text-sm font-bold text-foreground hover:brightness-90"
            @click="handleReset"
          >
            重置所有假資料
          </button>
        </template>

        <p v-if="message" role="status" class="rounded-md bg-primary/30 px-3 py-2">{{ message }}</p>
      </div>
    </section>

    <button
      type="button"
      class="flex items-center gap-1.5 rounded-full border border-border bg-workspace px-4 py-2 text-sm font-bold text-workspace-foreground shadow-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
      :aria-expanded="open"
      aria-controls="debug-panel"
      @click="toggle"
    >
      🐞 Debug
      <span v-if="activeCount" class="rounded-full bg-destructive px-1.5 text-xs text-foreground">{{
        activeCount
      }}</span>
    </button>
  </div>
</template>
