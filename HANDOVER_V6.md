# ailaeclass v6 Handover

Date: 2026-06-22
Workspace: `E:\Class\ailaeclass-v6`
Source workspace: `E:\Class\ailaeclass-v5`
Git branch at handoff: `v5-development`
Production app: `https://ailaeclass.5gnumultimedia.com`
Railway fallback URL: `https://ailaeclass-production.up.railway.app`
Supabase project ref: `kiqzanfkpivkuvlvxqsp`

## Current State

This handoff freezes the completed v5 work and creates v6 as the next development base.

Core product state:
- v3 folder remains the historical reference and must not be edited for v6 work.
- v5 contains the production-ready state after AI tools, quick practice exams, course joining, role boundary, and single-org fixes.
- v6 is a full local copy of the current v5 source and configuration, intended as the next active development workspace.
- Final deployed v5 commit after verification: `765706d fix: make dashboard analytics non-blocking`.

## Important Rules

- Do not edit `E:\Class\ailaeclass-v3`.
- Do not overwrite or delete the frozen v5 archive.
- Develop new work from `E:\Class\ailaeclass-v6`.
- Keep secrets out of Git. `.env` is intentionally ignored.
- For production database changes, use narrow explicit migrations only. Do not replay all historical migrations against production.
- Production uses a single organization. The required org siteName is `admin`.

## Environment And Secrets

Tracked documentation does not contain plaintext secret values.

The local secret snapshot is stored at:

```text
E:\Class\.archive\secrets\ailaeclass-v6-dashboard.env
E:\Class\ailaeclass-v6\_LOCAL_SECRETS_DO_NOT_COMMIT\apps-dashboard.env
```

Required environment variables for Railway/dashboard:

```text
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY
PRIVATE_SUPABASE_SERVICE_ROLE
PUBLIC_IS_SELFHOSTED
PRIVATE_DEEPSEEK_API_KEY
PRIVATE_APP_HOST
PRIVATE_APP_SUBDOMAINS
PUBLIC_SINGLE_ORG_SITE_NAME
USE_HTTPS_ON_LOCALHOST
```

Important current values by meaning:
- `PUBLIC_SINGLE_ORG_SITE_NAME` must be `admin`.
- The code also defaults to `admin` if `PUBLIC_SINGLE_ORG_SITE_NAME` is missing, because Railway production was missing this env var during verification.
- `PUBLIC_IS_SELFHOSTED` must be `true`.
- `PRIVATE_APP_HOST` is the root app host used by the dashboard.
- DeepSeek is used by ailaeclass Agent and Socratic-style learning tools.
- Supabase Auth, database, and storage all point to project ref `kiqzanfkpivkuvlvxqsp`.

## Major v5 Changes Now Included

### ailaeclass Agent / AI Tools

- Added AI Tools navigation for teacher/admin and student LMS.
- Added ailaeclass Agent with DeepSeek-backed learning chat.
- Adjusted answer formatting so markdown artifacts such as `**` do not show to students.
- Sources are hidden behind expandable UI in answer cards.
- Socratic mode now checks each step before moving on and teaches patiently after wrong answers.

### Exam System v2 / Quick Practice

- Added quick-practice style exam flow on top of the existing exam system.
- Users answer first, immediately see correct/incorrect state and explanation, then click next manually.
- Teacher/admin can create and answer; students can answer.
- Supports time limit, attempt limit, retake, manual next question, progress saving, shuffle question order, and shuffle option order.
- Added answer/explanation fields and image-friendly question/option handling using existing upload patterns.
- Student retake flow includes shuffle controls at restart/result surfaces.

### Course / Role Boundary Fixes

- Student course cards no longer expose clone/delete/manage actions.
- Student course pages no longer expose teacher exam editing or submission management controls.
- Student and teacher boundaries are resolved from API viewer membership, not stale UI state.
- Course API endpoints filter submissions/marks and management actions by role.
- Course join now uses join code/request flow and keeps student role intact after joining.

### Explore / Single Organization Fixes

- Student Explore shows published courses in the current organization that the student has not joined.
- The platform is now pinned to the single organization `admin`.
- If an existing user belongs to another org but not `admin`, login auto-adds the user to `admin` with the same/student role instead of leaving Explore empty.
- Stale browser organization state is cleared in single-org mode so `test-team` cannot remain active accidentally.

### Admin Dashboard Fix

- Fixed intermittent admin dashboard `Failed to fetch analytics data`.
- Analytics request now waits for an access token and sends `Authorization: Bearer <token>`.
- Analytics is now non-blocking: if Supabase/RPC analytics queries fail transiently, the endpoint returns empty dashboard stats with HTTP 200 and the UI no longer shows a red snackbar error.

### Certificate / Branding Fixes

- Replaced ClassroomIO certificate preview artifacts with ailaeclass/5GNU branding.
- Course preview and landing pages now hide inappropriate student actions and use student-safe copy.

## Local Verification

Known working local URL:

```text
http://localhost:3082
```

Commands:

```powershell
cd E:\Class\ailaeclass-v6
pnpm --filter @cio/dashboard build
docker compose -f docker/docker-compose.local.yaml --env-file apps/dashboard/.env build dashboard
docker compose -f docker/docker-compose.local.yaml --env-file apps/dashboard/.env up -d dashboard
```

Useful local checks:
- Admin login: `admin@5gnu.com`
- Admin dashboard should load without analytics error.
- Student LMS Explore should show `我的梦` for a student not already enrolled.
- Student course pages must not show teacher-only edit/delete/clone/exam edit actions.
- Teacher/admin exam pages must still allow exam creation and publishing.

## Deployment

### Current Deployment Status On 2026-06-22

Local save and remote upload are complete.

Completed locally:
- v5 final code commit: `d9f0692 fix: default production to admin single org`
- v5 final documentation/deployment commit: `8376913 docs: update final v5 deployment handoff`
- Local tag: `v5-final-20260622`
- v6 worktree branch: `v6-development`
- Local Docker validation passed before handoff.

Completed remotely:
- `v5-development` pushed to GitHub.
- `main` fast-forwarded to the same v5 final state for Railway production deployment.
- `v5-final-20260622` pushed to GitHub and updated to final commit `8376913`.
- `v6-development` pushed to GitHub as the next development branch.

```powershell
git push origin v5-development
git push origin v5-development:main
git push origin v5-final-20260622 --force
git push origin v6-development
```

Railway CLI is not installed on this machine, so deployment was verified by polling the production site and running browser tests.

Production verification passed on `https://ailaeclass.5gnumultimedia.com`:
- Admin login opened `/org/admin` with no analytics fetch error.
- Temporary student initially assigned to `test-team` resolved into `admin`.
- Student Explore showed published course `我的梦`.
- Temporary student account was deleted after verification.

Supabase CLI is not installed on this machine. No Supabase migration was required for the final fixes.

### GitHub / Railway

Repository:

```text
https://github.com/support910/ailaeclass.git
```

Railway is connected to GitHub. The expected deploy path is:

```powershell
git push origin v5-development
```

Railway config files:

```text
railway.toml
railway.json
docker/Dockerfile.dashboard
```

The Dockerfile path in `railway.toml` is the production-safe deployment path.

Railway should include the dashboard env variables listed above, especially:

```text
PUBLIC_SINGLE_ORG_SITE_NAME=admin
```

The code has a production-safe fallback to `admin`, but the Railway variable should still be set explicitly.

The local machine currently does not have the Railway CLI installed. Deployment was triggered by pushing GitHub `main` and verified by production browser tests.

### Supabase

Project ref:

```text
kiqzanfkpivkuvlvxqsp
```

No new production migration is required for the final single-org/explore/admin dashboard fixes. The existing database already has the exam/join-code/option metadata migrations needed by v5.

The local machine currently does not have the Supabase CLI installed. If future database work is required, install/login first, then push only new narrow migrations.

## Docker Cleanup State

On 2026-06-22, Docker build cache was cleaned:

```text
docker builder prune -af
docker image prune -f
```

After cleanup:
- Build cache: `0B`
- Docker images: about `2.9GB`
- Running local dashboard remains available at `http://localhost:3082`

## File Organization

Top-level intended layout:

```text
E:\Class\ailaeclass-v3          # historical v3 reference, do not edit
E:\Class\ailaeclass-v5          # completed v5 workspace
E:\Class\ailaeclass-v6          # next development base
E:\Class\.archive               # dated archives, secrets, old logs
```

Archived support files:

```text
E:\Class\.archive\secrets
E:\Class\.archive\handoff
E:\Class\.archive\old-top-level
```

## Known Non-Blocking Warnings

`pnpm --filter @cio/dashboard build` passes. Existing warnings remain:
- Node version warning if using Node 22 locally; project wants Node `^20.19.3`.
- Svelte accessibility warnings around some existing label/dropdown components.
- `svelte-dnd-action` resolve warning.
- Large chunk warning.

These were present during v5 work and are not blockers.

## 2026-06-22 Production Hotfixes

Latest deployed commits:

```text
1dbfba4 fix: stabilize page auth and cache headers
87273ef fix: prevent auth token lookup from hanging
b3e4c0f fix: load student exam details reliably
```

What changed:
- Global layout auth setup now awaits `hasSession()` before deciding whether to redirect. This fixes unreliable loading/redirect behavior on production pages such as `控制檯` and `考試`.
- Server-side page responses now mark HTML and SvelteKit version checks as `no-cache`, reducing stale frontend chunk issues after Railway deploys.
- Student exam detail pages now trigger loading from a browser-side reactive guard instead of relying only on `onMount`, fixing the production case where `/courses/{courseId}/exams/{examId}` stayed on `Loading...`.
- `getAccessToken()` now falls back to the stored Supabase browser token if `supabase.auth.getSession()` hangs longer than 2 seconds, fixing the case where starting a quick-practice exam succeeded but the follow-up refresh stayed on `Loading...`.

Production verification completed:
- `https://ailaeclass.5gnumultimedia.com/org/admin` loads without the previous analytics error.
- `https://ailaeclass.5gnumultimedia.com/org/admin/exams` loads exam lists for admin.
- `https://ailaeclass.5gnumultimedia.com/org/admin/exams/5fc366b9-8bb6-4900-ad2b-fe4304648bfa/edit` opens without page error.
- Student course exam list for `我的梦` loads published quick-practice exams.
- Student quick-practice detail loads questions.
- Student quick-practice start creates/resumes an in-progress attempt and renders the runner.
- Selecting an answer and clicking `Check answer` shows correctness, correct answer, and explanation area.

Temporary test account used for verification was removed from Supabase after testing.
