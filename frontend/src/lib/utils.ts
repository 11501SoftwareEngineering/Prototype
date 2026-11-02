import type { ClassValue } from 'clsx'
import axios from 'axios'
import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach the merger our typography and shadow tokens so it preserves colors.
const mergeClasses = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-header',
        'text-h1-title',
        'text-footer',
        'text-h2-title',
        'text-body',
        'text-body-lg',
        'text-caption',
      ],
      shadow: ['shadow-elevated', 'shadow-input'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return mergeClasses(clsx(inputs))
}

// 後端回傳的錯誤訊息是英文，這裡統一翻成畫面要顯示的中文。
// 後端新增錯誤訊息時，把英文原文加進來就好。
const API_ERROR_MESSAGES: Record<string, string> = {
  'Invalid account or password': '帳號或密碼錯誤',
  'Account already exists': '這個帳號已經有人使用',
  'Account name reserved': '這個帳號名稱不能使用',
  'Not authenticated or token expired': '登入已過期，請重新登入',
  'Current password is incorrect': '原密碼輸入錯誤',
  'New password must be different from the current password': '新密碼不能跟原密碼相同',
  'Password change required': '請先修改密碼才能繼續使用',
  'Admin privileges required': '只有管理員可以使用這個功能',
  'Teacher not found': '找不到這位老師',
  'Cannot delete elevated admin account': '不能刪除超級管理員帳號',
  'Session not found': '找不到這段對話',
  'Not the session owner': '這不是你的對話',
  'Topic not found': '找不到這個問題',
  'Course not found': '找不到這門課程',
  'Course membership required': '你還沒有加入這門課程',
  'Invite code not found': '找不到這個課程代碼',
  'Already enrolled': '你已經加入這門課程了',
  'Conclusion not found': '找不到這個結論',
  'Student not found': '找不到這位學生',
  'Session already completed': '這段對話已經結束了',
  'Session not completed': '對話還沒結束，完成後才能看結果',
  'Teacher privileges required': '只有老師可以使用這個功能',
  'Student privileges required': '只有學生可以使用這個功能',
  'Internal Server Error': '伺服器發生錯誤，請稍後再試',
}

// 統一從 axios 錯誤裡撈出後端回傳的錯誤訊息，避免每個畫面都自己寫
// `catch (err: any)` 去猜 err.response.data.detail 長怎樣。
export function getApiErrorMessage(error: unknown, fallback = '發生錯誤，請稍後再試'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return '無法連線到伺服器，請確認網路後再試'
    const detail = error.response.data?.detail
    if (typeof detail === 'string') return API_ERROR_MESSAGES[detail] ?? detail
    // FastAPI 欄位驗證錯誤（422）的 detail 是陣列
    if (Array.isArray(detail)) return '輸入的資料格式不正確，請檢查後再送出'
  }
  return fallback
}
/** 日期顯示成 YYYY-MM-DD（台北時區） */
export function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}
