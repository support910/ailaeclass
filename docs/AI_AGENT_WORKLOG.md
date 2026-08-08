# AI 代理工作记录 / AI Agent Worklog

> **给下一个 AI 的第一句话**：动手改任何东西之前，先读完本文件的「第 0 节 不变量」和「第 1 节 当前状态」。
> 这份文件记录**每一轮 AI 做了什么、为什么、验证到什么程度**，目的是让你不必重新摸索，
> 也不会把已经确认过的功能关系搞混。
>
> **写入规则**：每完成一轮更新，在「变更日志」**顶部**追加一条新记录（倒序，新的在上）。
> 不要删除旧记录。不要在本文件写任何真实密钥、密码、Token 或完整连接串。

---

## 0. 不变量（改动前必读，违反即为回归）

这些是产品已确认的规则，来自 `docs/AiLAE_Class_V7_完整交互文档_20260807.docx` §23.1「不得回退的既定规则」。
**除非用户明确要求，否则不得改变以下任何一条：**

1. 系统只有**管理端 / 教师端 / 学生端**三个角色入口，不得出现家长端。
2. 教师可以创建课程，但**只能管理自己创建或被管理员分配的课程**；其他课程走与学生一致的只读预览。
   （课程列表页已正确实现为「我管理的」+「可瀏覽課程」两段式，不要改成平铺。）
3. 学生「收藏」「申请」**不等于加入课程**；当前教师端**没有批准/拒绝按钮**，也不得自动入课。
4. 数据驾驶舱、反馈审批、支付核验 = **必须同时满足**组织管理员角色 **且** 账号为 `admin@5gnu.com`。
   代码里的判定写法：`$isOrgAdmin === true && email === SUPER_ADMIN_EMAIL`。
5. 考试图片必须**即时预览、刷新后保留**，且在学生作答页与结果页都能看到。
6. 传统考试提交后统一反馈；速解训练逐题即时反馈。两者都遵守时长与尝试次数。
7. AI 默认**不保存原始问答**，只留清理后的元数据（`store_ai_content` 默认 false）。
8. 支付**不能由客户端确认成功**；未配置正式密钥时保持安全演示，不得伪造成功。
9. 待开放模块只是 Demo 框架，**不读写正式业务表**、不发通知、不产生统计。
10. 旧版本备份保持只读；Railway **不重复创建正式服务**。

## 0.1 容易搞混的功能关系（前几轮踩过的坑）

| 容易误解的地方 | 实际情况 |
|---|---|
| `/org/{slug}/settings` vs `/org/{slug}/setup` | **两个不同页面**。`settings` 是**个人资料页**，三端都能开（组织相关标签对非管理员是置灰禁用的），这是正常设计；`setup` 是**组织初始化向导**，只有管理员能开。侧栏「設置」指向的是 `setup`。 |
| 侧栏「成员」 | 交互文档写的是「成员」，实际界面叫**「受眾 Audience」**，路由 `/org/{slug}/audience`。 |
| 「AiLAE Agent」 | 界面上显示的是 **「ailaeclass Agent」**。文档与界面命名不一致，改文案前先确认要以哪边为准。 |
| 考试类型（传统/速解） | **只能在创建时选定，编辑器里没有切换控件**。`ExamSettingsPanel` 里的 `isQuickPractice` 是只读派生值。不要以为是 bug 去「补」这个功能。 |
| 考试删除的二次确认 | 用的是**浏览器原生 `confirm()`**，不是自定义弹窗。用 Playwright 测试时必须 `page.on('dialog', d => d.accept())`，否则默认被取消，删除静默失败。 |
| 考试创建成功后 | **停留在考试列表页**，不跳转编辑器。这是产品行为，不是失败。 |
| 支付页的 Airwallex | `PaymentCenter.svelte` **无条件渲染** `<AirwallexCheckout />`，不读 `PAYMENT_PROVIDER`；而服务端 `provider.server.ts` 默认返回 `stripe`。UI 与交互文档 §11.1（FPS 为主、Airwallex 不作默认入口）**不一致**，属已知未决问题。 |
| 布局组件的动画 | `org/[slug]/+layout.svelte` 与 `lms/+layout.svelte` 在客户端路由切换时**不会重新挂载**，所以挂载动画只播一次。要做切换动效必须用 `$navigating`。**且不得使用 `transform`**——它会成为 `position: fixed` 子元素的包含块，导致弹窗和悬浮按钮错位。 |
| 本地与生产的模式差异 | 本地 `apps/dashboard/.env` 的 `PUBLIC_SINGLE_ORG_SITE_NAME=admin`（单机构模式），生产该变量为**空**（多机构模式）。本地验收通过不代表生产行为一致。 |

---

## 1. 当前状态（每轮更新后同步修改本节）

**更新时间**：2026-08-08（侧栏分组 + 首屏优化后）

| 项 | 值 |
|---|---|
| 工作目录 | `E:\Class\ailaeclass-v7`（git worktree，主库在 `E:\Class\ailaeclass-v3\.git`） |
| 当前分支 | `v7-development` |
| 最新提交 | `cc0cec0` perf: unblock first paint and group the org sidebar |
| 冻结基线 | 标签 `freeze/v7.2.1-20260807`，分支 `backup/v7.2.1-20260807`，tree `1b1b1c71ea40ebadce936866e0a1a4bf7d809609` |
| 待发布分支 | `deploy/v7.3-security-20260807`（基于 `origin/main`，纯 fast-forward，**尚未推送**） |
| 线上 main | `origin/main` @ `413baaf`，**未被改动** |
| 数据库 | Supabase `kiqzanfkpivkuvlvxqsp`，50 个迁移，**本轮无新迁移** |
| 未提交改动 | 无 |

**生产环境状态：正常。** 2026-08-08 套餐购买后 Railway 自动恢复部署，`/login` 返回 200。

**历史教训（保留备查）**：2026-08-07 曾因免费试用期到期，平台停止账户下**所有**部署，
域名返回 `{"code":404,"message":"Application not found"}`。当时 `railway usage` 显示
「无限额 / Over limit: no」，**不会**暴露试用期到期状态——不能只凭 usage 判断账单健康，
要以 `railway redeploy` 等命令的实际返回为准。线上跑的代码仍是 `origin/main@413baaf`，
本地的 v7.3 与本轮 UI 优化**均未推送**。

---

## 2. 测试工装

位置：`apps/dashboard/.probe/`（已加入 `.gitignore`，不进版本库）

| 脚本 | 用途 |
|---|---|
| `02-patient.mjs <role>` | 登录并保存 storageState 到 `.probe/auth-<role>.json`，其他脚本依赖它 |
| `03-walk.mjs <role> <路由...>` | 批量走路由、截图、抓 console/HTTP 错误 |
| `06-authz.mjs` | 越权边界：服务端 API 守卫 + UI 守卫 |
| `20-verify-v73.mjs` | v7.3 安全修复验收（14 项） |
| `40-exam-readonly.mjs` | 考试系统只读回归（16 项） |
| `49-save-proof.mjs` | 考试保存持久化证明（读 input value，不是 innerText） |
| `44-cleanup2.mjs` | 清理 `ZZ-V73回归测试-*` 测试草稿 |

测试账号（密码均为 `123456`）：
`admin@5gnu.com` / `v5test.teacher@5gnu.com` / `v5test.student1@5gnu.com`

**写测试时的两个坑**：
- 断言表单值要用 `input.value`，**不能用 `body.innerText`**（读不到 input/textarea 的内容）。
- 选择器不要用裸 `li`，会先匹配到侧栏导航项。用 `.bx--list-box__menu-item, [role="option"]`。

**本地启动**：
```powershell
cd E:\Class\ailaeclass-v7\apps\dashboard
npx vite dev --port 5173 --host 127.0.0.1
```
⚠️ 本地 `.env` 指向**生产 Supabase**，本地操作会写生产库。默认只读浏览，写数据前先问用户。

---

## 3. 变更日志（新的记录加在最上面）

### 2026-08-08 · 侧栏分组 + 首屏解除阻塞（已提交 `cc0cec0`）

**触发**：用户反馈「模块切换不够丝滑、加载太久、左侧栏目太多太杂」。

**先测量再动手。** dev 模式按需编译，测了没意义，必须用生产构建（`node build`，需先 `set -a && . ./.env`，
否则会因缺 `PUBLIC_SUPABASE_URL` 直接退出）。基线：每页 ~150 请求、~2.9MB JS。

查到三个大件：

| 资源 | 大小 | 结论 |
|---|---|---|
| `chunks/full.js` | 1.1MB | **OpenCC 简繁字典**。代码**已正确按语言门控**（`$: if (browser && $locale === 'zh-TW') loadTraditionalConverter()`），英文/简中用户不加载。之前量到是因为 admin 账号是繁中。**不要误以为是 bug 去"修"。** |
| `static/carbon-all.css` | 737KB | 渲染阻塞、每页必载。**未处理**：改异步会导致 Carbon 组件闪烁（FOUC），属可见回归。要真解决需改为按组件引入样式，另开一轮。 |
| `cdn.plyr.io/plyr.js` | 外部 CDN | **已修**：`<head>` 里的同步外链脚本，阻塞 HTML 解析等一次 CDN 往返，而只有课程视频页用得到。加 `defer`。 |

**plyr 加 defer 为什么安全**：延迟脚本仍按文档顺序在 DOMContentLoaded 前执行，排在 SvelteKit 的
module 脚本之前；且 `ComponentVideo.svelte` 在 `onMount()` 里初始化并已有
`typeof window.Plyr === 'undefined'` 守卫，最坏情况是降级不是崩溃。

**实测改善**（同机、同方法、生产构建）：

```
DOM ready 平均      1207ms -> 868ms   (-28%)
控制台 FCP          2700ms -> 1516ms  (-44%)
控制台可见内容      2776ms -> 1621ms  (-42%)
```

字节数不变——defer 解除的是阻塞不是重量。本地无网络延迟，真实网络下改善应更大。

**侧栏分组**：13 项扁平 → 控制台固定 + 教學 / 智能中心 / 營運 / 幫助與設定 四个折叠分组。
**所有 path 一行未改**，只改呈现，深链接与权限守卫行为完全不变。
两个防退化设计：① 当前页所在分组**自动展开**；② 收起时若含当前页，标题旁显示小圆点；
③ 用户手动切换过的分组记住自己的状态，不再被自动展开覆盖（`groupTouched`）。

**验证**：构建 exit 0；导航回归 **22/22**（13 个入口逐个点击验证跳转 + 3 个分组自动展开 + 零错误）；
安全验收 14/14；考试只读 16/16；越权守卫未变。

**未做**：学生端侧栏仍是扁平 11 项；二级 hub 页面（用折叠分组替代实现减负）；Carbon CSS 瘦身。

**线上状态变化**：Railway 套餐已购买，平台**自动恢复**了部署，
`https://ailaeclass.5gnumultimedia.com/login` 返回 200。无需人工 redeploy。

### 2026-08-08 · 控制台 UI 改版 + 切换动效（未提交）

**触发**：用户反馈「控制台的 UI 很丑，每一个切换时候的 UI 和切换的界面都变化一下」。

**改了什么**

| 文件 | 改动 | 性质 |
|---|---|---|
| `lib/components/Analytics/ActivityCard.svelte` | 统计卡片重做：标签左上、图标收进 36px 圆角方块置右上、数值 30px 等宽数字、hover 上浮 2px + 阴影 | 纯样式 |
| `routes/org/[slug]/+page.svelte` | 去掉 Carbon `Grid`/`SkeletonPlaceholder`/`Link`，改用原生 grid + 新骨架；两个面板加分隔线标题、行级 hover、整行可点 | 样式 + 结构，**数据流未动** |
| `routes/org/[slug]/+layout.svelte` | 加 `RouteProgress` + 切换淡入淡出 | 新增 |
| `routes/lms/+layout.svelte` | 同上，保持两端一致 | 新增 |
| `lib/components/Skeleton/Shimmer.svelte` | 新增：shimmer 骨架，形状与真实内容对齐 | 新增 |
| `lib/components/Skeleton/StatCardSkeleton.svelte` | 新增：与 ActivityCard 同尺寸，避免加载完布局跳动 | 新增 |
| `lib/components/Navigation/RouteProgress.svelte` | 新增：顶部 3px 进度条，由 `$navigating` 驱动 | 新增 |

**过程中自己发现并修掉的 bug**：第一版用 `transform: translateY()` 做上滑动画，有两个问题——
① 布局组件在客户端路由切换时不重新挂载，动画只在整页加载时播一次，实际不生效；
② `transform` 会让内部 `position: fixed` 元素（弹窗、Chatbot 悬浮按钮、考试页固定工具条）
以布局容器为定位基准而错位。改为 `$navigating` 结束时触发 + **只动 opacity**。
**后来者注意：不要把 transform 加回去。**

**验证**：生产构建 exit 0（1m30s）；安全验收 14/14；考试只读回归 16/16。

**未做**：学生端首页、课程列表、考试列表、支付页的版式未改，只加了切换动效。

---

### 2026-08-07 · v7.3 安全修复 + 部署配置修正（已提交 `6eb4755`、`511c415`）

**触发**：用户要求冻结备份后开始新版本，范围选定为「只做安全修复 + 部署配置修正」。

| 编号 | 问题 | 修复 |
|---|---|---|
| SEC-01 | `/org/{slug}/setup` **零角色守卫**，教师/学生可直接打开组织初始化向导，且「更新組織資料」「發佈課程」按钮可点 | 套用与 `audience` 一致的 `isOrgAdmin` + `PageUnauthorized` 守卫；`$isOrgAdmin === null` 时渲染空白，避免判定完成前闪出向导 |
| SEC-02 | 生产未设 `PRIVATE_AUDIT_SALT`，代码回退到源码内公开常量 `'ailaeclass-local-audit-salt'`，IP/UA 哈希可被彩虹表还原 | 改为未配置时生成**每进程随机盐**并告警一次。**仍需在 Railway 设置该变量**才能得到稳定且非公开的指纹 |
| SEC-03 | 数据驾驶舱无权限页无返回路径 | 加返回按钮 + 繁中/简中/英三套 `back` 文案 |
| SEC-04 | `PageUnauthorized` 用相对路径 `./unauthorized.svg`，嵌套路由下 404 破图 | 改绝对路径 `/unauthorized.svg` |
| CFG-01 | `railway.json`（NIXPACKS，`restartPolicyType: "never"`）与 `railway.toml`（DOCKERFILE，`ON_FAILURE`）冲突 | 删除 `railway.json`。生产实际读的是 `railway.toml`，代码无任何引用。`never` 一旦生效会让单次崩溃变成永久宕机 |

**验证**：构建 exit 0；`20-verify-v73.mjs` 14/14；服务端守卫复核
（data-cockpit API：admin 200 / teacher 403 / student 403 / 无 token 401）。

**考试系统回归**（用户特别要求，确认未被以上改动影响）：
- 只读 16/16：两种模式分组、回收站、两份 100 次验收考试、编辑器题号/时长/次数、9 张图片 0 破图、学生练习页
- 保存持久化 8/8：改描述 → 保存（`考試保存成功`）→ **硬刷新重新读库** → 值确实变更
- 回收站：删除确认文案「保留 3 天」、`自動清理時間` 精确 +3 天、恢复功能正常

**测试期间在生产库建过 4 条 `ZZ-V73回归测试-*` 草稿，已全部删除**，
现存于回收站，2026-08-10 自动清理。原有考试未受影响。

**未纳入本轮（仅记录，需用户决策）**：
支付页 Airwallex 主入口与文档冲突、教师控制台统计未按管理范围收敛、
AI 回答不跟随界面语言、学生 Exercises 看板横向溢出、生产未设 `ORIGIN`。

---

### 2026-08-07 · 冻结备份 v7.2.1

建立 `freeze/v7.2.1-20260807` 标签与 `backup/v7.2.1-20260807` 分支，
`.env` 与交互文档另存至 `E:\Class\.archive\freeze-v7.2.1-20260807\`（含真实密钥，不得入库）。
回退手册见 `docs/FREEZE_v7.2.1_20260807.md`。

**关键发现**：`v7-development` 与 `origin/main` **提交哈希不同但 tree 完全相同**
（历次发版是 rebase/cherry-pick 到 main）。**回退锚点必须用 tree 哈希，不是 commit 哈希。**
推送到 main 需要基于 `origin/main` 新建 `deploy/*` 分支再 cherry-pick，
直推会因历史分叉被拒，强推会重写 main 历史。

---

## 4. 相关文档

| 文件 | 内容 |
|---|---|
| `docs/AiLAE_Class_V7_完整交互文档_20260807.docx` | 产品交互规范总纲，23 章 + 3 附录，含带编号业务规则（ACC/CRS/EXM/PAY…） |
| `docs/AiLAE_Class_V7_Railway_Supabase_部署交互与密钥配置指南_20260807.docx` | 部署与密钥 SOP，含十条不可违反规则、命令速查、上线检查表 |
| `docs/FREEZE_v7.2.1_20260807.md` | 冻结点与回退手册 |
| `docs/V7_3_SECURITY_RELEASE_20260807.md` | v7.3 发版记录 |
| `PRODUCTION_DEPLOYMENT_RUNBOOK.md` | Railway/Supabase 生产目标 ID、端口 3082、验证命令 |
