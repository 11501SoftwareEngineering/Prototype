import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

// 後端 API 規格文件（docs/API功能規格.md）裡的路徑都是 /api/v1/... 開頭，
// 例如 /api/v1/auth/login，如果這裡沒有補上 /api/v1，所有請求都會 404。
export const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/v1`

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 登入、註冊時的 401 是「帳號密碼錯誤」，不是登入過期，不能把人踢回登入頁
const AUTH_FORM_PATHS = ['/auth/login', '/auth/register', '/auth/logout']

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url: string = error.config?.url ?? ''
    const isAuthForm = AUTH_FORM_PATHS.some((path) => url.endsWith(path))
    if (status === 401 && !isAuthForm) {
      void useAuthStore().logout({ expired: true })
    }
    // 老師帳號第一次登入要先改密碼，其他 API 會回 403
    if (status === 403 && error.response?.data?.detail === 'Password change required') {
      useAuthStore().requirePasswordChange()
    }
    return Promise.reject(error)
  },
)
