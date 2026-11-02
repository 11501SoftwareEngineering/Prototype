import { apiClient } from './client'

/**
 * 登入、註冊、帳號相關 API。
 * 欄位名稱已對照後端 backend/app/schemas/auth.py。
 */

/** 前端統一使用的角色名稱（路由 meta.roles、畫面判斷都用這個） */
export type UserRole = 'STUDENT' | 'TEACHER' | 'SUPER_ADMIN'

/** 後端實際回傳的角色字串（backend/app/core/enums.py） */
type BackendRole = 'USER' | 'TEACHER' | 'SUPERADMIN'

// 後端的學生叫 USER、管理員叫 SUPERADMIN，跟前端規範不同。
// 只在這裡轉換一次，其他地方都用前端的名稱。
const ROLE_MAP: Record<BackendRole, UserRole> = {
  USER: 'STUDENT',
  TEACHER: 'TEACHER',
  SUPERADMIN: 'SUPER_ADMIN',
}

export function toUserRole(role: string): UserRole {
  return ROLE_MAP[role as BackendRole] ?? 'STUDENT'
}

export const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: '學生',
  TEACHER: '老師',
  SUPER_ADMIN: '管理員',
}

export interface User {
  account: string
  name: string
  role: UserRole
  has_ta_assignments?: boolean
  preferred_language: string
  /** 管理員建立的老師帳號第一次登入時為 true，要先改密碼才能用其他功能 */
  must_change_password: boolean
}

interface UserResponse extends Omit<User, 'role'> {
  role: string
}

export interface LoginPayload {
  account: string
  password: string
}

export interface RegisterPayload {
  account: string
  password: string
  name: string
}

export interface ChangePasswordPayload {
  old_password: string
  new_password: string
}

function toUser(data: UserResponse): User {
  return { ...data, role: toUserRole(data.role) }
}

export const authApi = {
  /** 登入。後端把 access token 放在回應的 Authorization header，不在 JSON 裡 */
  async login(payload: LoginPayload) {
    const res = await apiClient.post<UserResponse>('/auth/login', payload, {
      withCredentials: true,
    })
    const header = String(res.headers.authorization ?? '')
    const token = header.replace(/^Bearer\s+/i, '')
    return { token, user: toUser(res.data) }
  },
  register(payload: RegisterPayload) {
    return apiClient.post('/auth/register', payload)
  },
  /** 登出（清掉後端的 refresh cookie）。失敗也沒關係，前端照樣清除登入狀態 */
  logout() {
    return apiClient.post('/auth/logout', null, { withCredentials: true })
  },
  async getMe() {
    const res = await apiClient.get<UserResponse>('/users/me')
    return toUser(res.data)
  },
  changePassword(payload: ChangePasswordPayload) {
    return apiClient.put<{ message: string }>('/auth/password', payload)
  },
}
