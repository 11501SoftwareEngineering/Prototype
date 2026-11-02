import { apiClient } from './client'
export const TA_PERMISSIONS = [
  {
    key: 'view_reports',
    label: '檢視學生報告',
    description: '查看個人觀點、tag 與對話變化時間軸。',
  },
  {
    key: 'edit_activities',
    label: '編輯活動',
    description: '整理八欄設定、重產內容及儲存活動草稿。',
  },
  {
    key: 'edit_summary',
    label: '編輯全班摘要',
    description: '產生及修訂摘要草稿，交由老師審閱發布。',
  },
  { key: 'view_members', label: '檢視學生名單', description: '查看課程學生名單與課程代碼。' },
] as const
export type TaPermission = (typeof TA_PERMISSIONS)[number]['key']
export const DEFAULT_TA_PERMISSIONS: TaPermission[] = [
  'view_reports',
  'edit_activities',
  'edit_summary',
  'view_members',
]
export interface TeachingAccess {
  role: 'TEACHER' | 'TA'
  permissions: TaPermission[]
}
export interface CourseTa {
  student_id: string
  account: string
  name: string
  permissions: TaPermission[]
}
export const taKeys = { members: (id: string) => ['teacher', 'course', id, 'tas'] as const }
export const taApi = {
  async getMembers(id: string) {
    return (await apiClient.get<CourseTa[]>(`/teacher/courses/${encodeURIComponent(id)}/tas`)).data
  },
  async addMember(id: string, account: string, permissions: TaPermission[]) {
    return (
      await apiClient.post<CourseTa>(`/teacher/courses/${encodeURIComponent(id)}/tas`, {
        account,
        permissions,
      })
    ).data
  },
  async updateMember(id: string, memberId: string, permissions: TaPermission[]) {
    return (
      await apiClient.patch<CourseTa>(
        `/teacher/courses/${encodeURIComponent(id)}/tas/${encodeURIComponent(memberId)}`,
        { permissions },
      )
    ).data
  },
  removeMember(id: string, memberId: string) {
    return apiClient.delete(
      `/teacher/courses/${encodeURIComponent(id)}/tas/${encodeURIComponent(memberId)}`,
    )
  },
}
