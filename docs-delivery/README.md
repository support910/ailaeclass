# ailaeclass 專案交付文件清單

## 交付日期：2026 年 4 月 29 日

---

## 文件清單

| 序號 | 文件名稱 | 說明 | 格式 |
|------|----------|------|------|
| 1 | [功能交付文件](../delivery-document.pdf) | 系統功能說明與截圖 | PDF |
| 2 | [技術架構文檔](architecture.md) | 系統架構、技術棧、項目結構 | Markdown |
| 3 | [部署指南](deployment-guide.md) | 環境要求、部署步驟、域名配置 | Markdown |
| 4 | [環境配置說明](env-configuration.md) | 環境變數、第三方服務配置 | Markdown |
| 5 | [資料庫文檔](database.md) | 表結構、關聯關係、RLS 策略、遷移 | Markdown |
| 6 | [API 參考文檔](api-reference.md) | API 端點、認證、資料模型 | Markdown |
| 7 | [運維手冊](operations-manual.md) | 日常運維、監控、備份、問題排查 | Markdown |
| 8 | [UI 風格指南](ui-style-guide.md) | UI 元素規範、AI 模塊延伸開發手冊 | Markdown |

---

## 源碼結構

```
ailaeclass-main/
├── apps/                    # 應用程式
│   ├── dashboard/           # 前端主應用（SvelteKit）
│   ├── api/                 # 後端 API（Express）
│   ├── ailaeclass-com/     # 官網
│   ├── course-app/          # 課程獨立應用
│   └── docs/                # 文檔站
├── packages/                # 共用套件
├── supabase/                # Supabase 配置與遷移
├── docker/                  # Docker 配置
└── docs-delivery/           # 交付文件（本目錄）
```

---

## 快速開始

### 1. 安裝依賴

```bash
pnpm install
```

### 2. 配置環境

```bash
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/api/.env.example apps/api/.env
# 編輯 .env 填入 Supabase 配置
```

### 3. 啟動 Supabase

```bash
supabase start
supabase db reset
```

### 4. 啟動開發伺服器

```bash
pnpm dev
```

### 5. 存取服務

- Dashboard: http://localhost:5173
- API: http://localhost:3001
- Supabase Studio: http://localhost:54323

---

## 技術支援

如有任何問題，請參閱各文件中的「常見問題」章節。

---

## 版本資訊

| 項目 | 版本 |
|------|------|
| ailaeclass | v0.1.13 |
| Node.js | ^20.19.3 |
| PostgreSQL | 15.x |
| 文件版本 | v1.0 |
