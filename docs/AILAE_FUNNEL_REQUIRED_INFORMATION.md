# AiLAE Funnel 正式上线资料清单

这份清单只收集无法从代码自动生成、必须由课程负责人或外部服务账号提供的资料。
请勿把密码或密钥发送到公开群组；应直接填入 Railway Variables 或交给获授权的技术人员处理。

## 1. 课程与考试资料

- 正式课程名称（繁体中文、简体中文、英文）
- 课程总时数、每节时数、授课方式
- 上课地址或线上授课说明
- 开课日期、上课时间与名额
- 报名资格、年龄或经验要求
- 考试日期、地点、负责或认可机构
- “CAAC-M 150Kg”牌照及考试陈述的官方依据或说明书链接
- 通过标准、补考安排，以及哪些结果不能保证
- 退款、取消、改期、恶劣天气与最低开班人数政策

## 2. 价格与赠品

- 确认原价 HK$23,400
- 确认优惠价 HK$18,000
- 确认考察团价值 HK$1,800
- 优惠开始与结束日期
- 考试禁区考察团的日期、集合地点、名额、交通、安全及保险安排

## 3. 品牌与联络资料

- 公司或机构正式中英文名称
- Logo 原图（PNG / SVG）
- 客服 WhatsApp 号码（包含国家或地区码，例如 852xxxxxxxx）
- 客服 Email、办公电话和地址
- 私隐政策、条款及细则的正式文字或网页链接
- 发票或收据上需要显示的公司资料

## 4. Calendly

- 正式预约链接，例如 `https://calendly.com/team/caac-consultation`
- 预约时长、可预约时间、负责顾问
- 预约确认与提醒规则

对应变量：`FUNNEL_CALENDLY_URL`

## 5. FPS

- FPS ID（电话号码、Email 或 FPS 识别码）
- 收款账户正式名称
- FPS 收据由谁核对、核对后多久确认

对应变量：`FUNNEL_FPS_ID`、`FUNNEL_FPS_ACCOUNT_NAME`

## 6. Stripe

先提供测试模式资料，通过测试后再换正式模式：

- Secret key：`sk_test_...`，正式环境为 `sk_live_...`
- Webhook signing secret：`whsec_...`
- Stripe Account ID：`acct_...`
- 正式网站域名

对应变量：`STRIPE_MODE`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、
`STRIPE_EXPECTED_ACCOUNT_ID`、`STRIPE_RETURN_URL`

Webhook 地址：

`https://正式网站域名/api/funnels/stripe/webhook`

至少监听事件：

`checkout.session.completed`

## 7. 邮件自动跟进

- SMTP Host、Port
- SMTP 登录账号
- SMTP 应用专用密码
- 发件人名称与发件邮箱
- 收件回复地址
- 电子书发送、预约确认、预约提醒、未完成付款提醒的三语邮件内容

对应变量：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_SENDER`

## 8. 正式数据库与部署

- Supabase 项目 URL
- Supabase anon key
- Supabase service role key
- Railway 项目访问权或由管理员填写环境变量
- 正式域名及 DNS 管理权

对应变量：`PUBLIC_SUPABASE_URL`、`PUBLIC_SUPABASE_ANON_KEY`、
`PRIVATE_SUPABASE_SERVICE_ROLE`

部署数据库前需要执行：

`supabase/migrations/20260728090000_ailae_funnel_system.sql`

## 9. 正式电子书

- 审核完成的 PDF 文件
- 封面、版本日期、版权页
- 三语是否分别提供，或只提供一种语言
- PDF 下载是否公开，或必须提交表单后才能下载

当前本地版本使用预览文件：

`apps/dashboard/static/funnel-assets/CAAC-M-150Kg-course-ebook-preview.pdf`
