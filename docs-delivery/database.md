# 資料庫文檔

## 目錄

1. [概述](#概述)
2. [資料庫結構](#資料庫結構)
3. [核心表格](#核心表格)
4. [關聯關係](#關聯關係)
5. [RLS 策略](#rls-策略)
6. [遷移管理](#遷移管理)
7. [常用查詢](#常用查詢)

---

## 概述

ailaeclass 使用 **PostgreSQL 15.x** 作為主資料庫，通過 **Supabase** 平台託管。資料庫包含 37 個表格、2 個視圖、4 個自定義枚舉類型和 15+ 個存儲函數，支援多租戶數據隔離。

### 技術特性

| 特性 | 說明 |
|------|------|
| PostgreSQL 版本 | 15.x |
| 表格數量 | 37 |
| 視圖數量 | 2（lesson_versions, dash_org_stats） |
| 枚舉類型 | 4（LOCALE, PLAN, COURSE_TYPE, COURSE_VERSION） |
| 存儲函數 | 15+ |
| 擴展套件 | uuid-ossp, pgcrypto, pgjwt, moddatetime, vector |
| 安全機制 | Row Level Security (RLS) + 5 個 RLS 輔助函數 |
| 即時訂閱 | Supabase Realtime |
| 自動 API | PostgREST |

### RLS 輔助函數

| 函數 | 說明 |
|------|------|
| `is_org_admin(org_id)` | 檢查用戶是否為組織管理員 |
| `is_org_member()` | 檢查用戶是否為組織成員 |
| `is_user_in_course_group(group_id)` | 檢查用戶是否在課程群組中 |
| `is_user_in_group_with_role(group_id)` | 檢查用戶在群組中是否有角色 |
| `is_user_in_course_group_or_admin_group()` | 組合檢查（成員或管理員） |

### 資料庫統計

| 項目 | 數量 |
|------|------|
| 核心表格 | 30+ |
| 遷移檔案 | 37 |
| 儲存函數 | 10+ |
| RLS 策略 | 50+ |

---

## 資料庫結構

### ER 圖（簡化版）

```
┌─────────────────────────────────────────────────────────────────┐
│                        Organization                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Organization                          │    │
│  │  • id (PK)                                              │    │
│  │  • name                                                 │    │
│  │  • site_name (UNIQUE)                                   │    │
│  │  • theme                                                │    │
│  └─────────────────┬───────────────────────────────────────┘    │
│                    │                                            │
│       ┌────────────┼────────────┐                               │
│       │            │            │                               │
│       ▼            ▼            ▼                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                         │
│  │  Group  │  │  Org    │  │  Org    │                         │
│  │         │  │  Member │  │  Plan   │                         │
│  │  • id   │  │         │  │         │                         │
│  │  • name │  │  • id   │  │  • id   │                         │
│  └────┬────┘  │  • role │  │  • plan │                         │
│       │       └────┬────┘  └─────────┘                         │
│       │            │                                            │
│       │       ┌────┴────┐                                       │
│       │       │         │                                       │
│       ▼       ▼         ▼                                       │
│  ┌─────────┐  ┌─────────────┐                                   │
│  │ Course  │  │  Profile    │                                   │
│  │         │  │             │                                   │
│  │  • id   │  │  • id (PK)  │                                   │
│  │  • title│  │  • fullname │                                   │
│  │  • slug │  │  • email    │                                   │
│  └────┬────┘  └─────────────┘                                   │
│       │                                                         │
│       ├───────────────────┐                                     │
│       │                   │                                     │
│       ▼                   ▼                                     │
│  ┌─────────┐        ┌──────────┐                                │
│  │ Lesson  │        │ Exercise │                                │
│  │         │        │          │                                │
│  │  • id   │        │  • id    │                                │
│  │  • title│        │  • title │                                │
│  └────┬────┘        └────┬─────┘                                │
│       │                  │                                      │
│       │                  ▼                                      │
│       │            ┌──────────┐                                 │
│       │            │ Question │                                 │
│       │            └──────────┘                                 │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────┐                                               │
│  │  Submission  │                                               │
│  │  • exercise_id│                                              │
│  │  • submitted_by│                                             │
│  │  • total      │                                              │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 核心表格

### 1. Profile（用戶資料）

儲存用戶的基本資訊，與 Supabase Auth 的 `auth.users` 表關聯。

```sql
CREATE TABLE public.profile (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  fullname text,
  username text UNIQUE,
  email text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**欄位說明：**

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | uuid | 主鍵，關聯 auth.users |
| `fullname` | text | 用戶全名 |
| `username` | text | 用戶名（唯一） |
| `email` | text | 電子郵箱 |
| `avatar_url` | text | 頭像 URL |
| `created_at` | timestamp | 建立時間 |
| `updated_at` | timestamp | 更新時間 |

---

### 2. Organization（組織）

儲存組織資訊，支援多租戶。

```sql
CREATE TABLE public.organization (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  site_name text UNIQUE NOT NULL,
  description text,
  logo text DEFAULT '',
  landing_page jsonb DEFAULT '{}'::jsonb,
  theme text DEFAULT 'default',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**欄位說明：**

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | uuid | 主鍵 |
| `name` | text | 組織名稱 |
| `site_name` | text | 站點名稱（用於子域名，唯一） |
| `description` | text | 組織描述 |
| `logo` | text | Logo URL |
| `landing_page` | jsonb | 落地頁配置 |
| `theme` | text | 主題色 |

---

### 3. Organization Member（組織成員）

記錄組織成員及其角色。

```sql
CREATE TABLE public.organizationmember (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id uuid REFERENCES public.organization(id),
  profile_id uuid REFERENCES public.profile(id),
  role_id bigint REFERENCES public.role(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**欄位說明：**

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | uuid | 主鍵 |
| `organization_id` | uuid | 所屬組織 ID |
| `profile_id` | uuid | 用戶 ID |
| `role_id` | bigint | 角色 ID（ADMIN/TEACHER/STUDENT） |

---

### 4. Role（角色）

定義系統角色。

```sql
CREATE TABLE public.role (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL
);
```

**預設角色：**

| ID | 名稱 | 說明 |
|----|------|------|
| 1 | ADMIN | 組織管理員 |
| 2 | TEACHER | 教師 |
| 3 | STUDENT | 學生 |

---

### 5. Group（群組）

課程所屬的群組，用於權限管理。

```sql
CREATE TABLE public."group" (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text,
  organization_id uuid REFERENCES public.organization(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

---

### 6. Group Member（群組成員）

記錄群組成員，用於課程權限控制。

```sql
CREATE TABLE public.groupmember (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id uuid REFERENCES public."group"(id),
  profile_id uuid REFERENCES public.profile(id),
  role_id bigint REFERENCES public.role(id),
  assigned_student_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

---

### 7. Course（課程）

儲存課程資訊。

```sql
CREATE TABLE public.course (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title character varying NOT NULL,
  description character varying NOT NULL,
  overview character varying DEFAULT 'Welcome to this amazing course 🚀',
  logo text DEFAULT '' NOT NULL,
  banner_image text,
  slug character varying,
  group_id uuid REFERENCES public."group"(id),
  is_template boolean DEFAULT true,
  is_published boolean DEFAULT false,
  is_certificate_downloadable boolean DEFAULT false,
  certificate_theme text,
  cost bigint DEFAULT 0,
  currency character varying DEFAULT 'NGN' NOT NULL,
  metadata jsonb DEFAULT '{"goals": "", "description": "", "requirements": ""}' NOT NULL,
  status text DEFAULT 'ACTIVE' NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**欄位說明：**

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | uuid | 主鍵 |
| `title` | varchar | 課程標題 |
| `description` | varchar | 課程描述 |
| `overview` | varchar | 課程概述 |
| `logo` | text | Logo URL |
| `banner_image` | text | 橫幅圖片 URL |
| `slug` | varchar | URL 友善標識 |
| `group_id` | uuid | 所屬群組 ID |
| `is_published` | boolean | 是否已發佈 |
| `cost` | bigint | 課程費用 |
| `currency` | varchar | 貨幣 |
| `metadata` | jsonb | 元資料（目標、需求等） |
| `status` | text | 狀態（ACTIVE/ARCHIVED） |

---

### 8. Lesson（課時）

儲存課程的課時內容。

```sql
CREATE TABLE public.lesson (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title character varying NOT NULL,
  course_id uuid REFERENCES public.course(id),
  "order" integer DEFAULT 0,
  is_unlocked boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

---

### 9. Exercise（練習）

儲存課時的練習題組。

```sql
CREATE TABLE public.exercise (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title character varying NOT NULL,
  lesson_id uuid REFERENCES public.lesson(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

---

### 10. Question（題目）

儲存練習的題目。

```sql
CREATE TABLE public.question (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  exercise_id uuid REFERENCES public.exercise(id),
  title character varying NOT NULL,
  description text,
  type character varying,
  points integer DEFAULT 0,
  "order" integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

---

### 11. Submission（提交）

儲存學生的練習提交記錄。

```sql
CREATE TABLE public.submission (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  exercise_id uuid REFERENCES public.exercise(id),
  submitted_by uuid REFERENCES public.groupmember(id),
  status_id bigint REFERENCES public.submissionstatus(id),
  total integer DEFAULT 0,
  feedback text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

---

### 12. Submission Status（提交狀態）

定義提交的狀態。

```sql
CREATE TABLE public.submissionstatus (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL
);
```

**預設狀態：**

| ID | 名稱 | 說明 |
|----|------|------|
| 1 | NOT_SUBMITTED | 未提交 |
| 2 | SUBMITTED | 已提交 |
| 3 | IN_PROGRESS | 評分中 |
| 4 | GRADED | 已評分 |

---

### 13. Community Question（社群問題）

儲存社群討論區的問題。

```sql
CREATE TABLE public.community_question (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title character varying NOT NULL,
  body text,
  course_id uuid REFERENCES public.course(id),
  org_id uuid REFERENCES public.organization(id),
  author_id uuid REFERENCES public.profile(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

---

### 14. Community Answer（社群回答）

儲存社群問題的回答。

```sql
CREATE TABLE public.community_answer (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  body text NOT NULL,
  question_id uuid REFERENCES public.community_question(id),
  author_id uuid REFERENCES public.profile(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

---

## 關聯關係

### 核心關聯

```
auth.users (Supabase Auth)
    │
    └── 1:1 ──▶ profile
                    │
                    └── 1:N ──▶ organizationmember
                                    │
                                    └── N:1 ──▶ organization
                                                    │
                                                    └── 1:N ──▶ "group"
                                                                    │
                                                                    └── 1:N ──▶ groupmember
                                                                    │
                                                                    └── 1:N ──▶ course
                                                                                    │
                                                                                    ├── 1:N ──▶ lesson
                                                                                    │               │
                                                                                    │               ├── 1:N ──▶ exercise
                                                                                    │               │               │
                                                                                    │               │               └── 1:N ──▶ question
                                                                                    │               │
                                                                                    │               └── 1:N ──▶ lesson_comment
                                                                                    │
                                                                                    └── 1:N ──▶ community_question
                                                                                                    │
                                                                                                    └── 1:N ──▶ community_answer
```

### 外鍵約束

| 表格 | 欄位 | 參照 |
|------|------|------|
| `profile` | `id` | `auth.users(id)` |
| `organizationmember` | `organization_id` | `organization(id)` |
| `organizationmember` | `profile_id` | `profile(id)` |
| `organizationmember` | `role_id` | `role(id)` |
| `group` | `organization_id` | `organization(id)` |
| `groupmember` | `group_id` | `group(id)` |
| `groupmember` | `profile_id` | `profile(id)` |
| `groupmember` | `role_id` | `role(id)` |
| `course` | `group_id` | `group(id)` |
| `lesson` | `course_id` | `course(id)` |
| `exercise` | `lesson_id` | `lesson(id)` |
| `question` | `exercise_id` | `exercise(id)` |
| `submission` | `exercise_id` | `exercise(id)` |
| `submission` | `submitted_by` | `groupmember(id)` |
| `submission` | `status_id` | `submissionstatus(id)` |
| `community_question` | `course_id` | `course(id)` |
| `community_question` | `org_id` | `organization(id)` |
| `community_question` | `author_id` | `profile(id)` |
| `community_answer` | `question_id` | `community_question(id)` |
| `community_answer` | `author_id` | `profile(id)` |

---

## RLS 策略

### 概述

ailaeclass 使用 Supabase 的 Row Level Security (RLS) 實現數據隔離。所有公開表格都啟用了 RLS。

### 核心策略示例

#### Profile 策略

```sql
-- 用戶可以查看所有公開資料
CREATE POLICY "公開查看用戶資料" ON public.profile
  FOR SELECT USING (true);

-- 用戶只能修改自己的資料
CREATE POLICY "用戶修改個人資料" ON public.profile
  FOR UPDATE USING (id = auth.uid());

-- 用戶只能刪除自己的帳號
CREATE POLICY "用戶刪除帳號" ON public.profile
  FOR DELETE USING (id = auth.uid());
```

#### Course 策略

```sql
-- 用戶只能查看自己所屬組織的課程
CREATE POLICY "查看組織課程" ON public.course
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM public.groupmember
      WHERE profile_id = auth.uid()
    )
  );

-- 組織管理員可以建立課程
CREATE POLICY "管理員建立課程" ON public.course
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizationmember om
      JOIN public.role r ON r.id = om.role_id
      WHERE om.profile_id = auth.uid()
      AND r.name = 'ADMIN'
    )
  );
```

#### Submission 策略

```sql
-- 學生可以查看自己的提交
CREATE POLICY "學生查看自己的提交" ON public.submission
  FOR SELECT USING (
    submitted_by IN (
      SELECT id FROM public.groupmember
      WHERE profile_id = auth.uid()
    )
  );

-- 教師可以查看課程的所有提交
CREATE POLICY "教師查看課程提交" ON public.submission
  FOR SELECT USING (
    exercise_id IN (
      SELECT e.id FROM public.exercise e
      JOIN public.lesson l ON l.id = e.lesson_id
      JOIN public.course c ON c.id = l.course_id
      JOIN public.groupmember gm ON gm.group_id = c.group_id
      WHERE gm.profile_id = auth.uid()
      AND gm.role_id IN (1, 2)  -- ADMIN or TEACHER
    )
  );
```

### 策略檢查

```sql
-- 列出所有啟用 RLS 的表格
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
);

-- 查看特定表格的 RLS 策略
SELECT * FROM pg_policies WHERE tablename = 'course';
```

---

## 遷移管理

### 遷移檔案位置

```
supabase/migrations/
├── 20231115082347_remote_schema.sql     # 初始 schema
├── 20231118210545_profile.sql           # 用戶資料
├── 20231207061507_update_get_courses.sql
├── 20231213104402_course_metadata.sql
├── ...
├── 20251205045311_modify_profile_policy.sql
└── (共 37 個遷移檔案)
```

### 執行遷移

```bash
# 本地執行所有遷移
supabase db reset

# 執行特定遷移
supabase migration up

# 連結到雲端項目
supabase link --project-ref <project-ref>

# 推送遷移到雲端
supabase db push --include-all

# 建立新遷移
supabase migration new <migration_name>
```

### 遷移最佳實踐

1. **備份先行**: 執行遷移前先備份資料庫
2. **測試環境**: 先在本地或測試環境執行
3. **向前兼容**: 避免破壞性變更（如刪除欄位）
4. **版本控制**: 所有遷移檔案納入版本控制

---

## 常用查詢

### 取得用戶的所有課程

```sql
SELECT c.*, gm.role_id
FROM public.course c
JOIN public."group" g ON g.id = c.group_id
JOIN public.groupmember gm ON gm.group_id = g.id
WHERE gm.profile_id = '<user-id>'
AND c.status = 'ACTIVE'
ORDER BY c.created_at DESC;
```

### 取得課程的課時與進度

```sql
SELECT
  l.id,
  l.title,
  l."order",
  CASE WHEN lc.is_complete THEN true ELSE false END as is_completed
FROM public.lesson l
LEFT JOIN public.lesson_completion lc
  ON lc.lesson_id = l.id AND lc.profile_id = '<user-id>'
WHERE l.course_id = '<course-id>'
ORDER BY l."order";
```

### 取得練習的提交統計

```sql
SELECT
  e.id as exercise_id,
  e.title as exercise_title,
  COUNT(s.id) as total_submissions,
  COUNT(CASE WHEN ss.name = 'GRADED' THEN 1 END) as graded_count,
  AVG(CASE WHEN ss.name = 'GRADED' THEN s.total END) as avg_score
FROM public.exercise e
LEFT JOIN public.submission s ON s.exercise_id = e.id
LEFT JOIN public.submissionstatus ss ON ss.id = s.status_id
WHERE e.lesson_id = '<lesson-id>'
GROUP BY e.id, e.title;
```

### 取得組織的社群問題

```sql
SELECT
  cq.*,
  p.fullname as author_name,
  p.avatar_url as author_avatar,
  c.title as course_title,
  (SELECT COUNT(*) FROM public.community_answer ca WHERE ca.question_id = cq.id) as answer_count
FROM public.community_question cq
JOIN public.profile p ON p.id = cq.author_id
LEFT JOIN public.course c ON c.id = cq.course_id
WHERE cq.org_id = '<org-id>'
ORDER BY cq.created_at DESC;
```

### 取得學生的學習分析

```sql
SELECT
  p.fullname,
  p.email,
  COUNT(DISTINCT c.id) as enrolled_courses,
  COUNT(DISTINCT CASE WHEN lc.is_complete THEN l.id END) as completed_lessons,
  COUNT(DISTINCT s.id) as total_submissions,
  AVG(CASE WHEN ss.name = 'GRADED' THEN s.total END) as avg_score
FROM public.profile p
JOIN public.groupmember gm ON gm.profile_id = p.id
JOIN public."group" g ON g.id = gm.group_id
JOIN public.course c ON c.group_id = g.id
LEFT JOIN public.lesson l ON l.course_id = c.id
LEFT JOIN public.lesson_completion lc ON lc.lesson_id = l.id AND lc.profile_id = p.id
LEFT JOIN public.groupmember gm2 ON gm2.profile_id = p.id
LEFT JOIN public.submission s ON s.submitted_by = gm2.id
LEFT JOIN public.submissionstatus ss ON ss.id = s.status_id
WHERE p.id = '<user-id>'
GROUP BY p.id, p.fullname, p.email;
```

---

## 附錄

### 索引建議

為提升查詢效能，建議為以下欄位建立索引：

```sql
-- 課程查詢
CREATE INDEX idx_course_group_id ON public.course(group_id);
CREATE INDEX idx_course_status ON public.course(status);
CREATE INDEX idx_course_slug ON public.course(slug);

-- 課時查詢
CREATE INDEX idx_lesson_course_id ON public.lesson(course_id);

-- 練習查詢
CREATE INDEX idx_exercise_lesson_id ON public.exercise(lesson_id);

-- 題目查詢
CREATE INDEX idx_question_exercise_id ON public.question(exercise_id);

-- 提交查詢
CREATE INDEX idx_submission_exercise_id ON public.submission(exercise_id);
CREATE INDEX idx_submission_submitted_by ON public.submission(submitted_by);

-- 群組成員查詢
CREATE INDEX idx_groupmember_group_id ON public.groupmember(group_id);
CREATE INDEX idx_groupmember_profile_id ON public.groupmember(profile_id);

-- 社群查詢
CREATE INDEX idx_community_question_org_id ON public.community_question(org_id);
CREATE INDEX idx_community_answer_question_id ON public.community_answer(question_id);
```

### 備份與恢復

```bash
# 完整備份
supabase db dump --db-url postgresql://postgres:<password>@<host>:5432/postgres > backup.sql

# 只備份 Schema
supabase db dump --schema-only > schema.sql

# 只備份資料
supabase db dump --data-only > data.sql

# 恢復
psql postgresql://postgres:<password>@<host>:5432/postgres < backup.sql
```
