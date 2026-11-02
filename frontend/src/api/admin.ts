import { apiClient } from './client'

/**
 * 管理員：老師帳號管理。
 * 欄位名稱已對照後端 backend/app/schemas/admin.py。
 */

export interface Teacher {
  id: string
  account: string
  name: string
  created_at: string
}

export interface CreateTeacherPayload {
  account: string
  name: string
}

/** 建立或重設密碼後回傳的一次性初始密碼，只會出現這一次 */
export interface TeacherPasswordResponse {
  account: string
  name: string
  password: string
}

export const adminKeys = {
  teachers: ['admin', 'teachers'] as const,
}

export const adminApi = {
  async getTeachers() {
    const res = await apiClient.get<Teacher[]>('/admin/teachers')
    return res.data
  },
  async createTeacher(payload: CreateTeacherPayload) {
    const res = await apiClient.post<TeacherPasswordResponse>('/admin/teachers', payload)
    return res.data
  },
  deleteTeacher(teacherId: string) {
    return apiClient.delete(`/admin/teachers/${encodeURIComponent(teacherId)}`)
  },
  /**
   * 重設老師密碼。
   * ⚠️ API 規格還沒有這支，路徑是前端先假設的，後端做好後要核對。
   */
  async resetTeacherPassword(teacherId: string) {
    const res = await apiClient.post<TeacherPasswordResponse>(
      `/admin/teachers/${encodeURIComponent(teacherId)}/reset-password`,
    )
    return res.data
  },
}
