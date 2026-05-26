# 技術架構文檔

## 目錄

1. [系統概述](#系統概述)
2. [技術棧](#技術棧)
3. [項目結構](#項目結構)
4. [核心架構](#核心架構)
5. [數據流](#數據流)
6. [認證機制](#認證機制)
7. [部署架構](#部署架構)

---

## 系統概述

ailaeclass 是一個現代化的學習管理系統（LMS），採用前後端分離的微服務架構。系統支援多租戶模式，每個組織擁有獨立的子域名和完整的數據隔離。

### 核心功能模組

```
┌─────────────────────────────────────────────────────────────┐
│                    ailaeclass LMS                          │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│  課程管理    │  學習管理    │  組織管理    │  社群互動         │
│  • 課程建立  │  • 學習追蹤  │  • 成員管理  │  • 社群討論       │
│  • 課時編排  │  • 練習提交  │  • 權限控制  │  • 問題發佈       │
│  • 練習題庫  │  • 成績評分  │  • 品牌設定  │  • 問答互動       │
│  • 證書頒發  │  • 進度統計  │  • 域名管理  │  • 新聞動態       │
│  • 落地頁    │  • 出勤記錄  │  • 計費管理  │                   │
└─────────────┴─────────────┴─────────────┴───────────────────┘
```

---

## 技術棧

### 前端（Dashboard）

| 技術 | 版本 | 用途 |
|------|------|------|
| **SvelteKit** | ^1.x | 全端框架（SSR + CSR） |
| **Svelte** | ^4.x | UI 組件框架 |
| **Tailwind CSS** | ^3.x | CSS 工具類框架 |
| **TypeScript** | ^5.x | 類型安全 |
| **Vite** | ^4.x | 構建工具 |
| **Supabase JS** | ^2.x | Supabase 客戶端 |
| **Chart.js / D3** | - | 數據圖表 |
| **TinyMCE** | - | 富文本編輯器 |
| **i18n** | - | 國際化（支援多語言） |

### 後端（API）

| 技術 | 版本 | 用途 |
|------|------|------|
| **Hono** | ^4.x | 輕量級 HTTP 服務框架 |
| **Node.js** | ^20.x | 運行環境 |
| **TypeScript** | ^5.x | 類型安全 |
| **Supabase JS** | ^2.x | 資料庫操作 |

### 資料庫與基礎設施

| 技術 | 用途 |
|------|------|
| **Supabase** | BaaS 平台（PostgreSQL + Auth + Storage + Realtime） |
| **PostgreSQL** | 15.x 主資料庫 |
| **Supabase Auth** | 用戶認證與授權 |
| **Supabase Storage** | 檔案儲存（圖片、影片、文件） |
| **Supabase Realtime** | 即時數據訂閱 |

### 第三方服務

| 服務 | 用途 |
|------|------|
| **OpenAI** | AI 助教、自動評分 |
| **Cloudflare R2** | 影片 CDN 儲存 |
| **Unsplash** | 圖片搜索 |
| **Sentry** | 錯誤監控 |
| **PostHog** | 用戶行為分析 |

---

## 項目結構

ailaeclass 採用 **pnpm monorepo** 結構，使用 **Turborepo** 進行構建編排。

```
ailaeclass-main/
├── apps/                          # 應用程式目錄
│   ├── dashboard/                 # 主應用（SvelteKit）
│   │   ├── src/
│   │   │   ├── lib/               # 共用庫
│   │   │   │   ├── components/    # UI 組件
│   │   │   │   ├── stores/        # Svelte stores
│   │   │   │   ├── utils/         # 工具函數
│   │   │   │   ├── services/      # API 服務層
│   │   │   │   └── i18n/          # 國際化
│   │   │   ├── routes/            # SvelteKit 路由
│   │   │   │   ├── (root)/        # 首頁
│   │   │   │   ├── courses/       # 課程管理
│   │   │   │   ├── lms/           # 學習管理系統
│   │   │   │   ├── org/           # 組織管理
│   │   │   │   ├── api/           # API 路由
│   │   │   │   └── ...
│   │   │   └── app.html           # HTML 模板
│   │   ├── static/                # 靜態資源
│   │   ├── tests/                 # 單元測試
│   │   └── e2e/                   # E2E 測試
│   │
│   ├── api/                       # API 服務（Express）
│   │   └── src/
│   │       ├── routes/            # 路由定義
│   │       ├── services/          # 業務邏輯
│   │       ├── middlewares/       # 中間件
│   │       └── config/            # 配置
│   │
│   ├── ailaeclass-com/           # 官網
│   ├── course-app/                # 課程獨立應用
│   └── docs/                      # 文檔站
│
├── packages/                      # 共用套件
│   ├── shared/                    # 共用工具函數
│   ├── course-app/                # 課程應用共用
│   └── tsconfig/                  # TypeScript 配置
│
├── supabase/                      # Supabase 配置
│   ├── migrations/                # 資料庫遷移（37 個）
│   ├── functions/                 # Edge Functions
│   ├── config.toml                # 本地開發配置
│   ├── data.sql                   # 初始資料
│   └── seed.sql                   # 測試資料
│
├── docker/                        # Docker 配置
├── turbo.json                     # Turborepo 配置
├── pnpm-workspace.yaml            # pnpm 工作區配置
└── package.json                   # 根 package.json
```

---

## 核心架構

### 多租戶架構

ailaeclass 支援多租戶模式，每個組織（Organization）是一個獨立的租戶：

```
┌─────────────────────────────────────────────────────┐
│                    Supabase                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Org A      │  │  Org B      │  │  Org C      │  │
│  │  (子域名a)   │  │  (子域名b)   │  │  (子域名c)   │  │
│  │             │  │             │  │             │  │
│  │  • 課程     │  │  • 課程     │  │  • 課程     │  │
│  │  • 用戶     │  │  • 用戶     │  │  • 用戶     │  │
│  │  • 設定     │  │  • 設定     │  │  • 設定     │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
```

**路由機制：**
- 多租戶模式：`{org-slug}.ailaeclass.com`
- 單組織模式：`app.ailaeclass.com`（通過 `PUBLIC_SINGLE_ORG_SITE_NAME` 啟用）

### 數據隔離

通過 Supabase RLS（Row Level Security）實現數據隔離：

```sql
-- 範例：課程只能被所屬組織的成員存取
CREATE POLICY "課程組織隔離" ON public.course
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM public.groupmember
      WHERE profile_id = auth.uid()
    )
  );
```

### 權限模型

```
Organization
    ├── Role (ADMIN, TEACHER, STUDENT)
    │
    └── Group (Course Group)
        └── GroupMember
            ├── profile_id (用戶)
            └── role_id (角色)
```

**角色權限：**

| 角色 | 課程管理 | 內容編輯 | 作業批改 | 學習存取 |
|------|----------|----------|----------|----------|
| ADMIN | ✓ | ✓ | ✓ | ✓ |
| TEACHER | ✓ | ✓ | ✓ | ✓ |
| STUDENT | ✗ | ✗ | ✗ | ✓ |

---

## 數據流

### 課程學習流程

```
學生登入
    │
    ▼
學習儀表板 (/lms)
    │
    ├──▶ 課程探索 (/lms/explore)
    │       │
    │       ▼
    │    選擇課程 → 報名
    │
    └──▶ 我的學習 (/lms/mylearning)
            │
            ▼
         課程詳情
            │
            ├──▶ 課時學習
            │       │
            │       ├──▶ 觀看影片
            │       ├──▶ 閱讀內容
            │       └──▶ 完成練習
            │
            └──▶ 作業提交
                    │
                    ▼
                 等待批改
                    │
                    ▼
                 查看成績
```

### 教師管理流程

```
教師登入
    │
    ▼
課程列表 (/courses)
    │
    ▼
課程管理
    │
    ├──▶ 課時管理 (/courses/[id]/lessons)
    │       │
    │       ├──▶ 新增課時
    │       ├──▶ 編輯內容
    │       └──▶ 新增練習
    │
    ├──▶ 學員管理 (/courses/[id]/people)
    │
    ├──▶ 作業批改 (/courses/[id]/submissions)
    │       │
    │       ├──▶ 查看提交
    │       ├──▶ AI 自動評分
    │       └──▶ 手動評分
    │
    ├──▶ 出勤管理 (/courses/[id]/attendance)
    │
    └──▶ 證書管理 (/courses/[id]/certificates)
```

### API 請求流程

```
瀏覽器
    │
    ▼
SvelteKit (SSR/CSR)
    │
    ├──▶ 直接呼叫 Supabase
    │       │
    │       ▼
    │    Supabase Auth (認證)
    │       │
    │       ▼
    │    RLS 策略檢查
    │       │
    │       ▼
    │    PostgreSQL (資料)
    │
    └──▶ 呼叫 API 服務
            │
            ▼
         Express API
            │
            ├──▶ 影片上傳 → Cloudflare R2
            ├──▶ 郵件發送 → SMTP
            └──▶ AI 功能 → OpenAI
```

---

## 認證機制

### Supabase Auth

ailaeclass 使用 Supabase Auth 進行用戶認證，支援：

- **Email/Password**: 傳統郵箱密碼登入
- **Magic Link**: 無密碼登入（郵件連結）
- **OAuth**: Google、GitHub 等第三方登入
- **Email Verification**: 註冊郵箱驗證

### 認證流程

```
1. 用戶註冊/登入
       │
       ▼
2. Supabase Auth 驗證
       │
       ▼
3. 簽發 JWT Token
       │
       ▼
4. 前端儲存 Token (Cookie/LocalStorage)
       │
       ▼
5. 後續請求攜帶 Token
       │
       ▼
6. Supabase 自動驗證 Token
       │
       ▼
7. RLS 策略檢查用戶權限
```

### JWT Token 結構

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "aud": "authenticated",
  "exp": 1234567890,
  "iat": 1234567890
}
```

### RLS 策略示例

```sql
-- 用戶只能查看自己所屬組織的課程
CREATE POLICY "用戶查看組織課程" ON public.course
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.groupmember gm
      JOIN public."group" g ON g.id = gm.group_id
      WHERE gm.profile_id = auth.uid()
      AND g.id = course.group_id
    )
  );

-- 用戶只能修改自己的資料
CREATE POLICY "用戶修改個人資料" ON public.profile
  FOR UPDATE USING (id = auth.uid());
```

---

## 部署架構

### 推薦部署架構

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │   (CDN + DNS)   │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │   Vercel      │ │   Railway     │ │   Supabase    │
    │   Dashboard   │ │   API Service │ │   Cloud       │
    │   (SvelteKit) │ │   (Express)   │ │   (PostgreSQL │
    │               │ │               │ │    + Auth +   │
    │               │ │               │ │    Storage)   │
    └───────────────┘ └───────────────┘ └───────────────┘
```

### 自建部署架構

```
                    ┌─────────────────┐
                    │   Nginx         │
                    │   (反向代理)     │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │   Dashboard   │ │   API Service │ │   Supabase    │
    │   (Node.js)   │ │   (Node.js)   │ │   (Docker)    │
    │   Port: 3000  │ │   Port: 3001  │ │   Port: 54321 │
    └───────────────┘ └───────────────┘ └───────────────┘
```

### 擴展策略

| 組件 | 擴展方式 | 說明 |
|------|----------|------|
| Dashboard | 水平擴展 | PM2 Cluster 模式或容器編排 |
| API | 水平擴展 | 無狀態服務，可多實例部署 |
| PostgreSQL | 垂直擴展 + 讀寫分離 | Supabase 自動處理 |
| Storage | 水平擴展 | Supabase Storage 或 Cloudflare R2 |

---

## 附錄

### 核心資料庫表格

| 表格 | 說明 |
|------|------|
| `profile` | 用戶資料 |
| `organization` | 組織 |
| `organizationmember` | 組織成員 |
| `course` | 課程 |
| `lesson` | 課時 |
| `exercise` | 練習 |
| `question` | 題目 |
| `submission` | 提交 |
| `group` | 群組 |
| `groupmember` | 群組成員 |
| `community_question` | 社群問題 |
| `community_answer` | 社群回答 |

### 主要 API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/course` | GET/POST | 課程管理 |
| `/api/course/:id/lesson` | GET/POST | 課時管理 |
| `/api/course/:id/exercise` | GET/POST | 練習管理 |
| `/api/submission` | GET/POST | 提交管理 |
| `/api/mail` | POST | 郵件發送 |

### 路由結構

| 路由 | 說明 |
|------|------|
| `/courses` | 課程列表（教師） |
| `/courses/[id]` | 課程詳情 |
| `/lms` | 學習儀表板（學生） |
| `/lms/explore` | 課程探索 |
| `/lms/mylearning` | 我的學習 |
| `/lms/exercises` | 練習列表 |
| `/org/[slug]` | 組織管理 |
| `/org/[slug]/community` | 社群管理 |
| `/login` | 登入 |
| `/signup` | 註冊 |
