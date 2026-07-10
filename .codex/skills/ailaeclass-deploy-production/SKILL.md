---
name: ailaeclass-deploy-production
description: Safely deploy the current ailaeclass v6 workspace to its existing Supabase and Railway production targets. Use when the user asks to push, publish, deploy Railway, deploy Supabase, or verify the live ailaeclass service without creating duplicate projects or services.
---

# Deploy Ailaeclass Production

Read `PRODUCTION_DEPLOYMENT_RUNBOOK.md` first. Never create a new Railway project, environment, or service.

## Fixed Production Targets

```text
GitHub: support910/ailaeclass
Development branch: v6-development
Railway deploy branch: main
Railway project: attractive-harmony
Railway project ID: d5f08192-ace8-4d1e-8fb1-1475b4dbb63b
Railway environment: production
Railway environment ID: 10a0b929-3cfc-4ffd-8a8c-b3fe6d2ee30f
Railway service: ailaeclass
Railway service ID: dc5d5935-1b0f-4a09-b901-95b5a7ca8be3
Supabase project ref: kiqzanfkpivkuvlvxqsp
Production port: 3082
Production URL: https://ailaeclass.5gnumultimedia.com
Railway URL: https://ailaeclass-production.up.railway.app
```

Never deploy production to Railway project `overflowing-upliftment` (`2cc9aa17-a56a-44e9-816a-6080dc798c9c`).

## Preflight

1. Work from `E:\Class\ailaeclass-v6` on `v6-development`.
2. Run `git status --short` and inspect every changed file.
3. Preserve old backups and user files. Do not stage `backups/`, `outputs/`, local secrets, temporary tools, or comparison workbooks unless explicitly requested.
4. Confirm `.env` and `_LOCAL_SECRETS_DO_NOT_COMMIT/` remain untracked or ignored.
5. Run `corepack pnpm --filter @cio/dashboard build`.
6. Run the focused functional checks required by the feature.
7. Run `git diff --check`.

## Supabase

1. Confirm `supabase/.temp/project-ref` equals `kiqzanfkpivkuvlvxqsp`.
2. Inspect `git status --short supabase/migrations` and migration history.
3. Do not run a broad production migration push when the change has no schema migration.
4. If a new narrow migration exists, review it for destructive SQL and then run the linked-project migration command from this workspace.
5. Run `npx -y supabase@latest migration list --linked` before and after any push.
6. Run `npx -y supabase@latest db push --linked` only when the reviewed list contains pending local migrations.
7. Treat `Already up to date` as a successful no-op Supabase deployment.
8. Never print, commit, or paste service-role keys or database passwords.

## Commit And Push

1. Stage only intended v6 source, migration, and workspace Skill files.
2. Review `git diff --cached --stat` and `git diff --cached` before committing.
3. Create one descriptive commit.
4. Push the development branch:

```powershell
git push origin v6-development
```

5. Check whether `origin/main` is an ancestor of `v6-development` before promotion.

If it is an ancestor, promote the same commit directly:

```powershell
git push origin v6-development:main
```

If the histories diverged because earlier production commits were cherry-picked, follow the established deployment-branch pattern:

```powershell
git switch -c deploy/<short-purpose>-<yyyymmdd> origin/main
git cherry-pick <new-v6-commit>
git push origin HEAD:main
git switch v6-development
```

Confirm the cherry-pick contains only the intended new change. If conflicts occur, resolve them against the already deployed `main` behavior and rerun the build. Never force push production without explicit user approval.

## Verify Railway

Use the fixed IDs, not project discovery guesses:

```powershell
npx -y @railway/cli deployment list --project d5f08192-ace8-4d1e-8fb1-1475b4dbb63b --service dc5d5935-1b0f-4a09-b901-95b5a7ca8be3 --environment production --json
npx -y @railway/cli service list --project d5f08192-ace8-4d1e-8fb1-1475b4dbb63b --environment production --json
npx -y @railway/cli logs --project d5f08192-ace8-4d1e-8fb1-1475b4dbb63b --service ailaeclass --environment production --latest --lines 160
```

Require all of the following before reporting success:

- Latest deployment status is `SUCCESS`.
- Deployment commit hash equals the pushed commit.
- Exactly one intended `ailaeclass` service is used.
- Running replicas equals 1 and crashed replicas equals 0.
- Logs contain `Listening on 0.0.0.0:3082`.
- Both Railway domains target port 3082.
- Production `/`, `/login`, `/org/admin`, and `/_app/version.json` return HTTP 200.
- The changed user workflow passes a live smoke test.

Report the commit hash, Supabase migration result, Railway deployment status, service identity, and production URL.
