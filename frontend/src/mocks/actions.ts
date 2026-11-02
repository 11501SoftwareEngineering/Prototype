/**
 * Debug 面板「假資料」分頁的動作。直接改假資料庫，再讓畫面重新抓資料。
 */
import { announcements } from '@/data/announcements'
import { completeSession } from './handlers'
import { db, newId, newInviteCode, resetDb, type DbSession } from './db'

const COURSE_NAMES = ['邏輯思考', '媒體識讀', '環境倫理', '科技與社會', '生命教育', '經濟學入門']
const TOPIC_TITLES = [
  '考試是評量學習最好的方式嗎？',
  '網路上匿名發言應該被禁止嗎？',
  '動物園應該存在嗎？',
  '人應該為了多數人的利益犧牲少數人嗎？',
  '社群媒體讓我們更孤單了嗎？',
  '學生應該可以自己決定要學什麼嗎？',
]
const FAMILY = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭']
const GIVEN = ['宇翔', '雅琪', '子涵', '承恩', '欣妤', '冠廷', '思妤', '柏宇', '品睿', '佳穎']

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)] as T

/** 目前登入的假帳號（從 token 看出來） */
export function currentMockUser() {
  try {
    const token = localStorage.getItem('access_token') ?? ''
    const id = token.replace(/^mock-token\./, '')
    return db.users.find((u) => u.id === id)
  } catch {
    return undefined
  }
}

export function addCourse() {
  const user = currentMockUser()
  const teacherId = user?.role === 'TEACHER' ? user.id : 'u-wang'
  const name = `${pick(COURSE_NAMES)} ${Math.floor(Math.random() * 90 + 10)}`
  const course = {
    id: newId('c'),
    name,
    description: '用 Debug 面板新增的課程',
    invite_code: newInviteCode(),
    teacher_id: teacherId,
    created_at: new Date().toISOString(),
  }
  db.courses.push(course)
  // 學生登入時，順便把他加進去，馬上看得到
  if (user?.role === 'USER') {
    db.enrollments.push({
      course_id: course.id,
      student_id: user.id,
      joined_at: new Date().toISOString(),
    })
  }
  return `已新增課程「${name}」，課程代碼 ${course.invite_code}`
}

export function addTopic(courseId: string) {
  const course = db.courses.find((c) => c.id === courseId)
  if (!course) return '請先進到某一門課程的頁面'
  const id = newId('t')
  const title = pick(TOPIC_TITLES)
  db.topics.push({
    id,
    course_id: courseId,
    title,
    description: '',
    age_range: pick(['13-15', '16-18', 'university_plus']),
    max_rounds: pick([5, 10, 15]),
    created_at: new Date().toISOString(),
  })
  db.conclusions.push(
    { id: newId('k'), topic_id: id, title: '同意', description: '' },
    { id: newId('k'), topic_id: id, title: '不同意', description: '' },
    { id: newId('k'), topic_id: id, title: '看情況', description: '' },
  )
  return `已在「${course.name}」新增問題「${title}」`
}

export function addStudents(courseId: string, count = 5) {
  const course = db.courses.find((c) => c.id === courseId)
  if (!course) return '請先進到某一門課程的頁面'
  for (let i = 0; i < count; i += 1) {
    const n = db.users.length + 1
    const id = newId('u')
    db.users.push({
      id,
      account: `demo${n}`,
      name: `${pick(FAMILY)}${pick(GIVEN)}`,
      password: 'password123',
      role: 'USER',
      must_change_password: false,
      created_at: new Date().toISOString(),
    })
    db.enrollments.push({
      course_id: courseId,
      student_id: id,
      joined_at: new Date().toISOString(),
    })
  }
  return `已在「${course.name}」加入 ${count} 位學生`
}

/** 讓班上還沒作答的學生全部完成這一題，隨機分到各個結論 */
export function finishTopicForClass(topicId: string) {
  const topic = db.topics.find((t) => t.id === topicId)
  if (!topic) return '請先進到某一個問題的頁面'
  const students = db.enrollments.filter((e) => e.course_id === topic.course_id && e.role !== 'TA')
  let finished = 0
  for (const e of students) {
    let session = db.sessions.find((s) => s.topic_id === topicId && s.student_id === e.student_id)
    if (session?.status === 'COMPLETED') continue
    if (!session) {
      session = {
        id: newId('sess'),
        topic_id: topicId,
        student_id: e.student_id,
        status: 'IN_PROGRESS',
        is_anonymous: Math.random() < 0.3,
        conclusion_id: null,
        summary: '',
        messages: [
          { id: newId('msg'), role: 'assistant', content: `我們來想一想：「${topic.title}」` },
          { id: newId('msg'), role: 'user', content: '我覺得要看情況。' },
        ],
      }
      db.sessions.push(session)
    }
    completeSession(session)
    finished += 1
  }
  return finished ? `已讓 ${finished} 位學生完成這一題` : '全班都已經完成了'
}

/** 直接結束目前學生的這一題對話 */
export function finishMyChat(topicId: string) {
  const user = currentMockUser()
  const session: DbSession | undefined = db.sessions.find(
    (s) => s.topic_id === topicId && s.student_id === user?.id,
  )
  if (!session) return '請先用學生身分進到對話頁'
  if (session.status === 'COMPLETED') return '這段對話已經結束了'
  session.messages.push({
    id: newId('msg'),
    role: 'assistant',
    content: '（Debug）對話已直接結束，可以去看結果了。',
  })
  completeSession(session)
  return '已結束這段對話'
}

const CONCLUSION_POOL = [
  ['完全同意', '認為這個做法沒有問題，理由清楚。'],
  ['完全反對', '認為這樣做會帶來更大的傷害。'],
  ['有條件同意', '在特定情況下可以接受，但要有限制。'],
  ['看情況而定', '要依照對象、場合、後果來判斷。'],
  ['重視結果', '主要從結果好不好來判斷對錯。'],
  ['重視動機', '主要看當事人的出發點是不是善意。'],
  ['重視規則', '認為應該遵守原則，不能因為結果破例。'],
  ['兩難，還沒決定', '看到雙方的道理，還在思考中。'],
  ['換位思考', '從被影響的人的角度重新思考。'],
  ['需要更多資訊', '覺得現在的資訊不足以下判斷。'],
] as const

/** 把這一題已完成的作答重新隨機分到所有結論，讓每個結論都有人 */
function spreadAnswers(topicId: string) {
  const options = db.conclusions.filter((k) => k.topic_id === topicId)
  const done = db.sessions.filter((s) => s.topic_id === topicId && s.status === 'COMPLETED')
  done.forEach((session, i) => {
    session.conclusion_id = options[i % options.length]?.id ?? null
  })
  return done.length
}

/** 找出目前頁面的題目：老師問題頁有 topicId；學生結果頁要從 sessionId 反查 */
export function topicFromRoute(params: Record<string, unknown>) {
  if (typeof params.topicId === 'string') return params.topicId
  if (typeof params.sessionId === 'string') {
    return db.sessions.find((s) => s.id === params.sessionId)?.topic_id ?? ''
  }
  return ''
}

/** 一次新增好幾個結論，並把全班的作答重新分配，用來看「很多結論」的畫面 */
export function addManyConclusions(topicId: string, count = 5) {
  const topic = db.topics.find((t) => t.id === topicId)
  if (!topic) return '請先進到老師的問題頁或學生的結果頁'
  const existing = new Set(db.conclusions.filter((k) => k.topic_id === topicId).map((k) => k.title))
  const fresh = CONCLUSION_POOL.filter(([title]) => !existing.has(title)).slice(0, count)
  for (const [title, description] of fresh) {
    db.conclusions.push({ id: newId('k'), topic_id: topicId, title, description })
  }
  const answered = spreadAnswers(topicId)
  const total = db.conclusions.filter((k) => k.topic_id === topicId).length
  if (!fresh.length) return `結論已經很多了（共 ${total} 個），已重新分配 ${answered} 份作答`
  return `已新增 ${fresh.length} 個結論（共 ${total} 個），並把 ${answered} 份作答重新分配`
}

/** 新增公告；標題、內容沒填就用預設的測試文字 */
export function addAnnouncement(title = '', content = '') {
  const now = new Date()
  announcements.unshift({
    id: `debug-${now.getTime()}`,
    title: title.trim() || `測試公告 ${now.toLocaleTimeString('zh-TW', { hour12: false })}`,
    content:
      content.trim() ||
      '這是用 Debug 面板新增的公告。內容比較長的時候，收合狀態只會顯示第一行，點一下標題可以展開全文。',
    published_at: now.toISOString(),
  })
  return '已新增公告（重新整理後會消失；要永久保留請改 src/data/announcements.ts）'
}

export function clearAnnouncements() {
  announcements.splice(0, announcements.length)
  return '已清空公告（重新整理後會恢復）'
}

export function resetAllData() {
  resetDb()
  return '假資料已重置'
}
