import axios from 'axios'
import { QueryClient } from '@tanstack/vue-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx（沒權限、找不到）重試也沒用；其他錯誤重試一次就好，不要讓使用者等太久
      retry: (failureCount, error) => {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined
        if (status && status >= 400 && status < 500) return false
        return failureCount < 1
      },
      staleTime: 30_000,
    },
  },
})
