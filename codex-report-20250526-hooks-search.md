# Codex 报告：学生搜索课程码返回 "Course not found" 修复

## 日期
2026-05-26

## 问题现象
学生端在 `/join-course` 页面输入正确的课程码后，点击搜索，前端显示 "Course not found. Please check the code and try again."。但数据库中该课程的 `join_code` 确实存在。

## 根因分析
1. 最初怀疑是 PostgREST schema cache 问题，因此把 `search/+server.ts` 改为 `select('*')` + JS 过滤。
2. 但问题仍未解决。重新检查 `hooks.server.ts` 后发现：**`/api/courses/search` 不在 `PUBLIC_API_ROUTES` 列表中**。
3. 学生未登录时，请求不带 `Authorization` header。`hooks.server.ts` 对所有 `/api/*` 路由（除白名单外）都会校验 token，校验失败后直接返回 **401**，`search/+server.ts` 根本没有机会执行。

## 修改内容

### 文件：`apps/dashboard/src/hooks.server.ts`
- 在 `PUBLIC_API_ROUTES` 数组中添加 `'/api/courses/search'`。
- 这样学生无需登录即可调用课程搜索接口。

```typescript
const PUBLIC_API_ROUTES = [
  '/api/completion',
  'student_prove_payment',
  'teacher_student_buycourse',
  '/api/polar',
  '/api/lmz',
  '/api/verify',
  '/api/chat',
  '/api/courses/search'  // <-- 新增
];
```

### 文件：`apps/dashboard/src/routes/api/courses/search/+server.ts`
- 保持现有 `select('*')` + JS 过滤逻辑（已在前一次修改中完成）。
- 该接口本身已设计为公开（无鉴权），但需要 `hooks.server.ts` 的配合才能真正放行。

## 验证结果
- Docker 镜像重新构建成功（`ailaeclass/dashboard:latest`）。
- 容器已重启并正常运行（`Up` 状态，端口 3082）。
- 用 `curl` 测试无 Authorization header 的请求：
  ```bash
  curl -s -o /dev/null -w "%{http_code}" "http://localhost:3082/api/courses/search?code=TEST"
  # 返回 404（业务逻辑：课程码不存在），而非 401（认证失败）
  ```
- 证明 `hooks.server.ts` 已成功放行 `/api/courses/search`。

## 下一步
- 在浏览器中端到端测试：学生端输入真实课程码，应能正确搜索到课程并显示申请加入按钮。
- 教师端审批流程（People 页面通过/拒绝申请）已在之前的修改中完成，可一并验证。
