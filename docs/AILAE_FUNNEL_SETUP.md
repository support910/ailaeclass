# AiLAE Funnel - CAAC-M 150Kg 课程漏斗

## 这次建立了什么

AiLAE Funnel 是 AiLAEClass 内的新全栈模块，用来替代课程项目原来分散在 ClickFunnels 与 ActiveCampaign 的工作：

1. 销售漏斗页面与多语言内容
2. 免费电子书换取客户资料
3. 客户来源、阶段、分数与活动记录
4. Calendly 预约
5. Stripe 信用卡与 FPS 付款入口
6. 自动跟进流程定义
7. 拖放式页面编辑器

## 采用的开源方案

- 页面与服务器：沿用 AiLAEClass 的 SvelteKit。
- 数据库与身份：沿用 Supabase PostgreSQL 与 Auth。
- 页面编辑器：GrapesJS 0.23.3，BSD 3-Clause 开源许可。
- 自动化设计：参考 Mautic 的 Trigger / Condition / Action Campaign Builder 概念，不直接引入另一套 PHP 系统。

官方资料：

- GrapesJS: https://grapesjs.com/docs/
- Mautic Campaigns: https://docs.mautic.org/en/7.1/campaigns/creating_campaigns.html
- Stripe Checkout Sessions: https://docs.stripe.com/api/checkout/sessions
- Calendly Embed: https://calendly.com/help/how-to-add-calendly-to-your-website

## 网站路径

### 对外销售漏斗

- `/f/caac-m-150kg`：课程销售页、免费电子书和三语切换
- `/f/caac-m-150kg/booking`：Calendly 预约
- `/f/caac-m-150kg/checkout`：Stripe / FPS 付款
- `/f/caac-m-150kg/thanks`：付款或报名后的下一步

### AiLAE 管理后台

- `/org/{机构网址名称}/funnels/caac-m-150kg`

后台包括总览、页面编辑、客户资料、自动跟进和整合设置。

## 后端 API

- `POST /api/funnels/caac-m-150kg/leads`：保存客户表单
- `POST /api/funnels/caac-m-150kg/events`：记录页面与漏斗事件
- `GET /api/funnels/caac-m-150kg/config`：返回不含密钥的公开配置状态
- `POST /api/funnels/caac-m-150kg/checkout`：建立 Stripe 或 FPS 订单
- `POST /api/funnels/stripe/webhook`：Stripe 完成付款通知
- `GET/PATCH /api/funnels/caac-m-150kg/studio`：管理后台读取和保存漏斗

## 数据库

在部署网站前执行：

`supabase/migrations/20260728090000_ailae_funnel_system.sql`

迁移会建立：

- `funnel_pages`
- `funnel_leads`
- `funnel_events`
- `funnel_campaigns`
- `funnel_orders`

## 正式环境设置

所有密钥只放在 Railway 或正式服务器环境变量，不要写入 Git：

```text
FUNNEL_CALENDLY_URL=https://calendly.com/团队/caac-consultation
FUNNEL_EBOOK_URL=https://正式电子书下载地址
FUNNEL_SUPPORT_WHATSAPP=852xxxxxxxx
FUNNEL_FPS_ID=正式FPS识别码
FUNNEL_FPS_ACCOUNT_NAME=收款账户名称

STRIPE_MODE=test
STRIPE_SECRET_KEY=服务器密钥
STRIPE_WEBHOOK_SECRET=Webhook签名密钥
STRIPE_EXPECTED_ACCOUNT_ID=Stripe账户ID
STRIPE_RETURN_URL=https://网站域名/f/caac-m-150kg/thanks
```

已经提供两份配置文件：

- `apps/dashboard/.env.local`：本机安全默认值，已连接内置预览电子书并保持 Stripe / FPS 演示模式。
- `apps/dashboard/config/funnel.env.example`：正式配置模板，只含字段名和示例，不含真实密钥。

填写后可以运行配置检查：

```powershell
npx --yes pnpm@8.15.9 --filter @cio/dashboard funnel:check
```

检查工具不会输出密钥，只显示各项是否完整。需要在自动部署中强制全部配置完成时，加上 `-- --strict`。
需要同时验证 Supabase 网络连接与漏斗数据表时，运行：

```powershell
npx --yes pnpm@8.15.9 --filter @cio/dashboard funnel:check -- --online
```

邮件自动跟进使用 `apps/api` 的 SMTP 配置：

```text
SMTP_HOST=邮件服务器地址
SMTP_PORT=465或587
SMTP_USER=登录账号
SMTP_PASSWORD=应用专用密码或SMTP密码
SMTP_SENDER=发件人名称和邮箱
```

Stripe Webhook 地址：

```text
https://网站域名/api/funnels/stripe/webhook
```

监听事件至少包括：

```text
checkout.session.completed
```

## 演示模式

没有 Stripe、FPS 或 Calendly 正式资料时：

- Stripe 不会收款，会跳转到演示确认页。
- FPS 会产生演示订单编号，但不会显示真实 FPS ID。
- Calendly 页面会清楚提示需要设置的变量。
- 本地开发会用内存保存客户和订单；重新启动服务器后演示资料会清空。

这可防止测试时误收真实款项。

## 正式发布前必须确认

- 课程时数、上课方式、地点和日期
- 报名资格、退款、取消和改期政策
- 考试日期、考试机构和正式牌照陈述依据
- 考试禁区考察团日期、集合点、名额、安全与保险安排
- 正式 PDF 电子书
- 私隐政策和营销跟进同意文字
- Stripe、FPS 和 Calendly 正式账号资料

## 本地验证

```powershell
npx --yes pnpm@8.15.9 --filter @cio/dashboard build
```

开发服务器启动后，依次检查：

1. 打开销售页。
2. 切换繁中、EN、简中。
3. 提交免费电子书表单。
4. 下载预览版 PDF。
5. 打开 Calendly 预约页。
6. 进入付款页，分别测试 Stripe 演示流程和 FPS 演示流程。
7. 登录机构后台，打开 Funnel Studio。
8. 检查总览、客户、自动化和设置。
9. 在页面编辑器拖放区块并保存。

## 预览电子书

网站内置预览版：

`apps/dashboard/static/funnel-assets/CAAC-M-150Kg-course-ebook-preview.pdf`

它明确标注为预览版，不应代替负责人审核后的正式课程电子书。
