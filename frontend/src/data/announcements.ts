// 公告直接改這個檔案就好，不需要 API。
// （Demo 模式下 Debug 面板可以臨時新增公告，重新整理後就會消失。）
import { reactive } from 'vue'

export interface Announcement {
  id: string
  title: string
  content: string
  published_at: string
}

export const announcements = reactive<Announcement[]>([
  {
    id: 'welcome',
    title: '歡迎使用問導魷',
    content:
      '問導魷會用提問的方式陪你思考問題，沒有標準答案，重點是說出你的理由。\n學生請先用老師給的課程代碼加入課程。',
    published_at: '2026-10-20T09:00:00+08:00',
  },
  {
    id: 'maintenance',
    title: '系統維護通知',
    content: '10 月 25 日（日）凌晨 2:00～4:00 進行系統維護，期間暫停服務。',
    published_at: '2026-10-18T10:00:00+08:00',
  },
  {
    id: 'voice',
    title: '新功能：語音輸入',
    content: '對話時可以按麥克風直接用說的回答，系統會自動轉成文字。',
    published_at: '2026-10-13T09:00:00+08:00',
  },
])
