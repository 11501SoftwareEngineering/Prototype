import type { TeachingAccess } from './ta'
import { apiClient } from './client'

/**
 * 老師端：課程、題目、結論、學生名單。
 * 依 docs/API功能規格.md「老師端模組」。後端還沒做好，欄位名稱是照規格推測的，
 * 串接時要跟後端核對 Pydantic schema。標 ⚠️ 的是規格裡沒有、前端先假設的。
 */

export interface TeacherCourse {
  course_id: string
  name: string
  description: string | null
  invite_code: string
  student_count: number
  topic_count: number
}

export interface CoursePayload {
  name: string
  description: string
}

/** Figma「新增問題」的年齡層選項 ⚠️ 欄位名稱 age_range 是前端假設的 */
export const AGE_RANGES = ['13-15', '16-18', 'university_plus'] as const
export type AgeRange = (typeof AGE_RANGES)[number]

/** Figma「新增問題」的回合數選項 ⚠️ 欄位名稱 max_rounds 是前端假設的 */
export const ROUND_OPTIONS = [
  { value: 5, label: '簡短' },
  { value: 10, label: '標準' },
  { value: 15, label: '較長' },
] as const

export interface TeacherTopic {
  topic_id: string
  title: string
  description: string | null
  age_range: string | null
  max_rounds: number | null
  conclusion_count: number
  /** 已完成作答的學生人數 */
  answered_count: number
  publication_status?: 'draft' | 'published'
  setup_version?: number
}

export interface TeacherCourseTopics {
  default_model_id?: string
  access?: TeachingAccess
  student_count?: number
  course_id: string
  name: string
  invite_code: string
  topics: TeacherTopic[]
}

export interface TopicPayload {
  course_id: string
  title: string
  description?: string
  age_range: string
  max_rounds: number
}

export interface CourseStudent {
  student_id: string
  account: string
  name: string
  joined_at: string
}

export interface ConclusionStudent {
  student_id: string
  display_name: string
}

export interface Conclusion {
  conclusion_id: string
  title: string
  description: string | null
  count: number
  percentage: number
  students: ConclusionStudent[]
}

export interface TopicConclusions {
  topic_id: string
  total_answered: number
  conclusions: Conclusion[]
}

export interface ConclusionPayload {
  title: string
  description: string
}

export interface StudentArgument {
  student_id: string
  display_name: string
  is_anonymous: boolean
  conclusion_id: string | null
  conclusion_title: string | null
  summary: string
}

export interface TeacherTopicAnalytics {
  total_answered: number
  arguments: StudentArgument[]
}

export const teacherKeys = {
  courses: ['teacher', 'courses'] as const,
  course: (courseId: string) => ['teacher', 'course', courseId] as const,
  students: (courseId: string) => ['teacher', 'course', courseId, 'students'] as const,
  conclusions: (topicId: string) => ['teacher', 'topic', topicId, 'conclusions'] as const,
  analytics: (topicId: string) => ['teacher', 'topic', topicId, 'analytics'] as const,
}

const enc = encodeURIComponent

export const teacherApi = {
  async getCourses() {
    const res = await apiClient.get<TeacherCourse[]>('/teacher/courses')
    return res.data
  },
  createCourse(payload: CoursePayload) {
    return apiClient.post('/teacher/courses', payload)
  },
  /** ⚠️ 規格沒有「編輯課程」，路徑是前端假設的 */
  updateCourse(courseId: string, payload: CoursePayload) {
    return apiClient.put(`/teacher/courses/${enc(courseId)}`, payload)
  },
  deleteCourse(courseId: string) {
    return apiClient.delete(`/teacher/courses/${enc(courseId)}`)
  },
  async getCourseTopics(courseId: string) {
    const res = await apiClient.get<TeacherCourseTopics>(`/teacher/courses/${enc(courseId)}/topics`)
    return res.data
  },
  async getCourseStudents(courseId: string) {
    const res = await apiClient.get<CourseStudent[]>(`/teacher/courses/${enc(courseId)}/students`)
    return res.data
  },
  removeStudent(courseId: string, studentId: string) {
    return apiClient.delete(`/teacher/courses/${enc(courseId)}/students/${enc(studentId)}`)
  },
  createTopic(payload: TopicPayload) {
    return apiClient.post('/teacher/topics', payload)
  },
  updateTopic(topicId: string, payload: TopicPayload) {
    return apiClient.put(`/teacher/topics/${enc(topicId)}`, payload)
  },
  deleteTopic(topicId: string) {
    return apiClient.delete(`/teacher/topics/${enc(topicId)}`)
  },
  async getConclusions(topicId: string) {
    const res = await apiClient.get<TopicConclusions>(`/teacher/topics/${enc(topicId)}/conclusions`)
    return res.data
  },
  createConclusion(topicId: string, payload: ConclusionPayload) {
    return apiClient.post(`/teacher/topics/${enc(topicId)}/conclusions`, payload)
  },
  deleteConclusion(topicId: string, conclusionId: string) {
    return apiClient.delete(`/teacher/topics/${enc(topicId)}/conclusions/${enc(conclusionId)}`)
  },
  async getTopicAnalytics(topicId: string) {
    const res = await apiClient.get<TeacherTopicAnalytics>(
      `/teacher/topics/${enc(topicId)}/analytics`,
    )
    return res.data
  },
}
