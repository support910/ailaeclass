# API 參考文檔

## 目錄

1. [概述](#概述)
2. [認證](#認證)
3. [API 端點](#api-端點)
4. [錯誤處理](#錯誤處理)
5. [資料模型](#資料模型)

---

## 概述

ailaeclass 的 API 分為兩部分：

1. **Supabase Auto-generated API**: 由 Supabase 根據資料庫結構自動生成的 RESTful API
2. **Custom API**: 由 Hono（輕量級 Web 框架）實現的自定義業務邏輯 API

### Base URL

| 環境 | URL |
|------|-----|
| 本地開發 | `http://localhost:54321` (Supabase) / `http://localhost:3001` (Custom) |
| 生產環境 | `https://<project-ref>.supabase.co` / `https://api.your-domain.com` |

### 請求格式

- Content-Type: `application/json`
- 所有請求需攜帶認證 Header（除公開端點外）

### 回應格式

**成功回應：**
```json
{
  "data": { ... },
  "error": null
}
```

**錯誤回應：**
```json
{
  "data": null,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE"
  }
}
```

---

## 認證

### JWT Token

所有需要認證的 API 端點都需要在 Header 中攜帶 JWT Token：

```
Authorization: Bearer <jwt-token>
```

### 取得 Token

**1. 用戶登入：**

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// data.session.access_token 即為 JWT Token
```

**2. 用戶註冊：**

```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password'
});
```

**3. Magic Link 登入：**

```javascript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com'
});
```

### Token 刷新

Supabase JS 客戶端會自動處理 Token 刷新，無需手動操作。

---

## API 端點

### Supabase Auto-generated API

Supabase 會根據資料庫表格自動生成 RESTful API。以下是主要端點：

#### Profile（用戶資料）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/rest/v1/profile?id=eq.<user-id>` | 取得用戶資料 |
| PATCH | `/rest/v1/profile?id=eq.<user-id>` | 更新用戶資料 |
| GET | `/rest/v1/profile?username=eq.<username>` | 通過用戶名查詢 |

**範例：取得用戶資料**
```bash
curl 'https://<project-ref>.supabase.co/rest/v1/profile?id=eq.<user-id>' \
  -H 'apikey: <anon-key>' \
  -H 'Authorization: Bearer <jwt-token>'
```

#### Organization（組織）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/rest/v1/organization` | 取得組織列表 |
| POST | `/rest/v1/organization` | 建立新組織 |
| GET | `/rest/v1/organization?site_name=eq.<name>` | 通過站點名查詢 |
| PATCH | `/rest/v1/organization?id=eq.<org-id>` | 更新組織資訊 |

#### Organization Member（組織成員）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/rest/v1/organizationmember?organization_id=eq.<org-id>` | 取得組織成員 |
| POST | `/rest/v1/organizationmember` | 新增成員 |
| DELETE | `/rest/v1/organizationmember?id=eq.<member-id>` | 移除成員 |

#### Course（課程）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/rest/v1/course` | 取得課程列表 |
| POST | `/rest/v1/course` | 建立新課程 |
| GET | `/rest/v1/course?id=eq.<course-id>` | 取得課程詳情 |
| PATCH | `/rest/v1/course?id=eq.<course-id>` | 更新課程 |
| DELETE | `/rest/v1/course?id=eq.<course-id>` | 刪除課程 |

**範例：建立課程**
```bash
curl -X POST 'https://<project-ref>.supabase.co/rest/v1/course' \
  -H 'apikey: <anon-key>' \
  -H 'Authorization: Bearer <jwt-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "新課程",
    "description": "課程描述",
    "group_id": "<group-id>"
  }'
```

#### Lesson（課時）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/rest/v1/lesson?course_id=eq.<course-id>` | 取得課程課時 |
| POST | `/rest/v1/lesson` | 建立新課時 |
| GET | `/rest/v1/lesson?id=eq.<lesson-id>` | 取得課時詳情 |
| PATCH | `/rest/v1/lesson?id=eq.<lesson-id>` | 更新課時 |
| DELETE | `/rest/v1/lesson?id=eq.<lesson-id>` | 刪除課時 |

#### Exercise（練習）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/rest/v1/exercise?lesson_id=eq.<lesson-id>` | 取得課時練習 |
| POST | `/rest/v1/exercise` | 建立新練習 |
| GET | `/rest/v1/exercise?id=eq.<exercise-id>` | 取得練習詳情 |
| PATCH | `/rest/v1/exercise?id=eq.<exercise-id>` | 更新練習 |

#### Question（題目）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/rest/v1/question?exercise_id=eq.<exercise-id>` | 取得練習題目 |
| POST | `/rest/v1/question` | 建立新題目 |
| PATCH | `/rest/v1/question?id=eq.<question-id>` | 更新題目 |
| DELETE | `/rest/v1/question?id=eq.<question-id>` | 刪除題目 |

#### Submission（提交）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/rest/v1/submission` | 取得提交列表 |
| POST | `/rest/v1/submission` | 建立新提交 |
| GET | `/rest/v1/submission?exercise_id=eq.<exercise-id>` | 取得練習提交 |
| PATCH | `/rest/v1/submission?id=eq.<submission-id>` | 更新提交狀態 |

#### Community Question（社群問題）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/rest/v1/community_question` | 取得社群問題 |
| POST | `/rest/v1/community_question` | 發佈新問題 |
| GET | `/rest/v1/community_question?id=eq.<question-id>` | 取得問題詳情 |
| PATCH | `/rest/v1/community_question?id=eq.<question-id>` | 更新問題 |

#### Community Answer（社群回答）

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/rest/v1/community_answer?question_id=eq.<question-id>` | 取得問題回答 |
| POST | `/rest/v1/community_answer` | 發佈新回答 |

---

### Custom API 端點

#### Course API (`/api/course`)

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/course` | 取得課程列表（帶進度） |
| POST | `/api/course` | 建立課程（帶群組） |
| GET | `/api/course/:id` | 取得課程詳情 |
| PUT | `/api/course/:id` | 更新課程 |
| DELETE | `/api/course/:id` | 刪除課程 |

#### Lesson API (`/api/course/:courseId/lesson`)

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/course/:courseId/lesson` | 取得課程所有課時 |
| POST | `/api/course/:courseId/lesson` | 建立新課時 |
| GET | `/api/course/:courseId/lesson/:lessonId` | 取得課時詳情 |
| PUT | `/api/course/:courseId/lesson/:lessonId` | 更新課時 |
| DELETE | `/api/course/:courseId/lesson/:lessonId` | 刪除課時 |

#### Submission API (`/api/submission`)

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/submission` | 取得提交列表 |
| POST | `/api/submission` | 提交練習答案 |
| PATCH | `/api/submission/:id` | 更新提交狀態（批改） |

#### Mail API (`/api/mail`)

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/mail` | 發送郵件 |

**請求格式：**
```json
{
  "to": "user@example.com",
  "subject": "郵件主題",
  "body": "郵件內容"
}
```

---

## 錯誤處理

### HTTP 狀態碼

| 狀態碼 | 說明 |
|--------|------|
| 200 | 成功 |
| 201 | 已建立 |
| 400 | 請求錯誤（參數無效） |
| 401 | 未認證（Token 無效或過期） |
| 403 | 無權限（RLS 策略拒絕） |
| 404 | 資源不存在 |
| 409 | 衝突（資源已存在） |
| 500 | 伺服器錯誤 |

### 常見錯誤碼

| 錯誤碼 | 說明 | 解決方案 |
|--------|------|----------|
| `invalid_credentials` | 登入憑證無效 | 檢查郵箱和密碼 |
| `email_not_verified` | 郵箱未驗證 | 檢查驗證郵件 |
| `row_level_security` | RLS 策略拒絕 | 檢查用戶權限 |
| `duplicate_key` | 主鍵衝突 | 資源已存在 |
| `foreign_key` | 外鍵約束錯誤 | 檢查關聯資源是否存在 |

---

## 資料模型

### Profile（用戶資料）

```typescript
interface Profile {
  id: string;              // UUID，關聯 auth.users
  fullname: string;        // 全名
  username: string;        // 用戶名
  email: string;           // 郵箱
  avatar_url: string;      // 頭像 URL
  created_at: string;      // 建立時間
  updated_at: string;      // 更新時間
}
```

### Organization（組織）

```typescript
interface Organization {
  id: string;              // UUID
  name: string;            // 組織名稱
  site_name: string;       // 站點名稱（子域名）
  description: string;     // 描述
  logo: string;            // Logo URL
  landing_page: object;    // 落地頁配置（JSON）
  theme: string;           // 主題色
  created_at: string;
  updated_at: string;
}
```

### Course（課程）

```typescript
interface Course {
  id: string;              // UUID
  title: string;           // 課程標題
  description: string;     // 課程描述
  overview: string;        // 課程概述
  logo: string;            // Logo URL
  banner_image: string;    // 橫幅圖片 URL
  slug: string;            // URL 友善標識
  group_id: string;        // 所屬群組 ID
  is_published: boolean;   // 是否已發佈
  is_template: boolean;    // 是否為模板
  cost: number;            // 課程費用
  currency: string;        // 貨幣
  metadata: object;        // 元資料（JSON）
  status: string;          // 狀態（ACTIVE/ARCHIVED）
  created_at: string;
  updated_at: string;
}
```

### Lesson（課時）

```typescript
interface Lesson {
  id: string;              // UUID
  title: string;           // 課時標題
  course_id: string;       // 所屬課程 ID
  order: number;           // 排序順序
  is_unlocked: boolean;    // 是否解鎖
  created_at: string;
  updated_at: string;
}
```

### Exercise（練習）

```typescript
interface Exercise {
  id: string;              // UUID
  title: string;           // 練習標題
  lesson_id: string;       // 所屬課時 ID
  created_at: string;
  updated_at: string;
}
```

### Question（題目）

```typescript
interface Question {
  id: string;              // UUID
  exercise_id: string;     // 所屬練習 ID
  title: string;           // 題目標題
  description: string;     // 題目描述
  type: string;            // 題型
  points: number;          // 分數
  order: number;           // 排序
  created_at: string;
  updated_at: string;
}
```

### Submission（提交）

```typescript
interface Submission {
  id: string;              // UUID
  exercise_id: string;     // 所屬練習 ID
  submitted_by: string;    // 提交者（groupmember ID）
  status_id: number;       // 狀態 ID
  total: number;           // 總分
  feedback: string;        // 回饋
  created_at: string;
  updated_at: string;
}
```

### Group Member（群組成員）

```typescript
interface GroupMember {
  id: string;              // UUID
  group_id: string;        // 群組 ID
  profile_id: string;      // 用戶 ID
  role_id: number;         // 角色 ID
  assigned_student_id: string; // 學號
  created_at: string;
  updated_at: string;
}
```

### Community Question（社群問題）

```typescript
interface CommunityQuestion {
  id: string;              // UUID
  title: string;           // 問題標題
  body: string;            // 問題內容
  course_id: string;       // 關聯課程 ID
  org_id: string;          // 所屬組織 ID
  author_id: string;       // 作者 ID
  created_at: string;
  updated_at: string;
}
```

---

## 附錄

### Supabase 查詢語法

Supabase REST API 支援以下查詢參數：

**過濾：**
```
?column=eq.value      # 等於
?column=neq.value     # 不等於
?column=gt.value      # 大於
?column=gte.value     # 大於等於
?column=lt.value      # 小於
?column=lte.value     # 小於等於
?column=like.value    # 模糊匹配
?column=ilike.value   # 不區分大小寫模糊匹配
?column=is.null       # 是否為 null
?column=in.(a,b,c)    # 在列表中
```

**排序：**
```
?order=column.asc     # 升序
?order=column.desc    # 降序
```

**分頁：**
```
?limit=10             # 限制數量
?offset=0             # 偏移量
```

**選擇欄位：**
```
?select=id,title,description   # 只選擇特定欄位
?select=*,author:profile(*)    # 包含關聯資料
```

**範例：**
```bash
# 取得某課程的已發佈課時，按順序排列
curl 'https://<project-ref>.supabase.co/rest/v1/lesson?course_id=eq.<course-id>&order=order.asc' \
  -H 'apikey: <anon-key>' \
  -H 'Authorization: Bearer <jwt-token>'
```
