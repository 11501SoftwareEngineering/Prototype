/// <reference types="vite/client" />
/// <reference types="pinia-plugin-persistedstate" />

interface ImportMetaEnv {
  /** 後端網址，預設 http://localhost:8000 */
  readonly VITE_API_BASE_URL?: string
  /** 'true' 時用瀏覽器裡的假後端（MSW），並顯示 Debug 面板 */
  readonly VITE_USE_MOCK?: string
}
