import { apiClient } from './client'

/**
 * 學生端：課程、題目、對話、結果。
 * 依 docs/API功能規格.md「學生端」。建立 Session、匿名設定已對照後端 schema，
 * 其他欄位是照規格推測的。標 ⚠️ 的是規格裡沒有、前端先假設的。
 */

export interface Course {
  course_id: string
  name: string
  invite_code: string
  teacher_name: string
  active_topic_count: number
}

export type TopicStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'

export interface Topic {
  topic_id: string
  title: string
  description: string | null
  status: TopicStatus
  session_id: string | null
  /** ⚠️ 年齡層、回合數規格沒定義，前端先假設 */
  age_range?: string | null
  max_rounds?: number | null
  content_language?: string
}

export interface CourseTopics {
  course_id: string
  name: string
  invite_code: string
  topics: Topic[]
}

export interface JoinCourseResponse {
  course_id: string
  name: string
  invite_code: string
  message: string
}

export interface TopicExplanation {
  title: string
  background: string
  key_terms: string[]
}

export interface CreateSessionResponse {
  session_id: string
  topic_id: string
}

export interface ChatMessage {
  message_id: string
  role: 'assistant' | 'user'
  content: string
}

/** ⚠️ 重新進入對話時拿歷史訊息，規格沒有這支，前端先假設 */
export interface SessionMessages {
  session_id: string
  topic_id: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'
  max_rounds: number
  remaining_rounds: number
  messages: ChatMessage[]
  awaiting_end_consent?: boolean
  goal_achieved?: boolean
  completion_reason?: string
}

/** 串流最後一個 `event: done` 帶的資料 ⚠️ 格式是前端先假設的 */
export interface StreamDone {
  message_id: string
  is_guiding_question: boolean
  remaining_rounds: number
  is_completed: boolean
  awaiting_end_consent?: boolean
}

export interface SessionResult {
  session_id: string
  topic_id: string
  conclusion_id: string | null
  conclusion_title: string | null
  is_anonymous: boolean
}

export interface AnalyticsConclusion {
  conclusion_id: string
  title: string
  count: number
  percentage: number
  students: { student_id: string; display_name: string }[]
}

export interface StudentTopicAnalytics {
  topic_id: string
  total_answered: number
  conclusions: AnalyticsConclusion[]
}

export const studentKeys = {
  courses: ['student', 'courses'] as const,
  course: (courseId: string) => ['student', 'course', courseId] as const,
  messages: (sessionId: string) => ['student', 'session', sessionId, 'messages'] as const,
  result: (sessionId: string) => ['student', 'session', sessionId, 'result'] as const,
  analytics: (topicId: string) => ['student', 'topic', topicId, 'analytics'] as const,
}

const enc = encodeURIComponent

export const studentApi = {
  async getCourses() {
    const res = await apiClient.get<Course[]>('/student/courses')
    return res.data
  },
  async joinCourse(inviteCode: string) {
    const res = await apiClient.post<JoinCourseResponse>('/student/courses/join', {
      invite_code: inviteCode,
    })
    return res.data
  },
  leaveCourse(courseId: string) {
    return apiClient.delete(`/student/courses/${enc(courseId)}`)
  },
  async getCourseTopics(courseId: string, signal?: AbortSignal) {
    const res = await apiClient.get<CourseTopics>(`/student/courses/${enc(courseId)}/topics`, {
      signal,
    })
    return res.data
  },
  async getTopicExplanation(topicId: string) {
    const res = await apiClient.get<TopicExplanation>(`/student/topics/${enc(topicId)}/explanation`)
    return res.data
  },
  async createSession(topicId: string) {
    const res = await apiClient.post<CreateSessionResponse>(
      `/student/topics/${enc(topicId)}/sessions`,
    )
    return res.data
  },
  async getSessionMessages(sessionId: string) {
    const res = await apiClient.get<SessionMessages>(`/student/sessions/${enc(sessionId)}/messages`)
    return res.data
  },
  // 語音辨識：錄好的 Blob 直接上傳，後端回傳轉錄文字。
  // 欄位名稱 "file" 請跟後端確認 FastAPI UploadFile 參數名稱。
  async transcribeAudio(audioBlob: Blob) {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    const res = await apiClient.post<{ text: string }>('/student/audio/transcribe', formData)
    return res.data
  },
  async getSessionResult(sessionId: string) {
    const res = await apiClient.get<SessionResult>(`/student/sessions/${enc(sessionId)}/result`)
    return res.data
  },
  updatePrivacy(sessionId: string, isAnonymous: boolean) {
    return apiClient.patch(`/student/sessions/${enc(sessionId)}/privacy`, {
      is_anonymous: isAnonymous,
    })
  },
  async getTopicAnalytics(topicId: string) {
    const res = await apiClient.get<StudentTopicAnalytics>(
      `/student/topics/${enc(topicId)}/analytics`,
    )
    return res.data
  },
}
