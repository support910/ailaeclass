# ailaeclass — AI Handoff Document
**Date:** 2026-05-21
**Project:** 5G nuMultiMedia Learning Platform (based on ailaeclass)
**Repository:** `https://github.com/s1161858/ailaeclass.git`

---

## 1. Project Overview

ailaeclass is a rebranded, self-hosted LMS for **5G nuMultiMedia Limited (5GNU)**.

- **Frontend:** SvelteKit 1.x + TypeScript (apps/dashboard)
- **Backend API:** Hono 4.x (apps/api) — **currently unused for uploads**
- **Database/Auth/Storage:** Supabase (PostgreSQL + Auth + Storage)
- **AI Chatbot:** DeepSeek API (`deepseek-chat`) via SvelteKit server route
- **Build:** pnpm + Turborepo monorepo
- **Runtime:** Node 20 Alpine (Docker)

### Domains
- **Production (Railway):** `ailaeclass-production.up.railway.app`
- **Custom Domain (intended):** `ailaeclass.5gnumultimedia.com`
- **Root domain (WordPress, must NOT touch):** `5gnumultimedia.com`

---

## 2. What Works Right Now

| Feature | Status | Notes |
|---------|--------|-------|
| Docker local build | ✅ | `docker build -f docker/Dockerfile.dashboard -t ailaeclass/dashboard:local .` |
| Local container run | ✅ | `http://localhost:3082` |
| Railway deployment | ✅ | Dashboard builds and deploys successfully |
| User registration/login | ⚠️ | Auth UI works; database schema may be incomplete on new Supabase project |
| Document upload (PDF/DOCX/DOC/PPT/PPTX) | ✅ | 50MB limit, Supabase Storage signed URLs |
| Video upload (MP4/MOV/AVI/MKV) | ✅ | 500MB limit, migrated to local SvelteKit routes |
| Chinese filenames | ✅ | `sanitizeFileName()` strips non-ASCII for Supabase keys |
| Dashboard homepage | ✅ | Custom hero + HK map + stats + original analytics |
| AI Chatbot | ✅ | Floating widget, DeepSeek proxy, scoped to 5GNU topics |
| Email verification | ✅ | Disabled (forced `is_email_verified: true`) |
| Translations (12 languages) | ✅ | Updated for rebrand and upload features |

---

## 3. Architecture Changes Made

### 3.1 Upload System (Migrated from external API to local routes)

**Before:** Document/video uploads relied on `apps/api` Cloudflare R2 pipeline via `ailaeclass` RPC client. Required `PUBLIC_SERVER_URL`.

**After:** Uploads use SvelteKit server routes inside `apps/dashboard`, proxying to Supabase Storage.

```
Frontend Svelte Component
  → presign.ts (DocumentUploader / VideoUploader)
    → POST /api/documents/presign/upload  or  /api/videos/presign/upload
      → hooks.server.ts (auth validation)
        → +server.ts (Supabase signed URL generation)
          → Supabase Storage (direct upload)
```

**New/Modified Files:**
- `apps/dashboard/src/lib/utils/constants/documentUpload.ts` — bucket name, MIME types, 50MB limit
- `apps/dashboard/src/lib/utils/constants/videoUpload.ts` — bucket name, MIME types, 500MB limit
- `apps/dashboard/src/routes/api/documents/presign/upload/+server.ts`
- `apps/dashboard/src/routes/api/documents/presign/download/+server.ts`
- `apps/dashboard/src/routes/api/videos/presign/upload/+server.ts`
- `apps/dashboard/src/routes/api/videos/presign/download/+server.ts`
- `apps/dashboard/src/lib/utils/services/courses/presign.ts` — `DocumentUploader` and `VideoUploader` classes
- `apps/dashboard/src/hooks.server.ts` — auth parsing (accepts `Bearer <token>` and raw `<token>`)

### 3.2 Branding & UI

- **Rebrand:** ailaeclass → ailaeclass
- **Colors:** `#0E7372` (teal) + `#00D4FF` (cyan accent)
- **Dashboard Hero:** Tech-themed dark gradient, company badges, HK SVG map with markers, stats bar
- **Chatbot:** Floating bottom-right widget, gradient header matching brand, strict 5GNU topic scope

**Key Files:**
- `apps/dashboard/src/lib/utils/config/brand.ts`
- `apps/dashboard/src/routes/org/[slug]/+page.svelte`
- `apps/dashboard/src/lib/components/Chatbot/ChatbotWidget.svelte`
- `apps/dashboard/src/routes/api/chat/+server.ts`

### 3.5 Student Exam Flow Fixes (2026-05-26 Session)

A cluster of student-side exam bugs was fixed in a single session. All fixes are deployed.

#### 3.5.1 Exam Loading Failed (`加载考试失败`)

**Root causes:**
1. `fetchStudentExam` API used deeply nested PostgREST query `questions:question(...options:option(...))`. When Supabase schema cache missed the FK relationship, the entire query failed with PGRST200.
2. The `question` and `option` tables do **not** have `deleted_at` columns, but the API was selecting/filtering them, causing Supabase column-not-found errors.

**Fix:**
- `apps/dashboard/src/routes/api/exams/[examId]/+server.ts`
- Split into 3 sequential queries: `exercise` → `question` → `option`, then merge in JS.
- Removed ALL `deleted_at` references from exam API routes (`+server.ts`, `submit/+server.ts`, `submissions/[submissionId]/+server.ts`).

#### 3.5.2 Blank Page After Clicking Exam

**Root causes:**
1. `loadExam()` could throw an uncaught exception, leaving `isLoading = true` forever → no render path matched.
2. `hasGroupLoaded` relied on `$group.people.length > 0`, but if `$profile.id` resolved late, the reactive block never set `hasGroupLoaded = true`.

**Fix:**
- `apps/dashboard/src/routes/courses/[id]/exams/[examId]/+page.svelte`
- Wrapped `loadExam()` in `try-catch-finally` to guarantee `isLoading = false`.
- Added fallback reactive: if `!isLoading && exam && !hasGroupLoaded`, force `hasGroupLoaded = true`.
- Added `{:else}` render block with debug info (`isLoading`, `loadError`, `hasGroupLoaded`, `canAccess`) so the page is never truly blank.

#### 3.5.3 Returning from Course Goes to Teacher Side

**Root cause:** `Navigation/app.svelte` computed `coursesPath` using `$globalStore.isStudent !== false`. Before `CourseContainer` resolved membership, `isStudent` was `undefined`, so the condition evaluated to `true` (student path). But once `CourseContainer` ran, it sometimes left `isStudent` as `undefined` if `$profile.id` hadn't loaded, and subsequent navigation used the teacher path `${$currentOrgPath}/courses`.

**Fix:**
- `apps/dashboard/src/lib/components/CourseContainer/index.svelte`
  - On course change, call `supabase.auth.getUser()` to get the current user ID **immediately** (no network delay).
  - Search the API-returned `group.members` for the matching `profile_id` and set `$globalStore.isStudent` right away.
  - Added `membershipResolved` flag; slot content only renders after membership is known.
- `apps/dashboard/src/lib/components/Navigation/app.svelte`
  - `coursesPath` uses `isStudent !== false` for student, else teacher path.

#### 3.5.4 Student Exam List Shows Teacher Buttons (编辑 / 提交记录)

**Root cause:** `$globalStore.isStudent` was `undefined` during initial render. `{#if !$globalStore.isStudent}` evaluated to `true` when `isStudent === undefined`, so the student saw the teacher-only "Edit" and "Submissions" buttons.

**Fix:**
- `apps/dashboard/src/routes/courses/[id]/exams/+page.svelte`
  - Changed `{#if !$globalStore.isStudent}` → `{#if $globalStore.isStudent === false}`
  - Changed button label condition `$globalStore.isStudent` → `$globalStore.isStudent === true`
- `apps/dashboard/src/routes/courses/[id]/exams/[examId]/+page.svelte`
  - `canAccess` now allows `isPreview` (API-verified) to bypass the `$isOrgTeacher` store check.
- Added i18n key `course.loading_membership` to `en.json` and `zh.json`.

#### 3.5.5 Navigation Regex for UUIDs

**Root cause:** `isCoursesPage()`, `isCoursePage()`, `isOrgPage()` regexes used `[a-z 0-9 -]`, which failed for uppercase letters in UUIDs (A-F). This caused `OrgNavigation` to not render on some exam pages.

**Fix:**
- `apps/dashboard/src/lib/utils/functions/app.js`
  - Changed regex character classes to `[a-zA-Z0-9 _-]`.

#### Files Modified in This Session
- `apps/dashboard/src/lib/components/CourseContainer/index.svelte`
- `apps/dashboard/src/routes/courses/[id]/exams/+page.svelte`
- `apps/dashboard/src/routes/courses/[id]/exams/[examId]/+page.svelte`
- `apps/dashboard/src/lib/components/Navigation/app.svelte`
- `apps/dashboard/src/lib/utils/functions/app.js`
- `apps/dashboard/src/routes/api/exams/[examId]/+server.ts`
- `apps/dashboard/src/routes/api/exams/[examId]/submit/+server.ts`
- `apps/dashboard/src/routes/api/exams/[examId]/submissions/[submissionId]/+server.ts`
- `apps/dashboard/src/lib/utils/translations/en.json`
- `apps/dashboard/src/lib/utils/translations/zh.json`

### 3.4 Exam System (4 Phases Completed)

A full exam/assessment system was built on top of the existing `exercise`/`question`/`option`/`submission` tables, distinguished by `assessment_type='exam'`.

**Teacher Side:**
- Exam list page at `/org/[slug]/exams` (create, view status)
- Exam editor at `/org/[slug]/exams/[id]/edit` (settings, questions, publish/unpublish)
- Supports RADIO, CHECKBOX, TEXTAREA, and TRUE_FALSE (UI-only, stored as RADIO)
- Settings: duration, attempts, passing score, shuffle, availability window, show-result policy

**Student Side:**
- Exam route at `/courses/[id]/exams/[examId]`
- Intro page showing exam info, rules, attempts remaining
- Runner with timer, one-question-at-a-time navigation, review screen
- Auto-submit on timer expiry
- Result page with score, pass/fail, answer review
- Objective questions (RADIO/CHECKBOX/TRUE_FALSE) auto-scored; TEXTAREA requires manual grading

**Phase 4 Self-Review Hardening (2026-05-21):**
A 9-point security and reliability audit was performed on the student exam flow:

1. **Permission reliability** — Added `hasGroupLoaded` reactive guard to prevent "access denied" flash before `CourseContainer` finishes loading group membership.
2. **Availability strict enforcement** — Both `fetchStudentExam` and `startExamAttempt` enforce `published_at`, `available_from`, and `available_until` server-side. Client-side checks remain as UX pre-validation.
3. **Attempts limit server-side** — `startExamAttempt` counts existing submissions server-side and rejects if `attempts_allowed` is reached. Page refresh cannot bypass this.
4. **Timestamp integrity** — `started_at` is written once on attempt creation. `submitted_at` is written exactly once by `submitExamAttempt`. `expires_at` is derived from `started_at + duration_minutes` and stored on the submission row.
5. **Objective scoring correctness** —
   - RADIO/TRUE_FALSE: exact match of single selected option to `is_correct` option = full points.
   - CHECKBOX: exact match of all selected options to all `is_correct` options (all-or-nothing) = full points.
   - TEXTAREA: `auto_score = 0`, requires manual grading (`status_id = 3` only after teacher grades).
6. **UI state loss prevention** — `submitExamAttempt` iterates over ALL questions (not just answered ones), creating empty `question_answer` rows for unanswered questions. On network failure, the runner remains open and answers are preserved in local state.
7. **Timer expiry stability** — Runner tracks `isExpired` state; when timer reaches zero, it auto-submits current answers, clears the interval, and disables all interactions via `disabled={isExpired}` bindings.
8. **Result policy leak prevention** — `fetchStudentExam` strips `is_correct` from all options before returning data to the client. `shouldShowResult()` gates the `result` vs `hidden_result` view based on `show_result_policy` (`immediately`, `after_grade`, `after_due_date`, `manual`).
9. **Build verification** — `pnpm --filter @cio/dashboard build` passes successfully after all changes.

**Key Files:**
- `apps/dashboard/src/lib/utils/services/courses/index.ts` — exam service functions (create, update, fetch, publish, student flow)
- `apps/dashboard/src/lib/components/Exam/ExamEditor.svelte`
- `apps/dashboard/src/lib/components/Exam/ExamSettingsPanel.svelte`
- `apps/dashboard/src/lib/components/Exam/ExamQuestionEditor.svelte`
- `apps/dashboard/src/lib/components/Exam/NewExamModal.svelte`
- `apps/dashboard/src/lib/components/Exam/StudentExamIntro.svelte`
- `apps/dashboard/src/lib/components/Exam/StudentExamRunner.svelte`
- `apps/dashboard/src/lib/components/Exam/StudentExamResult.svelte`
- `apps/dashboard/src/routes/org/[slug]/exams/+page.svelte`
- `apps/dashboard/src/routes/org/[slug]/exams/[id]/edit/+page.svelte`
- `apps/dashboard/src/routes/courses/[id]/exams/[examId]/+page.svelte`
- `apps/dashboard/src/lib/utils/translations/en.json / zh.json / zh-TW.json`

### 3.3 Docker Build

**File:** `docker/Dockerfile.dashboard`

Critical fixes applied:
- `apk add python3 make g++` for native modules
- `npm install -g pnpm@8.15.9` (avoids corepack Node 20 crash)
- `pnpm install --ignore-scripts` (skips `@sentry/profiling-node` compilation)
- Build-time `ARG` pattern for Railway env injection (no hardcoded secrets in committed code)
- `NODE_OPTIONS="--max-old-space-size=3072"` for memory-constrained builds

**File:** `docker/docker-compose.yaml`
- Updated to include `PRIVATE_DEEPSEEK_API_KEY`
- Still references external `api` service (not currently used for uploads)

---

## 4. Environment Variables

### Where secrets live (DO NOT commit real values)
- `apps/dashboard/.env` — local development secrets
- `docker/Dockerfile.dashboard` — uses `ARG` (values injected at build time by Railway)
- Railway Dashboard — production environment variables

### Required Variables

| Variable | Purpose | Build-time | Runtime |
|----------|---------|------------|---------|
| `PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ | ✅ |
| `PUBLIC_SUPABASE_ANON_KEY` | Public Supabase key | ✅ | ✅ |
| `PRIVATE_SUPABASE_SERVICE_ROLE` | Server-side Supabase admin key | ✅ | ✅ |
| `PRIVATE_DEEPSEEK_API_KEY` | DeepSeek API key for chatbot | ✅ | ✅ |
| `PRIVATE_APP_HOST` | Root domain (`5gnu.com`) | ✅ | ✅ |
| `PRIVATE_APP_SUBDOMAINS` | Subdomain prefix (`app`) | ✅ | ✅ |
| `PUBLIC_IS_SELFHOSTED` | Enables self-hosted features | ✅ | ✅ |
| `PUBLIC_SINGLE_ORG_SITE_NAME` | Disable single-org mode (empty) | ✅ | ❌ |

**Note:** `PUBLIC_SERVER_URL` is now **empty/unused** because uploads were migrated to local routes.

### Node 20 Compatibility
- `ws` polyfill injected in `supabase.ts` and `supabase.server.ts` for Supabase Realtime on Node 20.

---

## 5. Pending Tasks (Critical)

### 5.1 Supabase New Project Initialization ⚠️ HIGH PRIORITY

A new Supabase project was created but the schema has **not been successfully applied**.

**File:** `supabase/init-schema.sql`
- This merges all 38 original migration files into one SQL script.
- **Issue:** Last execution failed with `apps_poll_option_id_seq already exists` (duplicate sequence from cleanup block).
- **Action needed:** Review the cleanup block at the top of `init-schema.sql`. The `DROP SEQUENCE` loop may not be catching all sequences before `CREATE SEQUENCE` runs. Consider using `DROP SEQUENCE IF EXISTS` on each individual sequence, or execute in a completely fresh Supabase project.

**After schema is applied, verify:**
- Tables exist (`profile`, `organization`, `course`, `lesson`, etc.)
- Auth email templates are configured (or use magic links)
- Row Level Security (RLS) policies are active

### 5.2 Supabase Storage Buckets ⚠️ HIGH PRIORITY

The upload endpoints auto-create buckets, but **bucket policies and public access** must be verified manually:

1. Go to Supabase Dashboard → Storage
2. Create/verify buckets:
   - `documents` — for lesson document uploads
   - `videos` — for lesson video uploads
3. Set `file_size_limit`:
   - `documents`: 52428800 (50MB)
   - `videos`: 524288000 (500MB)
4. Ensure buckets are **private** (upload/download goes through signed URLs)

### 5.3 WordPress Root Domain Restoration ⚠️ HIGH PRIORITY

`5gnumultimedia.com` is a live WordPress site and must remain untouched. The Railway deployment must **only** use the subdomain.

**What was done:**
- `.htaccess` on the shared host was restored to WordPress defaults.

**What still needs verification:**
- DNS records: Ensure only `ailaeclass.5gnumultimedia.com` (CNAME) points to Railway. Remove any A/AAAA/CNAME records for the root domain `5gnumultimedia.com` that point to Railway.
- If the domain registrar/CDN (e.g., Cloudflare) has proxy rules for the root domain, ensure they serve the original WordPress host, not Railway.

### 5.4 Full Application Testing

Once Supabase schema + buckets are ready:
- [ ] Register a new user
- [ ] Create an organization
- [ ] Create a course
- [ ] Add a lesson
- [ ] Upload a PDF document (>5MB)
- [ ] Upload a PPTX file
- [ ] Upload a video file (MP4)
- [ ] Upload a file with Chinese filename
- [ ] Verify chatbot responds correctly to 5GNU topics
- [ ] Verify chatbot rejects off-topic questions
- [ ] Verify no email verification modal appears

---

## 6. Known Issues & Solutions

| Issue | Cause | Fix Location |
|-------|-------|--------------|
| `Unauthenticated user` on upload | `hooks.server.ts` expected `Bearer ` prefix | `apps/dashboard/src/hooks.server.ts` — now accepts both formats |
| `Invalid key` on Chinese filenames | Supabase Storage keys must be ASCII-only | `sanitizeFileName()` in upload endpoints — strips non-ASCII |
| Video upload button disabled | Required `PUBLIC_SERVER_URL` which was empty | Migrated to local API routes; removed `PUBLIC_SERVER_URL` dependency |
| Docker build `@sentry/profiling-node` failure | Native compilation fails in Alpine | `pnpm install --ignore-scripts` in Dockerfile |
| `Lockfile not compatible` / corepack crash | Node 20 corepack pnpm version mismatch | `npm install -g pnpm@8.15.9` in Dockerfile |
| Supabase realtime `ws` error | Node 20 lacks native WebSocket | `ws` polyfill injected in `supabase.ts` and `supabase.server.ts` |
| Student sees "加载考试失败" | PostgREST schema cache missed FK relationships; `deleted_at` column doesn't exist on `question`/`option` tables | `apps/dashboard/src/routes/api/exams/[examId]/+server.ts` — split nested queries into sequential queries; removed `deleted_at` references |
| Student clicks exam → blank page | `loadExam` could throw before `isLoading = false`; `hasGroupLoaded` stayed false if `$profile.id` was delayed | `apps/dashboard/src/routes/courses/[id]/exams/[examId]/+page.svelte` — added try-catch-finally, fallback reactive declarations, and `{:else}` render block with debug info |
| Student returning from course goes to teacher side | `Navigation/app.svelte` used `$globalStore.isStudent` before `CourseContainer` resolved membership; `undefined` was treated as truthy for teacher paths | `apps/dashboard/src/lib/components/Navigation/app.svelte` + `CourseContainer/index.svelte` — use `supabase.auth.getUser()` for immediate ID resolution; reset `isStudent` on course change; `isStudent !== false` for path calc |
| Student sees "编辑" / "提交记录" buttons on exam list | `$globalStore.isStudent === undefined` evaluated as `!$globalStore.isStudent === true`, rendering teacher buttons | `apps/dashboard/src/routes/courses/[id]/exams/+page.svelte` + `CourseContainer/index.svelte` — strict `=== true / === false` checks; resolve membership immediately in `onCourseIdChange` |
| Course stuck on `Loading course membership...` after student exam/navigation fixes | `CourseContainer` gates all slot content on `membershipResolved`; if `fetchCourseFromAPI` returns null/error or the extra frontend `supabase.auth.getUser()` membership step fails after `setCourse()`, `membershipResolved` never becomes true and `$course.id === courseId` prevents retry | Fix `CourseContainer` state machine: do not do frontend second auth lookup; have `/api/courses/data` return a `viewer` object from `checkUserCoursePermissions`; show real errors instead of infinite membership loading |
| Teacher side still stuck on `Loading course membership...` after viewer patch | `/api/courses/data/+server.ts` returns `viewer.isOrgAdmin` but does not define/destructure `isOrgAdmin`, causing a `ReferenceError` and 500 on the success path; `fetchCourseFromAPI()` does not check `response.ok`, and `CourseContainer` can hide the real error behind the permission modal/loading fallback | Fix `/api/courses/data` to destructure/compute `isOrgAdmin`; make `fetchCourseFromAPI()` parse errors safely with `HTTP ${status}: ${message}`; change `CourseContainer` modal to not open when `courseLoadError` exists; remove or guard frontend membership fallback so server `viewer` is authoritative |
| Teacher saves exam questions but student sees no questions | New exam question IDs are temporary strings, while `api/exercises/[id]/+server.ts` only treats empty or `new_` IDs as new; invalid UUID upserts fail, and `upsertExercise()` returns `[]`, which `ExamEditor` treats as success | Generate `new_` prefixed temporary IDs; make server `isNew()` treat any non-UUID as new; return real API errors instead of `[]`; fix TEXTAREA type mismatch (`TEXTAREA = 3`, not 5); add runner empty-question UI |
| Help link does not show support contact | Org and LMS sidebars already have Help rows, but they link back to org/LMS home | Replace Help link behavior with a small modal/popover showing `support@5gnumultimedia.com` and `mailto:support@5gnumultimedia.com`; add i18n keys under `support.*` |

---

## 7. File Index (Key Modified/Created Files)

### Upload & API
- `apps/dashboard/src/lib/utils/constants/documentUpload.ts`
- `apps/dashboard/src/lib/utils/constants/videoUpload.ts`
- `apps/dashboard/src/routes/api/documents/presign/upload/+server.ts`
- `apps/dashboard/src/routes/api/documents/presign/download/+server.ts`
- `apps/dashboard/src/routes/api/videos/presign/upload/+server.ts`
- `apps/dashboard/src/routes/api/videos/presign/download/+server.ts`
- `apps/dashboard/src/lib/utils/services/courses/presign.ts`
- `apps/dashboard/src/hooks.server.ts`

### UI & Branding
- `apps/dashboard/src/lib/utils/config/brand.ts`
- `apps/dashboard/src/routes/org/[slug]/+page.svelte`
- `apps/dashboard/src/routes/+layout.svelte`
- `apps/dashboard/src/lib/components/Chatbot/ChatbotWidget.svelte`
- `apps/dashboard/src/routes/api/chat/+server.ts`

### Components
- `apps/dashboard/src/lib/components/Course/components/Lesson/Materials/Document/AddDocumentToLesson.svelte`
- `apps/dashboard/src/lib/components/Course/components/Lesson/Materials/Video/UploadVideo.svelte`

### Infrastructure
- `docker/Dockerfile.dashboard`
- `docker/docker-compose.yaml`
- `apps/dashboard/.env`
- `package.json`
- `supabase/init-schema.sql` (untracked, pending execution)

### Auth
- `apps/dashboard/src/lib/utils/functions/appSetup.ts`
- `apps/dashboard/src/lib/components/Org/VerifyEmail/VerifyEmailModal.svelte`

### Translations
- `apps/dashboard/src/lib/utils/translations/*.json` (12 languages updated)

### Exam System
- `apps/dashboard/src/lib/utils/services/courses/index.ts` — exam CRUD + student attempt services
- `apps/dashboard/src/lib/components/Exam/ExamEditor.svelte`
- `apps/dashboard/src/lib/components/Exam/ExamSettingsPanel.svelte`
- `apps/dashboard/src/lib/components/Exam/ExamQuestionEditor.svelte`
- `apps/dashboard/src/lib/components/Exam/NewExamModal.svelte`
- `apps/dashboard/src/lib/components/Exam/StudentExamIntro.svelte`
- `apps/dashboard/src/lib/components/Exam/StudentExamRunner.svelte`
- `apps/dashboard/src/lib/components/Exam/StudentExamResult.svelte`
- `apps/dashboard/src/routes/org/[slug]/exams/+page.svelte`
- `apps/dashboard/src/routes/org/[slug]/exams/[id]/edit/+page.svelte`
- `apps/dashboard/src/routes/courses/[id]/exams/[examId]/+page.svelte`
- `apps/dashboard/src/routes/courses/[id]/exams/[examId]/+page.ts`
- `apps/dashboard/src/lib/utils/store/org.ts` — `isOrgTeacher` derived store

---

## 8. Deployment Commands

### Local Docker
```bash
# Build
docker build -f docker/Dockerfile.dashboard -t ailaeclass/dashboard:local .

# Run
docker run -d --name ailaeclass-dashboard -p 3082:3082 \
  -e PUBLIC_IS_SELFHOSTED=true \
  -e PUBLIC_SUPABASE_URL=<your-url> \
  -e PUBLIC_SUPABASE_ANON_KEY=<your-anon-key> \
  -e PRIVATE_SUPABASE_SERVICE_ROLE=<your-service-role> \
  -e PRIVATE_DEEPSEEK_API_KEY=<your-key> \
  -e PRIVATE_APP_HOST=5gnu.com \
  -e PRIVATE_APP_SUBDOMAINS=app \
  ailaeclass/dashboard:local
```

### Railway
- Builder: **Docker**
- Dockerfile path: `docker/Dockerfile.dashboard`
- Environment variables: set in Railway Dashboard (same as above)
- Healthcheck path: `/`

### GitHub
- Remote: `https://github.com/s1161858/ailaeclass.git`
- **IMPORTANT:** Do not commit files containing secrets. `.env` and `.env.local` are gitignored.

---

## 9. Next AI Instructions

If you are picking up this project, start here:

1. **Read this file fully.**
2. **Check Railway dashboard** — is the deployment healthy? Are env vars set?
3. **Check Supabase dashboard** — is the schema applied? Are `documents` and `videos` buckets created with correct size limits?
4. **If schema is missing:** Debug and execute `supabase/init-schema.sql`. If sequences already exist, comment out the cleanup block and run individual `CREATE` statements, or use `IF NOT EXISTS` variants.
5. **If buckets are missing:** Create them manually in Supabase Storage UI and set file size limits.
6. **Test registration and upload flows** using the checklist in Section 5.4.
7. **Verify DNS** — only `ailaeclass.5gnumultimedia.com` should point to Railway. Root domain must stay on WordPress host.
8. **Do NOT modify** `apps/api` — it is currently out of scope. All upload logic lives in `apps/dashboard` local routes.
9. **Exam system** — if you need to modify exams:
   - Exam DB fields are in `exercise`, `question`, `submission`, `question_answer` tables (migration `20260521180000_exam_system_foundation.sql`)
   - TRUE_FALSE is UI-only (id=4); it is saved as RADIO (id=1) with True/False options
   - Student exam flow: `/courses/[id]/exams/[examId]`
   - Teacher exam editor: `/org/[slug]/exams/[id]/edit`
   - `pnpm --filter @cio/dashboard build` to verify changes (lint fails due to missing `custom/svelte` config in this workspace copy; this is a known environment issue)
10. **Known build issue:** `.eslintrc.cjs` extends `"custom/svelte"` but the shared config package is not linked in this copied workspace. Build succeeds; lint does not. Do not attempt to fix ESLint config unless explicitly asked.

---

*End of Handoff Document*
