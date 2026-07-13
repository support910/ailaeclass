# Ailaeclass Version State

## Frozen v4 Baseline

- Frozen tag: `v4.0-final`
- Frozen branch: `freeze/v4-final`
- Baseline commit: `55d8581 fix: lazy init server supabase during build`
- Railway production deployment: `45768cec-bb15-4fa0-b936-2d558c6fefac`
- Railway production URL: `https://ailaeclass-production.up.railway.app/`
- Supabase project ref: `kiqzanfkpivkuvlvxqsp`

This v5 workspace was created from `v4.0-final`. Treat that tag as immutable.

## Active v5 Workspace

- Local folder: `E:\Class\ailaeclass-v5`
- Git branch: `v5-development`
- Development rule: every v5 change must be committed on `v5-development` or a child branch.

## Frozen v5 / v6 Handoff

- Handoff date: 2026-06-22
- Handoff document: `HANDOVER_V6.md`
- Completed v5 local folder: `E:\Class\ailaeclass-v5`
- Next development base: `E:\Class\ailaeclass-v6`
- Single organization siteName: `admin`
- Supabase project ref: `kiqzanfkpivkuvlvxqsp`
- Railway deployment source: GitHub repository `https://github.com/support910/ailaeclass.git`
- Required production env update: `PUBLIC_SINGLE_ORG_SITE_NAME=admin`

## Do Not Change

- Do not move, delete, or overwrite `v4.0-final`.
- Do not force-push `freeze/v4-final`.
- Do not run `supabase db push --include-all` against production.
- Do not modify `E:\Class\ailaeclass-v3` for v5 work unless explicitly requested.
- Do not modify the frozen v5 backup after v6 handoff unless explicitly requested.

## Frozen v6 / v7 Handoff

- Handoff date: 2026-07-11
- Frozen development tag: `v6.0-final-20260711`
- Frozen production tag: `v6.0-production-20260711`
- Frozen backup branch: `backup/v6-final-20260711`
- Frozen v6 commit: `c3a62f252915836d8e8937f302c7e96923e092eb`
- Production baseline commit: `764e171395a4ecd7b433fe28011aa91392288d50`
- Complete Git bundle: `E:\Class\ailaeclass-v6\backups\v6-final-20260711.bundle`
- Local configuration backup: `E:\Class\ailaeclass-v6\_LOCAL_SECRETS_DO_NOT_COMMIT\backups\v6-final-20260711-config`

## Active v7 Workspace

- Version name: `Ailaeclass v7`
- Local folder: `E:\Class\ailaeclass-v7`
- Git branch: `v7-development`
- Development rule: v7 changes stay in this worktree; the v6 worktree and frozen tags are immutable.

## v7.0.0 Production Release - 2026-07-13

- Release tag: `v7.0.0-20260713`
- Source branch: `v7-development`
- Railway target: existing `attractive-harmony / ailaeclass / production` service only
- Supabase target: existing project `kiqzanfkpivkuvlvxqsp` only
- Release notes: `docs/V7_RELEASE_20260713.md`
- Scope: course ownership and membership management, course catalog and favorites, student course applications, feedback workflow, and student exam navigation.
- Database migrations: `20260711000000_course_favorites.sql`, `20260713000000_user_feedback.sql`
- Verification: production dashboard build, student application flow, teacher application visibility, screenshot access control, and course role checks.

## Database Note

The v4 production database already has:

```sql
public.option.metadata jsonb
```

For future migrations, use narrow, explicit SQL migrations only. Avoid replaying historical migrations on production.
