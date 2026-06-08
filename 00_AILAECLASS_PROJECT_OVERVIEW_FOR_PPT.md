# Ailaeclass 平台整体框架与技术架构

> 适用于 PPT 介绍、项目汇报、技术交接与第五版开发启动说明。

---

## 1. 项目定位

Ailaeclass 是面向香港及国际教育场景的在线教学与考试平台，覆盖教师端、学生端、课程管理、考试发布、学习进度、证书、AI 辅助学习与多媒体内容管理。

平台第四版已完成线上部署，第五版将在第四版稳定基线之上继续迭代。

---

## 2. 当前版本状态

| 项目 | 状态 |
|---|---|
| 第四版冻结标签 | `v4.0-final` |
| 第四版冻结分支 | `freeze/v4-final` |
| 第四版基线提交 | `55d8581` |
| 第五版开发分支 | `v5-development` |
| 第五版本地目录 | `E:\Class\ailaeclass-v5` |
| 线上部署平台 | Railway |
| 生产数据库与文件服务 | Supabase |

---

## 3. 产品模块总览

```text
Ailaeclass
├─ 登录前首页
│  ├─ 香港地图科技视觉
│  ├─ 香港 18 区标注
│  ├─ Cyberport 总部区域突出
│  └─ UK / Europe / OBOR 市场连接展示
│
├─ 教师端
│  ├─ 课程管理
│  ├─ 学生与班级管理
│  ├─ 题库与考试发布
│  ├─ 图片/选项图片题目编辑
│  ├─ 提交与评分管理
│  └─ 成绩与学习数据查看
│
├─ 学生端
│  ├─ 我的课程
│  ├─ 课程学习
│  ├─ 在线考试
│  ├─ 答案提交
│  ├─ 成绩查看
│  └─ 证书页面
│
├─ AI 学习模块
│  ├─ 数学/语文问答
│  ├─ 苏格拉底式引导
│  ├─ 直接答案模式
│  └─ Kimi / DeepSeek 类 API 接入预留
│
└─ 内容与文件
   ├─ 图片上传
   ├─ 视频上传
   ├─ 文档上传
   └─ Supabase Storage 存储
```

---

## 4. 总体技术架构

```text
用户浏览器
  │
  ▼
SvelteKit Dashboard App
  │
  ├─ 页面渲染 / 路由 / 教师端 / 学生端
  ├─ 考试交互 / 课程学习 / 文件上传 UI
  └─ Server Routes 处理关键业务 API
       │
       ▼
Supabase
  ├─ PostgreSQL 数据库
  ├─ Auth 用户认证
  ├─ Storage 文件存储
  └─ Service Role 服务端权限操作

后台长任务 / API 扩展
  │
  ▼
Hono API App
  ├─ OpenAPI / RPC 类型
  ├─ 长流程服务
  ├─ 邮件 / 集成 / AI 扩展能力
  └─ 可扩展到 Cloudflare Workers

部署层
  │
  ▼
Railway + Docker
  ├─ Dockerfile.dashboard 构建
  ├─ Node 20 Runtime
  ├─ 环境变量管理
  └─ 生产健康检查
```

---

## 5. Monorepo 工程结构

| 路径 | 作用 |
|---|---|
| `apps/dashboard` | 主 Web 应用，教师端、学生端、登录页、考试系统 |
| `apps/api` | 后端 API 扩展服务，长任务、OpenAPI、集成能力 |
| `packages/shared` | 共享代码、通用类型或工具 |
| `packages/tsconfig` | TypeScript 配置包 |
| `supabase` | 数据库迁移、Supabase 配置、本地开发数据 |
| `docker` | Docker 构建文件 |
| `cypress` | 端到端测试配置 |
| `public` | 静态资源 |
| `ai` | AI 相关资料或功能草稿 |
| `docs-delivery` | 交付文档 |

---

## 6. 前端技术栈

| 技术 | 用途 |
|---|---|
| SvelteKit | 主应用框架，页面路由与 SSR |
| Svelte 4 | UI 组件开发 |
| Vite | 前端构建工具 |
| Tailwind CSS | 页面样式与响应式布局 |
| Carbon Components Svelte | 部分基础 UI 组件 |
| Carbon Icons Svelte | 图标系统 |
| D3 | 数据可视化、图形能力 |
| Svelte i18n | 多语言文本管理 |
| DOMPurify | HTML 内容安全清洗 |
| jsPDF / html-to-image | 证书、报告、图片导出能力 |

---

## 7. 后端与 API 技术栈

| 技术 | 用途 |
|---|---|
| SvelteKit Server Routes | Dashboard 内部业务 API |
| Hono | 独立 API 服务与扩展后端 |
| TypeScript | 全栈类型约束 |
| Zod | 请求参数校验 |
| OpenAPI / Scalar | API 文档与接口描述 |
| Supabase JS SDK | 数据库、认证、Storage 调用 |
| Nodemailer / ZeptoMail | 邮件通知能力 |
| AWS S3 SDK | 后续兼容外部对象存储 |
| Redis / ioredis | 后续缓存或队列扩展能力 |

---

## 8. 数据库与存储

平台当前主要使用 Supabase：

| 能力 | 技术 |
|---|---|
| 数据库 | Supabase PostgreSQL |
| 用户认证 | Supabase Auth |
| 文件存储 | Supabase Storage |
| 服务端高权限操作 | Supabase Service Role |
| 题目/选项图片元数据 | `option.metadata jsonb` |

主要业务数据包括：

- 用户与组织
- 课程与课时
- 班级与成员
- 题库、题目、选项
- 考试发布规则
- 学生考试尝试
- 答案提交
- 成绩与证书
- 图片、视频、文档文件路径

---

## 9. 考试系统闭环

```text
教师创建考试
  │
  ├─ 添加题目
  ├─ 添加选项
  ├─ 上传题目图片 / 选项图片
  ├─ 设置考试时间、次数、结果展示规则
  └─ 发布考试

学生参加考试
  │
  ├─ 进入课程
  ├─ 打开考试
  ├─ 开始尝试
  ├─ 作答
  └─ 提交答案

系统处理
  │
  ├─ 服务端重新读取题目
  ├─ 自动评分客观题
  ├─ 主观题进入教师复核
  ├─ 保存 submission / answer
  └─ 更新成绩状态

教师复核
  │
  ├─ 查看学生提交
  ├─ 修改主观题分数
  └─ 发布或查看成绩
```

---

## 10. 文件上传与多媒体

当前平台文件上传主要走 Supabase Storage。

支持方向：

- 课程图片
- 课程视频
- 题目图片
- 选项图片
- 文档附件
- 后续可扩展到 S3 / Cloudflare R2 / Backblaze B2 等对象存储

推荐第五版优化方向：

- 文件大小限制策略
- 文件类型白名单
- 上传进度条
- 图片压缩与尺寸控制
- 视频转码或外部视频服务接入
- Storage 成本与容量监控

---

## 11. AI 学习能力规划

第五版可继续建设 AI 学习模块：

| 模块 | 说明 |
|---|---|
| 数学问答 | 面向香港中小学生的数学题解析 |
| 语文问答 | 阅读理解、写作、语言知识辅助 |
| 苏格拉底式引导 | 通过问题一步步引导学生思考 |
| 直接答案模式 | 学生可选择直接生成完整答案 |
| 教师端配置 | 教师可控制课程内 AI 使用方式 |
| 学生端使用 | 学生可在课程或练习中调用 AI |

AI API 可接入 Kimi、DeepSeek、OpenAI 或其他模型服务。

---

## 12. 部署架构

| 层级 | 当前方案 |
|---|---|
| 源码管理 | GitHub |
| 本地开发 | Windows + PowerShell |
| 包管理 | pnpm |
| Monorepo 构建 | Turborepo |
| 容器构建 | Docker |
| 线上部署 | Railway |
| 数据库 | Supabase |
| 文件存储 | Supabase Storage |
| 线上健康检查 | Railway `/` healthcheck |

生产部署流程：

```text
本地开发
  → 本地 build/test
  → Git commit
  → GitHub push
  → Railway Docker build
  → Railway deploy
  → 线上 healthcheck
  → 浏览器验收
```

---

## 13. 质量保障体系

| 类型 | 工具 / 方法 |
|---|---|
| 本地构建 | `pnpm --filter @cio/dashboard build` |
| API 构建 | `pnpm --filter @cio/api build` |
| 端到端测试 | Cypress / Playwright |
| 单元测试 | Jest / Vitest |
| 类型检查 | TypeScript |
| 代码规范 | ESLint / Prettier |
| 部署检查 | Railway logs / healthcheck |
| 人工验收 | 教师端 + 学生端真实账号流程 |
| AI 审查 | Claude / Hermes review 日志 |

---

## 14. 安全与权限重点

核心安全边界：

- 教师只能管理自己组织/课程下的数据
- 学生只能访问已加入课程和已发布考试
- 考试答案不能提前泄露
- 学生提交必须由服务端重新校验
- 图片/视频上传必须校验类型与权限
- Service Role 只能在服务端使用
- 生产密钥只放 Railway / Supabase 环境变量

需要特别避免：

```text
supabase db push --include-all
```

该命令可能重放历史迁移，导致生产数据库函数冲突。

---

## 15. 第四版已完成重点

- 登录前首页香港地图视觉改造
- 香港 18 区标注与 Cyberport 高亮
- 考试提交失败问题修复
- 学生端考试空白页问题修复
- 教师端题目/选项图片能力上线
- 证书品牌从 ClassroomIO 调整为 Ailaeclass
- Supabase `option.metadata` 字段确认上线
- Railway 第四版最终部署成功
- 第四版冻结为 `v4.0-final`

---

## 16. 第五版开发起点

第五版必须从第四版稳定基线开始：

```text
v4.0-final
  ↓
v5-development
```

第五版建议优先方向：

1. 考试系统稳定性继续增强
2. 图片/视频上传体验优化
3. AI 学习模块正式上线
4. 教师端成绩分析与数据看板
5. 学生端学习路径与证书体验升级
6. Supabase Storage 成本与容量策略
7. 更完整的端到端测试体系

---

## 17. 面向 PPT 的一句话总结

Ailaeclass 是一个基于 SvelteKit、Hono、Supabase、Railway 和 Docker 构建的全栈在线教学平台，已经具备课程、考试、教师端、学生端、文件上传、证书和 AI 学习扩展能力；第四版已冻结上线，第五版将在稳定基线上继续产品化升级。

