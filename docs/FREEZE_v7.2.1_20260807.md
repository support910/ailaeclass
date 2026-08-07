# 冻结点与回退手册 — v7.2.1 / 2026-08-07

本文件记录 v7.3 开发开始前的冻结基线，以及经过实测的回退路径。
按 `docs/AiLAE_Class_V7_完整交互文档` §18.4 备份规则编写。

---

## 1. 冻结基线

| 对象 | 值 |
|---|---|
| Git 仓库 | `https://github.com/support910/ailaeclass.git` |
| 工作目录 | `E:\Class\ailaeclass-v7`（git worktree，主库在 `E:\Class\ailaeclass-v3\.git`） |
| 开发分支 | `v7-development` |
| 冻结提交 | `f31768f` — build: raise dashboard heap limit for Railway |
| **冻结 tree** | **`1b1b1c71ea40ebadce936866e0a1a4bf7d809609`** |
| 备份分支 | `backup/v7.2.1-20260807` |
| 备份标签 | `freeze/v7.2.1-20260807` |
| 线上 main | `origin/main` @ `413baafa925b08d3a6223b970e70a54b59e513d8` |

**已验证**：`freeze/v7.2.1-20260807`、`HEAD`、`origin/main` 三者 tree 哈希完全相同
（均为 `1b1b1c7...`，`git diff --name-only HEAD origin/main` 输出 0 行）。

说明：历次发布用的是 `v7-development` rebase 到 `main`，所以提交哈希不同但内容一致。
**回退的锚点是 tree 哈希，不是 commit 哈希。**

## 2. 未纳入 Git 的备份

`.env` 与交互文档未被 Git 跟踪，另存于 `E:\Class\.archive\freeze-v7.2.1-20260807\`：

```text
AiLAE_Class_V7_完整交互文档_20260807.docx
root.env.bak                  <- E:\Class\ailaeclass-v7\.env
dashboard.env.bak             <- apps\dashboard\.env
dashboard.env.local.bak       <- apps\dashboard\.env.local
```

该目录含真实密钥，**不得进入 Git、截图或聊天记录**。

## 3. 数据库与存储

| 对象 | 状态 |
|---|---|
| Supabase 项目 | `kiqzanfkpivkuvlvxqsp` |
| 迁移文件数 | 50，最新 `20260803090000_data_cockpit_privacy_audit.sql` |
| 本次冻结 | **不含任何新迁移** |

数据库未改动，因此回退代码不需要回退数据库。若 v7.3 引入迁移，必须在本文件追加
「迁移名 + 是否幂等 + 回退脚本」三项，缺一不可。

## 4. 部署配置

| 项 | 值 |
|---|---|
| Railway 项目 | `attractive-harmony` / `d5f08192-ace8-4d1e-8fb1-1475b4dbb63b` |
| 环境 | production / `10a0b929-3cfc-4ffd-8a8c-b3fe6d2ee30f` |
| 服务 | `ailaeclass` / `dc5d5935-1b0f-4a09-b901-95b5a7ca8be3` |
| 生效配置文件 | **`railway.toml`**（Railway 实际读取的，非 `railway.json`） |
| 构建方式 | DOCKERFILE — `docker/Dockerfile.dashboard` |
| 启动命令 | `pnpm dashboard:start` |
| 端口 | `3082` |
| 部署来源 | GitHub 分支 `main`，推送即自动部署 |
| 套餐 | hobby |

## 5. 回退操作

### 5.1 代码回退（应用层）

线上 `main` 当前就是冻结内容，所以**只要不动 main，线上代码即为冻结版本**。

若 v7.3 已推到 main 需要回退：

```powershell
cd E:\Class\ailaeclass-v7
git fetch origin
# 确认要回到的内容 tree 是 1b1b1c71ea40ebadce936866e0a1a4bf7d809609
git rev-parse freeze/v7.2.1-20260807^{tree}
# 把 main 强制指回冻结内容
git push origin +413baafa925b08d3a6223b970e70a54b59e513d8:main
```

Railway 检测到 main 变化后自动重建。**回退同样需要一次完整构建，不是秒切。**

### 5.2 本地工作区回退

```powershell
cd E:\Class\ailaeclass-v7
git checkout v7-development
git reset --hard freeze/v7.2.1-20260807
# 校验
git rev-parse HEAD^{tree}   # 必须输出 1b1b1c71ea40ebadce936866e0a1a4bf7d809609
```

### 5.3 环境变量回退

Railway 变量不随 Git 回退。若 v7.3 改过变量，按第 6 节的清单逐项还原。

### 5.4 回退后验证

```powershell
npx -y @railway/cli service list --project d5f08192-ace8-4d1e-8fb1-1475b4dbb63b --environment production --json
curl.exe -I --max-time 30 https://ailaeclass.5gnumultimedia.com/login
```

期望：`status: SUCCESS`、`replicas.running: 1`、`/login` 返回 200。

## 6. 冻结时的 Railway 生产环境变量

只记录变量名与是否已设置，**不记录值**。

已设置：`PORT=3082`、`PUBLIC_SUPABASE_URL`、`PUBLIC_SUPABASE_ANON_KEY`、
`PRIVATE_SUPABASE_SERVICE_ROLE`、`PRIVATE_DEEPSEEK_API_KEY`、
`PRIVATE_DEEPSEEK_API_KEY_RUNTIME`、`PRIVATE_DEEPSEEK_MODEL`、
`PRIVATE_AI_MAX_TOKENS`、`PRIVATE_APP_HOST`、`PRIVATE_APP_SUBDOMAINS`、
`PUBLIC_IS_SELFHOSTED`、`RAILWAY_DOCKERFILE_PATH`。

设置为空：`PUBLIC_SINGLE_ORG_SITE_NAME`（本地 `apps/dashboard/.env` 是 `admin`，
本地跑的是单机构模式，线上是多机构模式，两者行为不同，本地验收时须注意）。

生产未设置：`ORIGIN`、`PUBLIC_SERVER_URL`、`OPENAI_API_KEY`、`PRIVATE_KIMI_API_KEY`、
`UNSPLASH_API_KEY`、`PUBLIC_IP_REGISTRY_KEY`、`STRIPE_*`、`SMTP_*`、`FUNNEL_*`。

Supabase 密钥已是新版格式（`sb_publishable_` / `sb_secret_`），本地与生产**一致**。

## 7. 冻结时刻的生产状态（重要）

```text
Railway service ailaeclass : status = FAILED
replicas.running           : 0
最后一次部署                : 2026-08-03T15:44:44Z
https://ailaeclass.5gnumultimedia.com/login -> HTTP 404
  body: {"status":"error","code":404,"message":"Application not found"}
```

**冻结时生产环境已不可用，且已持续 4 天。**
构建与健康检查均成功，容器启动后进程以 `ELIFECYCLE Command failed` 退出。

因此「回退到上一个版本」= 回到这份代码，**不等于回到一个可用的线上服务**。
恢复线上可用性是独立于代码回退的工作，见 v7.3 计划。
