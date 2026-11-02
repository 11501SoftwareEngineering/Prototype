import { onScopeDispose, ref } from 'vue'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { API_BASE_URL } from '@/api/client'
import type { StreamDone } from '@/api/student'

/** 串流失敗時丟出的錯誤，格式模仿 axios，這樣 getApiErrorMessage 也能用 */
export class StreamError extends Error {
  isAxiosError = true
  response?: { status: number; data: unknown }
  constructor(status: number, data: unknown) {
    super(`Stream failed with status ${status}`)
    this.response = { status, data }
  }
}

/**
 * 蘇格拉底對話串流（SSE）。
 * 對應 API: POST /student/sessions/{sessionId}/messages/stream
 *
 * 瀏覽器原生的 EventSource 只支援 GET、也不能帶 Authorization header，
 * 這個 API 是 POST + 需要帶 token，所以用 @microsoft/fetch-event-source。
 *
 * 事件格式（⚠️ 規格只寫了「串流文字片段、訊息代號、是否為引導反詰」，細節前端先假設）：
 *   data: 文字片段             ← 一般訊息，逐段接起來
 *   event: done / data: {…}   ← 最後一個，帶 StreamDone（剩餘回合數、是否結束）
 */
export function useChatStream() {
  const isStreaming = ref(false)
  let activeController: AbortController | null = null
  onScopeDispose(() => activeController?.abort())

  async function streamMessage(
    sessionId: string,
    content: string,
    handlers: { onChunk: (chunk: string) => void; onDone?: (done: StreamDone) => void },
    requestId: string = crypto.randomUUID(),
  ) {
    isStreaming.value = true
    const token = localStorage.getItem('access_token')
    const controller = new AbortController()
    activeController = controller
    let receivedDone = false
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 60000)

    try {
      await fetchEventSource(
        `${API_BASE_URL}/student/sessions/${encodeURIComponent(sessionId)}/messages/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ content, request_id: requestId }),
          signal: controller.signal,
          openWhenHidden: true,
          async onopen(response) {
            if (response.ok) return
            const data = await response.json().catch(() => ({}))
            throw new StreamError(response.status, data)
          },
          onmessage(event) {
            if (event.event === 'done') {
              receivedDone = true
              handlers.onDone?.(JSON.parse(event.data) as StreamDone)
              controller.abort()
              return
            }
            if (!event.event || event.event === 'message') handlers.onChunk(event.data)
          },
          onclose() {
            if (!receivedDone) throw new Error('Stream closed before completion')
          },
          onerror(err) {
            // 丟出錯誤讓 fetchEventSource 停止自動重試，由呼叫端處理
            throw err
          },
        },
      )
    } catch (err) {
      if (timedOut) throw new StreamError(504, { detail: '回應等候逾時，請重新載入已保存的對話。' })
      if (controller.signal.aborted && receivedDone) return
      throw err
    } finally {
      clearTimeout(timeout)
      if (activeController === controller) activeController = null
      isStreaming.value = false
    }
  }

  return { isStreaming, streamMessage }
}
