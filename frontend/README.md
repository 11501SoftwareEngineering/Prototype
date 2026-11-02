# SocratesBot v0.2 prototype 前端

Vue 3 三階段教學介面：教師課程設定、學生蘇格拉底對話、教師審閱及發布全班觀點摘要。

此為 **DO NOT MERGE** 原型儲存庫。首次下載、安裝、示範帳號與打包說明請先看 [根目錄 README](../README.md)；前後端工作以 [v0.2 spec](../docs/SocratesBot_v0.2_前後端開發規格書.md) 為基線。

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install --frozen-lockfile
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

請在 `frontend` 目錄執行，並開啟終端機顯示的網址。首頁介紹三階段教學流程，公告位於 `/announcements`；課程頁位於 `/student/courses/:courseId`，需要學生登入與既有課程 API。

### Demo 模式（不用後端，用假資料）

```sh
pnpm dev:mock      # 開發用，打開終端機顯示的網址
pnpm build:demo    # 打包成可以部署的 Demo 版（dist/）
```

- 所有 `/api/v1/...` 請求會被瀏覽器裡的假後端（`src/mocks/`，用 MSW）攔截，前端程式完全不用改。
- 左下角的 **🐞 Debug** 按鈕可以：一鍵切換學生／老師／管理員、讓某組 API 變成空資料／錯誤／很慢／一直載入、新增課程／問題／學生、讓全班完成作答、直接結束對話、新增公告、重置假資料。
- 助教示範：`ta / password123`，可在「哲學概論 → 助教與權限」調整四項勾選權限。發布與刪除仍由老師執行。
- 教師首頁以「AI 模型與用量」單一卡片整合 token 統計、四種模型與 OpenRouter 本月金額，並共用重新整理按鈕；「API key 設定」可開啟金鑰欄位。示範模式不保存真正的金鑰，也不會向 OpenRouter 計費。
- 假帳號：學生 `s001`～`s012`、老師 `wang` `lin` `chen`（chen 第一次登入要改密碼）、管理員 `admin`，密碼都是 `password123`。
- 假資料存在瀏覽器的 localStorage，重新整理不會不見。
- 完成示範：教師登入後，進入「哲學概論 → 善意的謊言是對的嗎？」。已放入 12 份結構化報告、3 組觀點、2 位尚未形成明確觀點者及已發布摘要；提供「摘要審閱」「學生報告」兩個分頁。老師直接檢視摘要並審閱發布，不再顯示摘要編輯區塊或學生版預覽；點擊 Perspective 卡片會依觀點 tag 篩選學生報告。有編輯摘要權限的助教仍可修訂草稿，交由老師發布。
- 課程設定保留「給 AI 的回饋／釐清回答」「依回饋重新產生」，也可單獨重新產生開場訊息。新產生內容須另行儲存或發布。
- 已發布活動的八欄、內容語言與模型均鎖定，不再提供編輯入口；舊編輯網址僅供檢視，MSW 的新舊修改端點也會拒絕變更。
- 原深藍工作區改為淺米色，首頁、師生課程、報告、模型卡片與學生對話統一使用共用色票。
- 新版三階段 API 合約、最新產品決定與正式串接項目見 [前端三階段串接](../docs/前端三階段串接.md)。示範資料與本機模擬不會呼叫真正的 AI。
- 後端做好之後，用一般的 `pnpm dev` 就會打真的後端；正式版打包（`pnpm build`）不會啟用假後端和 Debug 面板。
- API 規格沒寫、前端先假設的地方，在 `src/api/*.ts` 用 ⚠️ 標起來了，串接時要跟後端核對。

### 公告資料

公告固定讀取 `src/data/announcements.ts`，可直接修改其中的文字與日期，不會發出公告 API 請求。

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
pnpm exec vitest run
# Node 26 原生 localStorage 與 jsdom 衝突時：
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run
```

### Lint with [ESLint](https://eslint.org/)

```sh
pnpm lint
```

# 前端開發規範

## 資料夾結構與用途

```
frontend/src/
├── api/            # 所有打後端 API 的地方,一個功能領域一個檔案(auth.ts / student.ts / teacher.ts / admin.ts)
├── assets/         # CSS、圖片等靜態資源
├── components/
│   ├── common/     # 跨頁面共用的元件(AppHeader、AppFooter...),新增前先問過組長
│   └── ui/         # shadcn-vue 產生的基礎元件(Button、Input...),不要手動改內容,
│                   # 有新需求就用 `pnpm dlx shadcn-vue@latest add <元件>` 補
├── composables/    # 可重複使用的邏輯(語音錄音、SSE 串流等),用 useXxx 命名
├── layouts/        # 版型(目前只有 DefaultLayout,一般不用新增)
├── lib/            # 工具函式(目前只有 cn())
├── router/         # 路由設定,新增頁面一定要加 meta.roles
├── stores/         # Pinia store,一個功能領域一個檔案(auth.ts、chat.ts...)
└── views/          # 實際頁面,依角色分資料夾:auth / student / teacher / admin / common
```

## 新增一個頁面的標準流程

1. 確認這個功能對應 `docs/API功能規格.md` 的哪一段,把要用到的 API 記下來。
2. 如果 `src/api/` 裡對應的檔案(student.ts / teacher.ts / admin.ts)還沒有這個 API,補上去
   (型別 + 呼叫函式,照現有的寫法)。
3. 在 `src/views/<角色>/` 底下建立 `.vue` 檔案。畫面邏輯照 `CourseListView.vue` 的寫法:
   - GET 資料用 `useQuery`(來自 `@tanstack/vue-query`),不要自己手刻 loading/error 的一堆 ref。
   - 需要跨頁共用的狀態(例如聊天訊息)才建 Pinia store,單一頁面自己用的狀態就留在
     `.vue` 檔案裡的 `ref`,不要每個頁面都開一個 store。
4. 在 `src/router/index.ts` 加路由,記得加 `meta: { requiresAuth: true, roles: [...] }`,
   角色字串一定要跟 `stores/auth.ts` 的 `UserRole` 一致(`STUDENT` / `TEACHER` / `SUPER_ADMIN`)。
5. 改完執行 `pnpm lint` 和 `pnpm build`,兩個都要過才能發 PR。

## API 呼叫規範

- 絕對不要在 `.vue` 檔案裡直接寫 `axios.get(...)` 或裸的 `fetch(...)`。一定要透過 `src/api/` 底下
  對應的模組,那裡已經統一設定好 Bearer token、錯誤處理跟 baseURL(包含 `/api/v1` 前綴)。
- API 回傳的欄位名稱(例如 `course_id`、`name` 這些)目前是照規格文件的中文描述推測的,
  **不是 100% 準確**,串接時務必跟寫後端的同學核對一次實際的 Pydantic Schema,對不上就更新
  對應的 TypeScript interface。

## 元件與樣式規範

- 顏色、圓角、間距用現有的 design token(`bg-primary`、`text-muted-foreground`、`rounded-md`...),
  不要自己發明新的顏色值(像 `bg-[#1a2b3c]`)。想加新顏色先跟設計師確認要不要加進
  `tailwind.config.js` 的色票裡,大家共用。
- `components/ui/` 底下的元件是 shadcn-vue 生成的,不要手動改裡面的邏輯,有客製化需求
  另外包一層元件,或用 `class` prop 覆蓋樣式就好。

## 環境設定(第一次加入專案時做)

```bash
git clone <repo>
cd frontend
cp .env.example .env      # 確認 VITE_API_BASE_URL 指向後端(預設 http://localhost:8000)
pnpm install
pnpm dev
```

後端要另外用 `docker compose up -d --build`(在 repo 根目錄)啟動,細節看根目錄 README.md。

## 命名規則

- **畫面元件檔名**:PascalCase + 用途,例如 `CourseListView.vue`、`ChatView.vue`。
- **一般 .ts 檔名**:小駝峰或全小寫,例如 `client.ts`、`student.ts`。
- **Composable**:固定 `use` 開頭,檔名跟函式名一致,例如 `useVoiceRecorder.ts`。
- **API 物件**:`<領域>Api`(如 `studentApi`),裡面函式用「動詞+名詞」對應功能說明,
  不是照 HTTP method 命名(例如 `POST /student/courses/join` 寫成 `joinCourse()`,不是 `postJoin()`)。
- **TypeScript interface**:PascalCase 名詞(`Course`、`Topic`),送出去的資料加 `Payload` 後綴
  (`LoginPayload`)。
- **Pinia store**:檔案 `src/stores/<領域>.ts`,函式固定 `use<領域>Store`(`useAuthStore`)。
- **路由 name**:PascalCase,「角色+功能」(`StudentCourses`、`TeacherDashboard`)。
- **一般變數/函式**:camelCase;布林值加 `is`/`has` 開頭;事件處理函式加 `handle` 開頭
  (`isLoading`、`handleSubmit`)。
