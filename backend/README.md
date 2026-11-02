# Squicrates 後端
## 環境建置

1. 請確認本機已安裝以下工具：
    - Docker & Docker Compose
    - uv
    - Makefile

2. 複製環境設定檔：
    在專案根目錄:
    ```bash
    cp backend/.env.example backend/.env
    cp backend/config.yaml.example backend/config.yaml
    ```
    `.env` 放密鑰；`config.yaml` 放非密鑰本機設定（見下方 Super Admin）。

3. 在 repo 根目錄安裝鎖定的 Python 套件並啟用 pre-commit：
    ```bash
    make -C backend setup
    ```
    `make -C backend setup` 會依 `backend/uv.lock` 安裝套件並安裝 Git hook。提交時 Ruff 會修正 backend Python 的 lint 與格式問題，Gitleaks 會掃描整個 repo 的 staged 內容。

## 設定 Super Admin

管理員權限是靠 `backend/config.yaml` 的帳號名單提升，**不是**改資料庫的 `role`。login / `/users/me` 仍可能回 `USER` 或 `TEACHER`；名單內帳號才能打 `/admin/*`。

1. 先用一般流程註冊並確認帳號的 `account_id`（註冊／登入用的帳號字串）。
2. 編輯 `backend/config.yaml`（沒有就從 example 複製）：

    ```yaml
    # Schema: app.core.yaml_config.YamlConfig
    SUPER_ADMIN_ACCOUNTS: [alice]
    ```

    把 `alice` 換成你的 `account_id`。不需要 admin 時設成 `[]`。
3. **重啟** `make -C backend dev`（設定在行程啟動時載入，改檔後不會熱更新）。
4. `config.yaml` 已 gitignore，不要 commit。

格式範本：`backend/config.yaml.example`。

## 啟動開發伺服器
1. 啟動 docker 容器，裡面有 PostgreSQL 和 Redis. 
    在專案根目錄執行：
    ```bash
    make -C backend db-dev
    ```

    檢查容器狀態：
    ```bash
    docker compose ps
    ```

    關閉容器
    ```bash
    make -C backend db-dev-down
    ```

2. 啟動 FastAPI：
```bash
make -C backend dev
```
API 文件:
http://localhost:8000/docs 
http://localhost:8000/redoc

確認 PostgreSQL 與 Redis 連線狀態:
http://localhost:8000/api/v1/health

### GitHub Pages 預覽（靜態 OpenAPI）

CI 會把與本機 `/docs` 同款的靜態 Swagger UI 發到 GitHub Pages（需在 repo Settings → Pages 將 Source 設為 **GitHub Actions**，並視情況保護 `github-pages` Environment）。僅在變更 `backend/**` 或此 workflow 時部署（可用 Actions → API Docs Pages → Run workflow 手動重建）：

- Swagger：`https://<owner>.github.io/<repo>/docs/`
- Redocly：`https://<owner>.github.io/<repo>/redoc/`
- 同 repo PR：`https://<owner>.github.io/<repo>/pr-preview/pr-<n>/docs/`（fork PR 不處理）

本機匯出／預覽（檔案預設在 `docs/openapi/`；`openapi-site` 預覽 URL 仍是 `/docs/`）：

```bash
make -C backend openapi-export               # → docs/openapi/openapi.json
make -C backend openapi-site                 # 建站並在 :8080 起 server → /docs/
make -C backend openapi-site PORT=9000       # 改 port
make -C backend openapi-site OUT=/tmp/site   # 改輸出路徑（此時 URL 為 /）
```

## 開發前檢查

在 repo 根目錄執行 `make -C backend fix` 自動修正 backend Python；送出 PR 前執行 `make -C backend check`，確認 Ruff、格式、`db-migration-check`，以及快速後端測試都通過。CI 會分開跑 Ruff 與 `db-migration-check`；pre-commit 在變更 `backend/alembic/` 時也會跑 `db-migration-check`。

## 資料庫遷移
**要修改資料庫前，請先告知其他人改動的欄位並進行討論。**

連線字串自動讀取 `config.py` 的 `DATABASE_URL`。  
新增的 model 需在 `app/models/__init__.py` import，autogenerate 才偵測得到。  

`APP_ENV=development` 時，啟動 FastAPI 會自動 upgrade head。  

請用 Make 目標（內部走 `scripts/run_alembic.py`），**不要**直接跑 `alembic` / `uv run alembic`：Alembic 1.20 用系統 locale 讀 `alembic.ini`，在 Windows CP950 下會因 UTF-8 繁中註解失敗。

```bash
make -C backend db-revision message="描述變更"   # autogenerate，產生後請人工檢查
make -C backend db-upgrade                        # upgrade head
make -C backend db-downgrade                      # 退回一版
make -C backend db-current                        # 目前 DB revision
make -C backend db-heads                          # 目前 migration head（應只有一個）
make -C backend db-migration-check                # 檢查是否對齊 origin/main
```

## Python 環境
請不要直接使用 python 或 python3 指令，用 `uv run <.py file>`。這樣才會使用 uv 的建立環境
要新增修改任何套件，也請使用 uv 操作，不要直接使用 pip
