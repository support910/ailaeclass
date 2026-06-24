# Codex / Hermes Worklog - v6 AI Tools

Date: 2026-06-23
Workspace: `E:\Class\ailaeclass-v6`
Branch: `v6-development`

## Roles

- Codex: supervisor, reviewer, final fixer, validator.
- Hermes: primary implementer for scoped coding phases.

## Hard Boundaries

- Work only in `E:\Class\ailaeclass-v6`.
- Do not edit v3 or v5.
- Do not change existing course, exam, auth, Supabase, Railway, or Docker behavior unless required by this AI tools feature.
- Do not expose API keys or secrets in documentation, logs, commits, or UI.
- Keep existing `AI工具` routes and sidebars; expand them instead of creating a separate product area.
- Student-facing tools must guide learning and avoid directly doing the entire homework where that harms learning.

## Current Objective

Build the first usable v6 AI tools release for Hong Kong students and teachers:

1. AI tools hub page for student and teacher/admin routes.
2. Shared backend AI provider layer using existing DeepSeek support and optional Kimi/Moonshot support.
3. First tool batch:
   - 生字句子练习器
   - 英文作文改进助手
   - 数学错题讲解卡
   - 阅读理解出题器
   - 科学概念图
4. Keep existing 苏格拉底式学习 helper available.

## Phase Plan

### Phase 0 - Project Recon

Status: Complete

Tasks:
- Confirm current AI routes, DeepSeek helper, translations, and UI patterns.
- Confirm build/test commands.

Acceptance:
- Files to edit are identified.
- No code changed except this worklog.

### Phase 1 - Shared AI Service

Status: Complete

Tasks:
- Add shared AI utility that can request structured JSON.
- Keep current DeepSeek helper compatible.
- Add optional Kimi/Moonshot helper with env-driven endpoint/model/key.
- Add robust JSON extraction and friendly error handling.

Acceptance:
- Existing Socratic endpoint still works.
- New AI endpoints can share the same helper.
- Missing Kimi key does not break DeepSeek tools.

### Phase 2 - API Endpoints

Status: Complete

Tasks:
- Add endpoints under `/api/ai-tools/*` for the five first-batch tools.
- Enforce auth, input length limits, and structured JSON responses.
- Prompts must fit classroom use and Hong Kong primary/junior-secondary learners.

Acceptance:
- Each endpoint returns stable JSON and a user-friendly error on failure.
- English writing tool must not rewrite the whole essay.
- Math tool must explain the mistaken step and generate one similar practice question.

### Phase 3 - Frontend Hub

Status: Complete

Tasks:
- Replace duplicated single-chat page with a reusable AI tools hub component.
- Render five tools plus existing step-by-step learning helper.
- Use structured UI, not raw Markdown, for generated outputs.
- Keep UI consistent with the current ailaeclass design.

Acceptance:
- Student route `/lms/ai-tools` works.
- Teacher/admin route `/org/[slug]/ai-tools` works.
- Results can be copied.
- No `**markdown**` artifacts are visible in normal rendered answers.

### Phase 4 - Codex Review and Fix

Status: Complete

Tasks:
- Inspect Hermes diff.
- Run type/build checks.
- Patch any bugs or UI problems.
- Verify role and route boundaries.

Acceptance:
- Build succeeds.
- Key API endpoints respond locally.
- No obvious regressions in existing navigation.

### Phase 5 - Docker Validation

Status: Complete

Tasks:
- Build v6 Docker dashboard image.
- Run v6 locally for user validation.
- Provide the exact URL.

Acceptance:
- Docker container is running.
- AI tools page opens in browser.
- User can test the feature.

## Hermes Log

| Time | Phase | Summary | Files Changed | Issues / Questions |
| --- | --- | --- | --- | --- |
| 2026-06-23 | 0 | Worklog created by Codex. | `CODEX_HERMES_V6_AI_TOOLS_WORKLOG.md` | None |
| 2026-06-23 | 1 | Shared AI provider utility with DeepSeek compat, optional Kimi/Moonshot, JSON extraction, friendly errors. | `apps/dashboard/src/lib/utils/services/ai/provider.server.ts`, `apps/dashboard/src/lib/utils/services/ai/deepseek.server.ts` | None |
| 2026-06-23 | 2 | Added 5 authenticated API endpoints with structured JSON prompts for HK students. | `apps/dashboard/src/routes/api/ai-tools/vocabulary-practice/+server.ts`, `english-writing-coach/+server.ts`, `math-error-card/+server.ts`, `reading-question-generator/+server.ts`, `science-concept-map/+server.ts` | None |
| 2026-06-23 | 3 | Replaced both route pages with reusable ToolHub component including structured result rendering, copy button, loading/error states. | `apps/dashboard/src/lib/components/AITools/ToolHub.svelte`, `CopyButton.svelte`, `apps/dashboard/src/routes/lms/ai-tools/+page.svelte`, `apps/dashboard/src/routes/org/[slug]/ai-tools/+page.svelte` | None |
| 2026-06-23 | 4 | Dashboard app builds successfully (`apps/dashboard` only). Full monorepo build blocked by pre-existing `ailaeclass-com` `PUBLIC_SERVER_URL` env error, not related to AI tools. | `CODEX_HERMES_V6_AI_TOOLS_WORKLOG.md` | `ailaeclass-com` build failure is pre-existing and unrelated. |

## Codex Review Log

| Time | Phase | Review Result | Fixes Needed |
| --- | --- | --- | --- |
| 2026-06-23 | 0 | Worklog established. | Continue with reconnaissance and Hermes handoff. |
| 2026-06-23 | 1-3 | Hermes diff reviewed and accepted after fixes. Dashboard build passed. | Codex added Kimi/Moonshot env fallback compatibility, Docker env passthrough, readable copy output, and removed an existing hardcoded DeepSeek fallback key from `/api/chat`. |
| 2026-06-23 | 4 | `pnpm --filter @cio/dashboard run build` passed twice. Warnings are pre-existing Svelte accessibility/unused-export warnings outside this AI tools feature. | Continue to Docker validation. |
| 2026-06-23 | 5 | Docker image `ailaeclass-v6/dashboard:local` built and container `ailaeclass-v6-dashboard` started on `http://localhost:4082`. Page checks returned 200 for `/`, `/lms/ai-tools`, and `/org/admin/ai-tools`. Authenticated API checks returned 200 for Socratic plus all five new AI tool endpoints. | Ready for user validation. |
| 2026-06-24 | AI module UI | Codex redesigned the AI area as a proper tool-center flow: hub cards first, click into a single tool page, and return button back to the hub. Added richer planned tool cards for Kimi photo math, knowledge-base QA, daily practice, learning summary, emotion journal, and story card. Fixed Kimi/Moonshot provider base URL to `/v1`. | `pnpm --filter @cio/dashboard run build` passed. Docker image rebuilt and `ailaeclass-v6-dashboard` restarted on `http://localhost:4082`; `/org/admin/ai-tools` and `/lms/ai-tools` returned 200. Kimi key input file is local-only at `E:\Class\_local_secrets\kimi_api_key.txt`. |
