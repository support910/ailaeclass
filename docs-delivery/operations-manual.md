# 運維手冊

## 目錄

1. [日常運維](#日常運維)
2. [監控與日誌](#監控與日誌)
3. [備份與恢復](#備份與恢復)
4. [效能優化](#效能優化)
5. [常見問題排查](#常見問題排查)
6. [安全維護](#安全維護)
7. [升級指南](#升級指南)

---

## 日常運維

### 服務狀態檢查

**檢查 Dashboard 服務：**

```bash
# Vercel 部署
vercel ls

# 自建部署（PM2）
pm2 status
pm2 logs ailaeclass-dashboard --lines 50

# Docker
docker ps | grep ailaeclass
docker logs ailaeclass-dashboard --tail 50
```

**檢查 API 服務：**

```bash
# PM2
pm2 status ailaeclass-api
pm2 logs ailaeclass-api --lines 50

# Docker
docker logs ailaeclass-api --tail 50
```

**檢查 Supabase：**

- 前往 Supabase Dashboard → Settings → Infrastructure 查看服務狀態
- 檢查 Database → SQL Editor 執行簡單查詢確認連線

### 日誌查看

**應用日誌：**

```bash
# PM2 日誌
pm2 logs --nostream --lines 100

# 按時間篩選
pm2 logs --lines 200 | grep "ERROR\|WARN"
```

**Supabase 日誌：**

在 Supabase Dashboard 中：
- **Database Logs**: Database → Logs
- **Auth Logs**: Authentication → Logs
- **API Logs**: Settings → API → Logs
- **Storage Logs**: Storage → Logs

### 服務重啟

```bash
# PM2 重啟
pm2 restart ailaeclass-dashboard
pm2 restart ailaeclass-api

# Docker 重啟
docker restart ailaeclass-dashboard
docker restart ailaeclass-api

# 全部重啟
pm2 restart all
```

---

## 監控與日�

### Sentry 錯誤監控

ailaeclass 整合了 Sentry 進行錯誤監控：

**Dashboard 端：**
- 環境變數：`VITE_SENTRY_AUTH_TOKEN`、`VITE_SENTRY_ORG_NAME`、`VITE_SENTRY_PROJECT_NAME`
- 監控前端 JavaScript 錯誤
- 追蹤 API 請求失敗

**API 端：**
- 環境變數：`SENTRY_DNS`
- 監控後端服務錯誤
- 追蹤未捕獲異常

**查看錯誤報告：**
1. 登入 [sentry.io](https://sentry.io)
2. 選擇對應項目
3. 查看 Issues 頁面了解錯誤詳情

### Supabase 監控

在 Supabase Dashboard 中監控以下指標：

| 指標 | 位置 | 說明 |
|------|------|------|
| Database Connections | Database → Reports | 資料庫連線數 |
| API Requests | Settings → API → Logs | API 請求量 |
| Auth Events | Authentication → Logs | 認證事件 |
| Storage Usage | Storage → Usage | 儲存空間使用量 |
| Bandwidth | Settings → Usage | 頻寬使用量 |

### 效能監控

**Supabase 資料庫效能：**

```sql
-- 查看慢查詢
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 查看資料庫大小
SELECT pg_size_pretty(pg_database_size(current_database()));

-- 查看各表格大小
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size('public.' || table_name)) as total_size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size('public.' || table_name) DESC;
```

---

## 備份與恢復

### Supabase 自動備份

Supabase Cloud 提供自動備份：

- **免費方案**: 7 天保留期
- **Pro 方案**: 30 天保留期
- **Team/Enterprise 方案**: 可自訂保留期

在 Supabase Dashboard → Database → Backups 中查看和恢復備份。

### 手動備份

```bash
# 備份整個資料庫
supabase db dump --db-url postgresql://postgres:<password>@<host>:5432/postgres > backup_$(date +%Y%m%d).sql

# 只備份 Schema
supabase db dump --schema-only > schema_backup_$(date +%Y%m%d).sql

# 只備份資料
supabase db dump --data-only > data_backup_$(date +%Y%m%d).sql
```

### 恢復資料庫

```bash
# 從備份恢復
psql postgresql://postgres:<password>@<host>:5432/postgres < backup_20260101.sql

# 或使用 Supabase CLI
supabase db reset --db-url postgresql://postgres:<password>@<host>:5432/postgres
```

### Storage 備份

Supabase Storage 中的檔案（圖片、影片等）：

```bash
# 使用 Supabase CLI 下載所有 Storage 檔案
supabase storage list --bucket-id <bucket-id>

# 或直接從 Supabase Dashboard → Storage 匯出
```

### 備份排程建議

| 項目 | 頻率 | 保留期限 |
|------|------|----------|
| 資料庫完整備份 | 每日 | 30 天 |
| 資料庫增量備份 | 每小時 | 7 天 |
| Storage 檔案備份 | 每週 | 90 天 |
| 設定檔備份 | 每次變更 | 永久 |

---

## 效能優化

### 資料庫優化

**1. 建立索引**

```sql
-- 為常用查詢欄位建立索引
CREATE INDEX IF NOT EXISTS idx_course_org_id ON public.course(org_id);
CREATE INDEX IF NOT EXISTS idx_lesson_course_id ON public.lesson(course_id);
CREATE INDEX IF NOT EXISTS idx_groupmember_profile_id ON public.groupmember(profile_id);
CREATE INDEX IF NOT EXISTS idx_submission_exercise_id ON public.submission(exercise_id);
```

**2. 清理過期資料**

```sql
-- 清理過期的 session
DELETE FROM auth.sessions WHERE expires_at < now();

-- 清理舊的通知記錄（如有）
DELETE FROM public.notifications WHERE created_at < now() - interval '90 days';
```

**3. 分析查詢效能**

```sql
-- 分析表格統計資訊
ANALYZE;

-- 查看索引使用率
SELECT
  indexrelname as index_name,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### 應用效能優化

**1. 啟用 CDN**

對於自建部署，使用 Cloudflare 或類似 CDN 服務：
- 靜態資源（JS、CSS、圖片）通過 CDN 分發
- 啟用 Brotli/Gzip 壓縮

**2. 圖片優化**

- 上傳前壓縮圖片
- 使用 WebP 格式
- 設定適當的圖片尺寸限制

**3. 快取策略**

```nginx
# Nginx 快取配置示例
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## 常見問題排查

### 1. 用戶無法登入

**症狀：** 登入頁面顯示錯誤或重定向失敗

**排查步驟：**
1. 檢查 Supabase Auth 服務狀態
2. 確認 `PUBLIC_SUPABASE_URL` 和 `PUBLIC_SUPABASE_ANON_KEY` 正確
3. 檢查 Supabase Authentication → Logs 中的錯誤記錄
4. 確認 CORS 設定包含應用域名

```sql
-- 檢查用戶是否存在
SELECT id, email, created_at FROM auth.users WHERE email = 'user@example.com';
```

### 2. 課程內容無法載入

**症狀：** 課程頁面空白或顯示錯誤

**排查步驟：**
1. 檢查瀏覽器控制台錯誤
2. 確認 RLS 策略正確設定
3. 檢查資料庫連線

```sql
-- 檢查課程是否存在
SELECT id, title, is_published, status FROM public.course WHERE id = '<course-id>';

-- 檢查用戶權限
SELECT * FROM public.groupmember
WHERE profile_id = '<user-id>'
AND group_id = (SELECT group_id FROM public.course WHERE id = '<course-id>');
```

### 3. 圖片/影片上傳失敗

**症狀：** 上傳進度條卡住或顯示錯誤

**排查步驟：**
1. 檢查 Supabase Storage 服務狀態
2. 確認 Storage Bucket 已建立且權限正確
3. 檢查檔案大小限制（預設 50MB）
4. 確認 API 服務和 Cloudflare R2 配置（影片）

```sql
-- 檢查 Storage Buckets
SELECT * FROM storage.buckets;

-- 檢查上傳記錄
SELECT * FROM storage.objects ORDER BY created_at DESC LIMIT 10;
```

### 4. 社群功能異常

**症狀：** 無法發佈問題或回覆

**排查步驟：**
1. 檢查 `community_question` 和 `community_answer` 表的 RLS 策略
2. 確認用戶已加入對應組織

```sql
-- 檢查社群問題
SELECT * FROM public.community_question ORDER BY created_at DESC LIMIT 10;

-- 檢查 RLS 策略
SELECT * FROM pg_policies WHERE tablename = 'community_question';
```

### 5. 效能下降

**症狀：** 頁面載入緩慢、API 回應超時

**排查步驟：**
1. 檢查 Supabase Database → Reports 中的連線數和查詢效能
2. 查看慢查詢記錄
3. 檢查 API 服務的 CPU 和記憶體使用率
4. 確認是否有大量並發請求

```sql
-- 查看目前連線數
SELECT count(*) FROM pg_stat_activity;

-- 查看鎖定的查詢
SELECT * FROM pg_locks WHERE NOT granted;
```

---

## 安全維護

### 定期安全檢查

**1. 金鑰輪換**

定期更換以下金鑰（建議每 90 天）：
- Supabase Service Role Key
- SMTP 密碼
- Cloudflare API 金鑰
- OpenAI API Key

**2. RLS 策略審查**

```sql
-- 列出所有 RLS 策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**3. 用戶權限審查**

```sql
-- 列出所有組織管理員
SELECT
  p.fullname,
  p.email,
  o.name as org_name,
  r.name as role_name
FROM public.organizationmember om
JOIN public.profile p ON p.id = om.profile_id
JOIN public.organization o ON o.id = om.organization_id
JOIN public.role r ON r.id = om.role_id
WHERE r.name = 'ADMIN';
```

### 安全設定建議

1. **啟用 MFA**: 在 Supabase Dashboard → Authentication → MFA 中啟用
2. **設定密碼政策**: 要求強密碼（最少 8 字元，包含大小寫和數字）
3. **限制 API 存取**: 設定 Rate Limiting
4. **HTTPS Only**: 確保所有服務使用 HTTPS
5. **CORS 白名單**: 只允許信任的域名

---

## 升級指南

### 升級 ailaeclass

```bash
# 1. 備份資料庫
supabase db dump > backup_before_upgrade_$(date +%Y%m%d).sql

# 2. 拉取最新程式碼
git pull origin main

# 3. 安裝新依賴
pnpm install

# 4. 執行資料庫遷移（如有）
supabase db push --include-all

# 5. 重新構建
pnpm build

# 6. 重啟服務
pm2 restart all
```

### 升級 Supabase

```bash
# 更新 Supabase CLI
pnpm add -g supabase@latest

# 更新本地 Supabase
supabase stop
supabase start
```

### 升級依賴

```bash
# 檢查過期依賴
pnpm outdated

# 更新特定依賴
pnpm update <package-name>

# 更新所有依賴（謹慎使用）
pnpm update
```

### 回滾步驟

如果升級後出現問題：

```bash
# 1. 恢復程式碼
git checkout <previous-version-tag>

# 2. 恢復資料庫
psql < backup_before_upgrade_20260101.sql

# 3. 重新構建
pnpm install
pnpm build

# 4. 重啟服務
pm2 restart all
```
