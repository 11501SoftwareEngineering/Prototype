/**
 * 假後端的資料庫（只存在瀏覽器裡）。
 * 資料存在 localStorage，重新整理不會不見；Debug 面板的「重置假資料」會回到初始狀態。
 * 欄位設計盡量貼近後端的資料表，API 回傳格式在 handlers.ts 轉換。
 */
import { reactive, watch } from 'vue'
import { installTaDemo } from './taDemo'
import type { AiKeySettings, TokenUsage } from '@/api/teacherAi'
import type { TaPermission } from '@/api/ta'
import { installCompletedExample } from './completedInquiryDemo'
import type { ClassSummary, IndividualReport, InquirySetup } from '@/api/inquiry'

export type DbRole = 'USER' | 'TEACHER' | 'SUPERADMIN'

export interface DbUser {
  id: string
  account: string
  name: string
  password: string
  role: DbRole
  must_change_password: boolean
  created_at: string
}

export interface DbCourse {
  id: string
  name: string
  description: string
  invite_code: string
  teacher_id: string
  created_at: string
}

export interface DbEnrollment {
  role?: 'STUDENT' | 'TA'
  permissions?: TaPermission[]
  previous_student?: boolean
  course_id: string
  student_id: string
  joined_at: string
}

export interface DbTopic {
  id: string
  course_id: string
  title: string
  description: string
  age_range: string
  max_rounds: number
  created_at: string
  setup?: InquirySetup
  setup_version?: number
  source_language?: 'zh-TW' | 'en' | 'es'
  model_id?: string
  publication_status?: 'draft' | 'published'
  summary_draft?: ClassSummary
  summary_published?: ClassSummary
}

export interface DbConclusion {
  id: string
  topic_id: string
  title: string
  description: string
}

export interface DbMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
}

export interface DbSession {
  id: string
  topic_id: string
  student_id: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'
  is_anonymous: boolean
  conclusion_id: string | null
  summary: string
  messages: DbMessage[]
  setup_snapshot?: InquirySetup
  model_id?: string
  awaiting_end_consent?: boolean
  goal_achieved?: boolean
  completed_at?: string
  completion_reason?: 'max_turns' | 'goal_met_and_consented'
  report?: IndividualReport
  processed_requests?: Record<
    string,
    {
      message_id: string
      remaining_rounds: number
      is_completed: boolean
      is_guiding_question: boolean
      awaiting_end_consent: boolean
    }
  >
}

export interface Db {
  ai_settings?: Record<string, AiKeySettings>
  ai_usage?: Record<string, TokenUsage>
  ta_demo_version?: number
  completed_example_version?: number
  users: DbUser[]
  courses: DbCourse[]
  enrollments: DbEnrollment[]
  topics: DbTopic[]
  conclusions: DbConclusion[]
  sessions: DbSession[]
}

/** 所有假帳號的密碼都一樣，方便 Demo */
export const DEMO_PASSWORD = 'password123'

let counter = 0
export function newId(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

export function newInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n, 1)).toISOString()

const STUDENT_NAMES = [
  '王小明',
  '林怡君',
  '陳冠宇',
  '張雅婷',
  '李承翰',
  '黃詩涵',
  '吳柏翰',
  '劉品妤',
  '蔡宗翰',
  '楊子晴',
  '許家豪',
  '鄭心怡',
]

function user(id: string, account: string, name: string, role: DbRole, n: number): DbUser {
  return {
    id,
    account,
    name,
    password: DEMO_PASSWORD,
    role,
    must_change_password: false,
    created_at: day(n),
  }
}

function aiOpening(topic: DbTopic) {
  if (topic.setup) return topic.setup.opening_message
  return `你好！今天我們來想一想：「${topic.title}」。先不用急著找標準答案，說說你的第一個想法是什麼？為什麼會這樣想？`
}

function transcript(topic: DbTopic, studentLines: string[]): DbMessage[] {
  const replies = [
    '這個想法很有意思。你說的這一點，有沒有可能在某些情況下不成立？可以舉個例子嗎？',
    '如果換成站在另一方的角度，他們會怎麼反駁你？',
    '你剛剛提到的兩個理由，哪一個比較重要？為什麼？',
  ]
  const closing = '謝謝你的分享！你已經從不同角度思考過這個問題了，這次的討論就到這裡。'
  const messages: DbMessage[] = [{ id: newId('msg'), role: 'assistant', content: aiOpening(topic) }]
  studentLines.forEach((line, i) => {
    messages.push({ id: newId('msg'), role: 'user', content: line })
    messages.push({
      id: newId('msg'),
      role: 'assistant',
      content: i === studentLines.length - 1 ? closing : (replies[i % replies.length] ?? ''),
    })
  })
  return messages
}

export function createSeed(): Db {
  const users: DbUser[] = [
    user('u-admin', 'admin', '系統管理員', 'SUPERADMIN', 0),
    user('u-wang', 'wang', '王老師', 'TEACHER', 1),
    user('u-lin', 'lin', '林老師', 'TEACHER', 2),
    user('u-chen', 'chen', '陳老師', 'TEACHER', 3),
    ...STUDENT_NAMES.map((name, i) =>
      user(`u-s${i + 1}`, `s${String(i + 1).padStart(3, '0')}`, name, 'USER', 4 + i),
    ),
  ]
  const chen = users.find((u) => u.id === 'u-chen')
  if (chen) chen.must_change_password = true

  const courses: DbCourse[] = [
    {
      id: 'c-phil',
      name: '哲學概論',
      description: '從日常問題出發，練習提問與論證。',
      invite_code: 'PHIL01',
      teacher_id: 'u-wang',
      created_at: day(5),
    },
    {
      id: 'c-civic',
      name: '公民與社會',
      description: '討論公共議題，理解不同立場。',
      invite_code: 'CIVIC2',
      teacher_id: 'u-wang',
      created_at: day(6),
    },
    {
      id: 'c-ethic',
      name: '倫理學入門',
      description: '什麼是對的事？',
      invite_code: 'ETHIC3',
      teacher_id: 'u-lin',
      created_at: day(7),
    },
  ]

  const enrollments: DbEnrollment[] = []
  for (let i = 1; i <= 12; i += 1) {
    enrollments.push({ course_id: 'c-phil', student_id: `u-s${i}`, joined_at: day(8) })
    if (i <= 8) enrollments.push({ course_id: 'c-civic', student_id: `u-s${i}`, joined_at: day(9) })
    if (i >= 6) enrollments.push({ course_id: 'c-ethic', student_id: `u-s${i}`, joined_at: day(9) })
  }

  const topics: DbTopic[] = [
    {
      id: 't-lie',
      course_id: 'c-phil',
      title: '善意的謊言是對的嗎？',
      description: '為了不讓別人難過而說謊，可以被接受嗎？',
      age_range: '13-15',
      max_rounds: 5,
      created_at: day(10),
    },
    {
      id: 't-ai',
      course_id: 'c-phil',
      title: 'AI 寫的作業算是自己的作品嗎？',
      description: '使用 AI 工具完成作業，界線在哪裡？',
      age_range: '16-18',
      max_rounds: 10,
      created_at: day(11),
    },
    {
      id: 't-free',
      course_id: 'c-phil',
      title: '自由是想做什麼就做什麼嗎？',
      description: '',
      age_range: 'university_plus',
      max_rounds: 15,
      created_at: day(12),
    },
    {
      id: 't-uniform',
      course_id: 'c-civic',
      title: '學校應該強制穿制服嗎？',
      description: '',
      age_range: '13-15',
      max_rounds: 5,
      created_at: day(13),
    },
    {
      id: 't-trolley',
      course_id: 'c-ethic',
      title: '電車難題：你會拉下拉桿嗎？',
      description: '',
      age_range: '16-18',
      max_rounds: 10,
      created_at: day(14),
    },
  ]

  const conclusions: DbConclusion[] = [
    {
      id: 'k-lie-ok',
      topic_id: 't-lie',
      title: '看情況可以',
      description: '出於保護他人且不造成傷害時可以接受。',
    },
    {
      id: 'k-lie-no',
      topic_id: 't-lie',
      title: '不應該說謊',
      description: '誠實是信任的基礎，長期來看傷害更大。',
    },
    {
      id: 'k-lie-mid',
      topic_id: 't-lie',
      title: '要看對象',
      description: '對小孩或病人可以，對朋友不行。',
    },
    {
      id: 'k-ai-yes',
      topic_id: 't-ai',
      title: '算，工具而已',
      description: '就像用計算機，重點是自己的想法。',
    },
    {
      id: 'k-ai-no',
      topic_id: 't-ai',
      title: '不算',
      description: '沒有經過自己思考的內容不是自己的作品。',
    },
    { id: 'k-uni-yes', topic_id: 't-uniform', title: '應該', description: '' },
    { id: 'k-uni-no', topic_id: 't-uniform', title: '不應該', description: '' },
  ]

  const lieTopic = topics[0] as DbTopic
  const aiTopic = topics[1] as DbTopic
  const sessions: DbSession[] = []
  const lieAnswers: [number, string, boolean][] = [
    [2, 'k-lie-ok', false],
    [3, 'k-lie-no', true],
    [4, 'k-lie-ok', false],
    [5, 'k-lie-mid', false],
    [6, 'k-lie-ok', true],
    [7, 'k-lie-no', false],
  ]
  for (const [n, conclusionId, anonymous] of lieAnswers) {
    sessions.push({
      id: `sess-lie-${n}`,
      topic_id: 't-lie',
      student_id: `u-s${n}`,
      status: 'COMPLETED',
      is_anonymous: anonymous,
      conclusion_id: conclusionId,
      summary: '認為說謊的動機和結果都要一起考慮。',
      messages: transcript(lieTopic, [
        '我覺得有時候可以，例如朋友準備的禮物我不喜歡，我還是會說喜歡。',
        '如果他之後發現了，可能會覺得被騙，但當下他會很開心。',
        '我覺得感受比較重要，因為我們是朋友。',
        '嗯，可是如果是很重要的事情，我就會說實話。',
        '所以要看事情的嚴重程度。',
      ]),
    })
  }
  // 王小明（s001）：第一題已完成、第二題進行中
  sessions.push({
    id: 'sess-lie-1',
    topic_id: 't-lie',
    student_id: 'u-s1',
    status: 'COMPLETED',
    is_anonymous: false,
    conclusion_id: 'k-lie-ok',
    summary: '善意謊言可以保護他人感受，但重大事情應該誠實。',
    messages: transcript(lieTopic, [
      '我覺得善意的謊言有時候是對的，因為可以保護別人的感受。',
      '例如朋友生病很嚴重，我不會直接說他的狀況很糟。',
      '他們可能會說我不尊重他知道真相的權利。',
      '我覺得保護感受比較重要，但如果是很重要的決定，他還是應該知道。',
      '所以我的結論是看情況，小事可以，大事要誠實。',
    ]),
  })
  sessions.push({
    id: 'sess-ai-1',
    topic_id: 't-ai',
    student_id: 'u-s1',
    status: 'IN_PROGRESS',
    is_anonymous: false,
    conclusion_id: null,
    summary: '',
    messages: transcript(aiTopic, ['我覺得算，因為題目是我想的，AI 只是幫我寫出來。', '']).slice(
      0,
      3,
    ),
  })
  for (const n of [2, 3, 4]) {
    sessions.push({
      id: `sess-ai-${n}`,
      topic_id: 't-ai',
      student_id: `u-s${n}`,
      status: 'COMPLETED',
      is_anonymous: n === 3,
      conclusion_id: n === 2 ? 'k-ai-no' : 'k-ai-yes',
      summary: '區分了「想法」和「表達」的差別。',
      messages: transcript(aiTopic, ['我覺得要看用了多少。', '如果全部都是 AI 寫的就不算。']),
    })
  }

  const seed: Db = { users, courses, enrollments, topics, conclusions, sessions }
  installCompletedExample(seed)
  installTaDemo(seed)
  return seed
}

const STORAGE_KEY = 'socratesbot-mock-db'

function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Db
      if (saved.completed_example_version !== 5 || saved.ta_demo_version !== 1) {
        installCompletedExample(saved)
        installTaDemo(saved)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
        } catch {
          /* Keep the upgraded data in memory. */
        }
      }
      return saved
    }
  } catch {
    // localStorage 不能用（無痕模式等）就用初始資料
  }
  return createSeed()
}

export const db = reactive<Db>(load())

watch(
  db,
  () => {
    try {
      const serialized = JSON.stringify(db)
      if (localStorage.getItem(STORAGE_KEY) !== serialized)
        localStorage.setItem(STORAGE_KEY, serialized)
    } catch {
      // 存不了就算了，只影響重新整理後的資料
    }
  },
  { deep: true },
)

export function syncDbFromStorage() {
  if (import.meta.env.MODE !== 'mock') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && raw !== JSON.stringify(db)) {
      const saved = JSON.parse(raw) as Db
      if (
        Array.isArray(saved.users) &&
        Array.isArray(saved.courses) &&
        Array.isArray(saved.enrollments)
      )
        Object.assign(db, saved)
    }
  } catch {
    /* Keep the current demo state when storage is unavailable. */
  }
}
if (import.meta.env.MODE === 'mock' && typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) syncDbFromStorage()
  })

export function resetDb() {
  Object.assign(db, createSeed())
}

export { aiOpening }
