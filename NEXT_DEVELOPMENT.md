# ailaeclass v6 Next Development

Date: 2026-06-23

## Active Workspace

Use this folder for the next development cycle:

```text
E:\Class\ailaeclass-v6
```

Branch:

```text
v6-development
```

Base tag:

```text
v6-base-20260623
```

Completed v5 reference:

```text
E:\Class\ailaeclass-v5
v5-final-20260623
```

Do not edit `E:\Class\ailaeclass-v3`; it remains the historical v3 reference.

## Production

Production app:

```text
https://ailaeclass.5gnumultimedia.com
```

Railway fallback URL:

```text
https://ailaeclass-production.up.railway.app
```

GitHub repository:

```text
https://github.com/support910/ailaeclass.git
```

Supabase project ref:

```text
kiqzanfkpivkuvlvxqsp
```

## Local Run

Current verified Docker v5 container is still available at:

```text
http://localhost:4082
```

For new v6 work, start from `E:\Class\ailaeclass-v6` and use the existing repo scripts and Docker files. Keep generated build output out of commits.

## Guardrails

- Keep v3 unchanged.
- Treat v5 as the deployed reference; new work should happen in v6.
- Do not commit `.env` or local secret folders.
- Do not run `supabase db push --include-all` against production.
- Use narrow migration files for any future Supabase schema changes.
- Before deployment, verify build plus admin/teacher/student smoke paths.

## Last Verified Areas

- Admin dashboard, exams, AI tools, course people, logs, submissions, marks, analytics.
- Teacher course lessons, people, logs, submissions, exams, analytics.
- Student LMS, explore, my learning, AI tools, course lessons, exams, marks, and teacher-page boundary redirects.
