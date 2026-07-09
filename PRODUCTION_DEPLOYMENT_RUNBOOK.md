# ailaeclass v6 Production Deployment Runbook

Last updated: 2026-07-02

This file records the exact production path. Use this first before checking other Railway projects.

## Correct Production Targets

GitHub repository:

```text
https://github.com/support910/ailaeclass.git
```

Railway production project:

```text
Project name: attractive-harmony
Project ID: d5f08192-ace8-4d1e-8fb1-1475b4dbb63b
Environment: production
Environment ID: 10a0b929-3cfc-4ffd-8a8c-b3fe6d2ee30f
Service name: ailaeclass
Service ID: dc5d5935-1b0f-4a09-b901-95b5a7ca8be3
Source repo: support910/ailaeclass
Deploy branch: main
```

Production URLs:

```text
https://ailaeclass.5gnumultimedia.com
https://ailaeclass-production.up.railway.app
```

Supabase production project:

```text
Project ref: kiqzanfkpivkuvlvxqsp
Dashboard URL: https://supabase.com/dashboard/project/kiqzanfkpivkuvlvxqsp
```

## Do Not Use This Railway Project For Production

There is another Railway project connected to the same repository. It can confuse deployment checks.

```text
Project name: overflowing-upliftment
Project ID: 2cc9aa17-a56a-44e9-816a-6080dc798c9c
Service ID: d4dc436a-0612-4fce-83ef-d53397183972
```

It is not the service behind `https://ailaeclass.5gnumultimedia.com`.

## Production Domain Port

The live `ailaeclass` service listens on:

```text
PORT=3082
```

Both Railway domains must target port `3082`:

```powershell
npx -y @railway/cli domain list --project d5f08192-ace8-4d1e-8fb1-1475b4dbb63b --service ailaeclass --environment production --json
```

Expected domain rows:

```text
ailaeclass.5gnumultimedia.com          targetPort 3082
ailaeclass-production.up.railway.app   targetPort 3082
```

If the domain target port is wrong, fix it with:

```powershell
npx -y @railway/cli domain update ailaeclass.5gnumultimedia.com --port 3082 --project d5f08192-ace8-4d1e-8fb1-1475b4dbb63b --service ailaeclass --environment production
npx -y @railway/cli domain update ailaeclass-production.up.railway.app --port 3082 --project d5f08192-ace8-4d1e-8fb1-1475b4dbb63b --service ailaeclass --environment production
```

## Deploy Code

From the active v6 workspace:

```powershell
cd E:\Class\ailaeclass-v6
git status --short
pnpm --filter @cio/dashboard build
git push origin v6-development
git push origin v6-development:main
```

Railway deploys from GitHub `main`. Do not create a new Railway project.

## Verify Railway Deployment

Check the latest deployment and make sure it is `SUCCESS` and its `commitHash` matches the pushed commit:

```powershell
npx -y @railway/cli deployment list --project d5f08192-ace8-4d1e-8fb1-1475b4dbb63b --service dc5d5935-1b0f-4a09-b901-95b5a7ca8be3 --environment production --json
```

Check service status:

```powershell
npx -y @railway/cli service list --project d5f08192-ace8-4d1e-8fb1-1475b4dbb63b --environment production --json
```

Expected:

```text
service: ailaeclass
status: SUCCESS
replicas.running: 1
replicas.crashed: 0
url: https://ailaeclass.5gnumultimedia.com
```

Check runtime logs:

```powershell
npx -y @railway/cli logs --project d5f08192-ace8-4d1e-8fb1-1475b4dbb63b --service ailaeclass --environment production --latest --lines 160
```

Expected startup line:

```text
Listening on 0.0.0.0:3082
```

Check recent HTTP errors:

```powershell
npx -y @railway/cli logs --project d5f08192-ace8-4d1e-8fb1-1475b4dbb63b --service ailaeclass --environment production --http --status 500 --lines 30
npx -y @railway/cli logs --project d5f08192-ace8-4d1e-8fb1-1475b4dbb63b --service ailaeclass --environment production --http --status 502 --lines 30
```

## Verify Production URLs

Run:

```powershell
$urls=@(
  'https://ailaeclass.5gnumultimedia.com/',
  'https://ailaeclass.5gnumultimedia.com/login',
  'https://ailaeclass.5gnumultimedia.com/org/admin',
  'https://ailaeclass.5gnumultimedia.com/_app/version.json',
  'https://ailaeclass-production.up.railway.app/login'
)
foreach($u in $urls){
  try {
    $r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0
    "$u -> $($r.StatusCode) $($r.StatusDescription) len=$($r.Content.Length)"
  } catch {
    if ($_.Exception.Response) {
      "$u -> HTTP $([int]$_.Exception.Response.StatusCode)"
    } else {
      "$u -> ERROR $($_.Exception.Message)"
    }
  }
}
```

Expected:

```text
All rows return 200 OK.
```

If PowerShell shows transient SSL errors, cross-check with:

```powershell
curl.exe -I --max-time 30 https://ailaeclass.5gnumultimedia.com/login
curl.exe -I --max-time 30 https://ailaeclass.5gnumultimedia.com/
curl.exe -I --max-time 30 https://ailaeclass.5gnumultimedia.com/_app/version.json
```

## Supabase Rules

Do not run broad migration pushes against production.

Use Supabase only when a feature has a new narrow migration. The current v6 exam CSV and role-boundary deployment did not require a Supabase schema migration.

Secrets are stored locally outside Git:

```text
E:\Class\.archive\secrets
E:\Class\ailaeclass-v6\_LOCAL_SECRETS_DO_NOT_COMMIT
```

Do not commit `.env`, API keys, Supabase service role keys, or temporary key text files.

## 2026-07-02 Verified Production State

Latest verified commit:

```text
fbd4babb8bcbb73634d87882444859fc223e6aa1
fix: harden exam csv import and role boundaries
```

Verification completed:

```text
Railway deployment: SUCCESS
Service: ailaeclass
Running replicas: 1
Crashed replicas: 0
Domain target ports: 3082
Production /login: 200
Production /org/admin: 200
Production /_app/version.json: 200
Browser login page smoke: status 200, email field visible, no request failures
```
