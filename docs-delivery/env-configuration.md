# 環境配置說明

## 目錄

1. [概述](#概述)
2. [系統要求](#系統要求)
3. [Dashboard 環境變數](#dashboard-環境變數)
4. [API 服務環境變數](#api-服務環境變數)
5. [Supabase 配置](#supabase-配置)
6. [第三方服務配置](#第三方服務配置)
7. [開發環境搭建](#開發環境搭建)

---

## 概述

ClassroomIO 採用 **pnpm monorepo** 結構，主要包含兩個需要配置環境變數的應用：

| 應用 | 路徑 | 說明 |
|------|------|------|
| **Dashboard** | `apps/dashboard/` | 前端主應用（SvelteKit） |
| **API** | `apps/api/` | 後端 API 服務（Express） |

每個應用都有對應的 `.env.example` 檔案，複製後填入實際值即可：

```bash
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/api/.env.example apps/api/.env
```

---

## 系統要求

| 項目 | 版本要求 |
|------|----------|
| Node.js | ^20.19.3 |
| pnpm | >= 8.0.0 |
| Supabase CLI | >= 1.0.0 |
| PostgreSQL | 15.x（Supabase 提供） |
| Docker | >= 20.10（本地 Supabase 開發用） |

---

## Dashboard 環境變數

### 必要變數

| 變數名稱 | 說明 | 範例值 |
|----------|------|--------|
| `PUBLIC_SUPABASE_URL` | Supabase 項目 URL | `http://localhost:54321`（本地）或 `https://xxx.supabase.co`（雲端） |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名金鑰（公開） | `eyJhbGciOiJIUzI1NiIs...` |
| `PRIVATE_SUPABASE_SERVICE_ROLE` | Supabase 服務角色金鑰（私密） | `eyJhbGciOiJIUzI1NiIs...` |

### 應用配置

| 變數名稱 | 說明 | 預設值 |
|----------|------|--------|
| `PUBLIC_IS_SELFHOSTED` | 是否為自託管模式 | `false` |
| `PRIVATE_APP_HOST` | 應用主域名 | `classroomio.com` |
| `PRIVATE_APP_SUBDOMAINS` | 子域名前綴 | `app` |
| `PUBLIC_SINGLE_ORG_SITE_NAME` | 單組織模式的站點名稱（空值 = 多租戶模式） | 空 |

### 可選功能變數

| 變數名稱 | 說明 | 用途 |
|----------|------|------|
| `UNSPLASH_API_KEY` | Unsplash API 金鑰 | 課程封面圖片搜索 |
| `OPENAI_API_KEY` | OpenAI API 金鑰 | AI 功能（自動評分、AI 助教） |
| `PUBLIC_SERVER_URL` | API 服務 URL | 影片上傳、PDF 下載 |
| `PUBLIC_IP_REGISTRY_KEY` | IP Registry 金鑰 | 註冊用戶地理位置資訊 |

### 雲端版本專用（可選）

| 變數名稱 | 說明 |
|----------|------|
| `LEMON_SQUEEZY_API_KEY` | Lemon Squeezy 支付 API 金鑰 |
| `LEMON_SQUEEZY_STORE_ID` | Lemon Squeezy 商店 ID |
| `LEMON_SQUEEZY_WEBHOOK_SECRET` | Lemon Squeezy Webhook 密鑰 |
| `VITE_SENTRY_AUTH_TOKEN` | Sentry 錯誤監控認證 Token |
| `VITE_SENTRY_ORG_NAME` | Sentry 組織名稱 |
| `VITE_SENTRY_PROJECT_NAME` | Sentry 項目名稱 |

### 自訂網域（可選）

| 變數名稱 | 說明 |
|----------|------|
| `TEAM_ID_VERCEL` | Vercel 團隊 ID |
| `PROJECT_ID_VERCEL` | Vercel 項目 ID |
| `AUTH_BEARER_TOKEN` | Vercel API 認證 Token |
| `USE_HTTPS_ON_LOCALHOST` | 本地開發是否啟用 HTTPS |

---

## API 服務環境變數

### 必要變數

| 變數名稱 | 說明 |
|----------|------|
| `PUBLIC_SUPABASE_URL` | Supabase 項目 URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名金鑰 |
| `PRIVATE_SUPABASE_SERVICE_ROLE` | Supabase 服務角色金鑰 |

### 可選功能變數

| 變數名稱 | 說明 | 用途 |
|----------|------|------|
| `CLOUDFLARE_BUCKET_DOMAIN` | Cloudflare R2 儲存桶域名 | 影片上傳 CDN |
| `CLOUDFLARE_ACCESS_KEY` | Cloudflare R2 存取金鑰 | 影片上傳 |
| `CLOUDFLARE_SECRET_ACCESS_KEY` | Cloudflare R2 密鑰 | 影片上傳 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 帳戶 ID | 影片上傳 |
| `SMTP_HOST` | SMTP 郵件伺服器地址 | 郵件發送 |
| `SMTP_USER` | SMTP 用戶名 | 郵件發送 |
| `SMTP_PASSWORD` | SMTP 密碼 | 郵件發送 |
| `SMTP_PORT` | SMTP 埠號 | 郵件發送 |
| `SENTRY_DNS` | Sentry DSN | 錯誤監控 |
| `OPENAPI_URL` | OpenAI API URL | AI 功能 |

---

## Supabase 配置

### 本地開發

本地開發使用 Supabase CLI 啟動本地實例：

```bash
# 安裝 Supabase CLI
pnpm add -g supabase

# 啟動本地 Supabase（需要 Docker）
cd classroomio-main
supabase start

# 執行資料庫遷移
supabase db reset

# 查看本地服務狀態
supabase status
```

本地服務預設埠號：

| 服務 | 埠號 |
|------|------|
| API Gateway | 54321 |
| Database | 54322 |
| Studio | 54323 |
| Inbucket (Email) | 54324 |
| Realtime | 54325 |
| Storage | 54326 |
| Auth | 54321 |

### 雲端部署

1. 在 [Supabase](https://supabase.com) 建立新項目
2. 取得項目 URL 和 API Keys（Settings → API）
3. 執行資料庫遷移：

```bash
# 連結到雲端項目
supabase link --project-ref <your-project-ref>

# 推送遷移
supabase db push --include-all
```

4. 設定環境變數：

```
PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
PRIVATE_SUPABASE_SERVICE_ROLE=<your-service-role-key>
```

### Supabase 配置檔

`supabase/config.toml` 包含本地開發配置：

```toml
project_id = "classroomio"

[api]
port = 54321
schemas = ["public", "storage", "graphql_public"]
max_rows = 1000

[db]
port = 54322
major_version = 15

[realtime]
enabled = true
```

---

## 第三方服務配置

### OpenAI（AI 功能）

用於自動評分、AI 助教等功能。

1. 前往 [OpenAI Platform](https://platform.openai.com) 建立 API Key
2. 設定環境變數：
   - Dashboard: `OPENAI_API_KEY=sk-...`
   - API: `OPENAPI_URL=https://api.openai.com/v1`

### Unsplash（圖片搜索）

用於課程封面圖片搜索功能。

1. 前往 [Unsplash Developers](https://unsplash.com/developers) 建立應用
2. 取得 Access Key
3. 設定：`UNSPLASH_API_KEY=<your-access-key>`

### Cloudflare R2（影片儲存）

用於影片上傳和 CDN 分發。

1. 在 Cloudflare 建立 R2 儲存桶
2. 建立 API Token（需 R2 讀寫權限）
3. 設定環境變數：
   ```
   CLOUDFLARE_BUCKET_DOMAIN=https://cdn.your-domain.com
   CLOUDFLARE_ACCESS_KEY=<access-key>
   CLOUDFLARE_SECRET_ACCESS_KEY=<secret-key>
   CLOUDFLARE_ACCOUNT_ID=<account-id>
   ```

### SMTP（郵件發送）

用於驗證郵件、通知等功能。

設定環境變數：
```
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_PORT=587
```

### Sentry（錯誤監控）

用於應用錯誤監控和報告。

1. 在 [Sentry](https://sentry.io) 建立項目
2. 取得 DSN 和 Auth Token
3. 設定環境變數

---

## 開發環境搭建

### 1. 克隆專案

```bash
git clone <repository-url>
cd classroomio-main
```

### 2. 安裝依賴

```bash
pnpm install
```

### 3. 配置環境變數

```bash
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/api/.env.example apps/api/.env
# 編輯 .env 檔案填入實際值
```

### 4. 啟動本地 Supabase

```bash
supabase start
supabase db reset
```

### 5. 啟動開發伺服器

```bash
# 啟動所有服務
pnpm dev

# 或單獨啟動
pnpm dev --filter @cio/dashboard
pnpm dev --filter @cio/api
```

### 6. 存取服務

| 服務 | URL |
|------|-----|
| Dashboard | http://localhost:5173 |
| API | http://localhost:3001 |
| Supabase Studio | http://localhost:54323 |
| Supabase API | http://localhost:54321 |
