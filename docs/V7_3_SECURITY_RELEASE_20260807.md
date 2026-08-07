# AiLAE Class v7.3 — 安全与部署配置修正 / 2026-08-07

变更等级：**L3 高风险**（涉及权限守卫与隐私哈希，按交互文档 §18.2 需业务负责人确认后才可发布）
基线：`freeze/v7.2.1-20260807`（tree `1b1b1c71ea40ebadce936866e0a1a4bf7d809609`）
数据库：**本次无迁移**

---

## 1. 安全修复

### SEC-01 `/org/{slug}/setup` 缺少角色守卫

**问题**：组织初始化向导路由没有任何角色判断。教师和学生直接输入 URL 可完整打开该页，
其中「更新組織資料」与「發佈課程」两个按钮处于可点击状态。

违反交互文档 §2.3 规则 6 与 NAV-005「前端守卫与服务端同时拒绝」。

**证据**：`src/routes/org/[slug]/setup/+page.svelte` 中 `isAdmin|ROLE|redirect|403|404` 零命中；
同目录 `audience/+page.svelte` 已正确使用 `PageUnauthorized`。全仓库仅 audience 一处使用该组件。

**修复**：套用与 audience 完全一致的守卫。`$isOrgAdmin === null`（成员关系尚未解析）时渲染空白，
避免在判定完成前先把向导闪出来；`!$isOrgAdmin` 渲染 `PageUnauthorized`。

**影响**：管理员行为不变；教师与学生看到「Page not found」与「Go Home」返回按钮。

### SEC-02 生产使用源码内公开的审计盐

**问题**：`PRIVATE_AUDIT_SALT` 未在 Railway 生产环境设置，代码回退到硬编码字面量
`'ailaeclass-local-audit-salt'`。该值在仓库中公开可读，因此线上对 IP 与 user-agent 的
SHA-256 哈希实际可被彩虹表还原，等于没有做去标识化。

违反交互文档 §12.4「网络和设备标识进行哈希或截断」与 DAT-006，
以及部署手册 §4.3「不得使用代码中的本地默认值」。

**修复**：`src/lib/server/analytics/audit.server.ts` 改为——未配置时生成**每进程随机盐**并输出一次
警告，不再使用公开常量。哈希立即恢复不可逆；代价是重启或多副本之间指纹不再关联。

**仍需配套操作**：在 Railway `production / ailaeclass` 新增 `PRIVATE_AUDIT_SALT`（随机强值）
才能得到稳定且非公开的指纹。**该变量尚未设置，需批准后执行。**

### SEC-03 无权限页缺少返回路径

**问题**：数据驾驶舱的无权限提示只有一行文字，没有任何返回入口，
违反交互文档 §3.4「无权限：提供返回按钮」。

**修复**：在拒绝面板增加返回按钮，指向 `/org/{siteName}`，并补齐繁中/简中/英三套文案
（`back` 键）。已实测点击可跳转。

### SEC-04 无权限插图相对路径导致破图

**问题**：`PageUnauthorized` 使用 `src="./unauthorized.svg"`，在 `/org/{slug}/setup`
这类嵌套路由下会解析成 `/org/{slug}/unauthorized.svg` 而 404，页面显示破图。属既有缺陷。

**修复**：改为绝对路径 `/unauthorized.svg`。

## 2. 部署配置修正

### CFG-01 删除 `railway.json`

仓库同时存在两份 Railway 配置且内容冲突：

| 文件 | builder | 构建 | 重启策略 |
|---|---|---|---|
| `railway.toml` | DOCKERFILE | `docker/Dockerfile.dashboard` | `ON_FAILURE`，最多 10 次 |
| `railway.json`（已删除） | NIXPACKS | `pnpm build --filter @cio/dashboard` | **`never`** |

生产部署元数据显示 `configFile: "/railway.toml"`，即 `railway.json` 当前不生效。
但其中 `restartPolicyType: "never"` 意味着一旦它生效，任何一次容器退出都将变成永久宕机。
代码库中无任何引用（仅 `HANDOVER_V6.md` 提及文件名）。

**处理**：删除 `railway.json`，`railway.toml` 成为唯一配置源。
部署手册 §1.2 与 §17.3 要求「部署前必须识别该冲突」，本次改为从根源消除。

## 3. 未纳入本次变更（仅记录）

| 项 | 说明 | 未处理原因 |
|---|---|---|
| 支付页 Airwallex 为主入口 | `PaymentCenter.svelte:337` 无条件渲染 `<AirwallexCheckout />`，不读 `PAYMENT_PROVIDER`；而服务端 `provider.server.ts` 默认 `stripe`，交互文档 §11.1 要求 Airwallex 不作默认入口 | 改动支付 UX 属业务决策 |
| 教师控制台统计未按管理范围收敛 | 显示全机构课程/学生数，与 §5.1 不符（课程列表已正确分区） | 超出本次安全范围 |
| AI 回答不跟随界面语言 | 学生端英文界面下 Chatbot 用中文回答，违反 AI-005 | 超出本次安全范围 |
| 学生 Exercises 看板横向溢出 | 1440px 下第 4 列被截断 | 超出本次安全范围 |
| 生产未设 `ORIGIN` | adapter-node 的 CSRF 判定依赖它 | 手册 §6.3 要求「修改需回归 CSRF/回调」，需单独验证 |

## 4. 验证结果

**构建**：`pnpm --filter @cio/dashboard build` 通过（adapter-node，exit 0）。

**自动化验收**：`apps/dashboard/.probe/20-verify-v73.mjs`，**14 项全部通过**。

| 用例 | 结果 |
|---|---|
| 学生访问 `/org/admin/setup` 被拦截 / 看不到向导 / 有返回按钮 | PASS ×3 |
| 教师访问 `/org/admin/setup` 被拦截 / 看不到向导 / 有返回按钮 | PASS ×3 |
| 管理员仍可正常使用 setup（无回归） | PASS |
| 学生 / 教师驾驶舱仍被拒绝 | PASS ×2 |
| 学生 / 教师无权限页有返回按钮且可跳转 | PASS ×4 |
| 超级管理员驾驶舱正常加载数据 | PASS |

**服务端守卫回归**（`.probe/06-authz.mjs`，本次未改动但复核）：
`/api/admin/data-cockpit` → admin 200 / teacher 403 / student 403 / 无 token 401。

## 5. 回退

代码回退见 `docs/FREEZE_v7.2.1_20260807.md` 第 5 节。本次无数据库迁移，
因此代码回退不需要任何数据库操作。

若已设置 `PRIVATE_AUDIT_SALT` 后再回退代码：旧代码同样读取该变量，
不会因此报错，仅哈希基准与设置前不同。
