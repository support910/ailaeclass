# ailaeclass — 5G nuMultiMedia Learning Platform

> A customized LMS powered by ClassroomIO, rebranded and enhanced for **5G nuMultiMedia Limited (5GNU)**.
> Deployed at: `http://localhost:3082` (Docker local)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Environment Variables](#environment-variables)
4. [Docker Build & Run](#docker-build--run)
5. [Chatbot Configuration](#chatbot-configuration)
6. [Dashboard Redesign](#dashboard-redesign)
7. [Rebrand Summary](#rebrand-summary)
8. [Key File Changes](#key-file-changes)
9. [Troubleshooting](#troubleshooting)

---

## Project Overview

**ailaeclass** is an intelligent learning management platform tailored for 5G nuMultiMedia Limited. It integrates:

- **5G-A Drone Live Streaming & Low-Altitude Economy** branding
- **DeepSeek-powered AI Chatbot** (strictly limited to 5GNU / ailaeclass topics)
- **Supabase Storage** for document uploads (up to 50MB)
- **Hong Kong-themed tech dashboard** with interactive map

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Container                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            ailaeclass Dashboard (SvelteKit)         │   │
│  │  ┌─────────────┐    ┌─────────────┐   ┌──────────┐  │   │
│  │  │  Frontend   │◄──►│  /api/chat  │   │ Supabase │  │   │
│  │  │  (Svelte)   │    │  (DeepSeek) │   │ Storage  │  │   │
│  │  └─────────────┘    └─────────────┘   └──────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                         Port 3082                           │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | SvelteKit + TypeScript | TailwindCSS + Carbon Components |
| Backend API | SvelteKit server routes | `/api/chat` proxies DeepSeek |
| Database/Auth | Supabase | PostgreSQL + Auth + Realtime |
| Storage | Supabase Storage | Signed upload URLs, 50MB limit |
| AI Service | DeepSeek API (`deepseek-chat`) | Server-side proxy, key hidden |
| Build Tool | pnpm + Turborepo | Monorepo workspace |
| Runtime | Node 20 Alpine (Docker) | `ws` polyfill for Supabase realtime |

---

## Environment Variables

### Required for Build (in `docker/Dockerfile.dashboard`)

These are baked into the image at build time because SvelteKit reads `$env/static/public` during `vite build`.

| Variable | Value | Purpose |
|----------|-------|---------|
| `PUBLIC_SINGLE_ORG_SITE_NAME` | `""` | Disables single-org mode |
| `PUBLIC_SUPABASE_URL` | `https://hqgygleangptqthjehtb.supabase.co` | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_XqQpQyaKGz_...` | Public Supabase anon key |
| `PRIVATE_SUPABASE_SERVICE_ROLE` | `sb_secret_Pv-dgkEkHtHm...` | Server-side Supabase role |
| `PRIVATE_DEEPSEEK_API_KEY` | `your_deepseek_key_here` | DeepSeek API key for chatbot |

### Required at Runtime (when running container)

| Variable | Example | Purpose |
|----------|---------|---------|
| `PUBLIC_IS_SELFHOSTED` | `true` | Enables self-hosted features |
| `PRIVATE_APP_HOST` | `5gnu.com` | Domain for org subdomains |
| `PRIVATE_APP_SUBDOMAINS` | `app` | Subdomain prefix for dashboard |

### Local Development (in `apps/dashboard/.env`)

Same variables as above, plus optional ones:

```bash
# AI / Integrations
OPENAI_API_KEY=                # Optional, for OpenAI features
PRIVATE_DEEPSEEK_API_KEY=your_deepseek_key_here

# Domain
PRIVATE_APP_HOST=5gnu.com
PRIVATE_APP_SUBDOMAINS=app

# Cloudflare (optional, for video uploads)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_ACCESS_KEY=
CLOUDFLARE_SECRET_ACCESS_KEY=
CLOUDFLARE_BUCKET_DOMAIN=

# SMTP (optional, for emails)
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
SMTP_PORT=
SMTP_SENDER=
```

---

## Docker Build & Run

### 1. Build the Image

From the **repository root** (`classroomio-main/`):

```bash
docker build -f docker/Dockerfile.dashboard -t classroomio/dashboard:local .
```

Build-time fixes applied:
- `python3 make g++` installed for native modules
- `pnpm@8.15.9` installed globally (avoids corepack Node 20 crash)
- `pnpm install --ignore-scripts` skips `@sentry/profiling-node` compilation
- `ws` dependency injected for Supabase realtime on Node 20

### 2. Run the Container

```bash
docker run -d \
  --name ailaeclass-dashboard \
  -p 3082:3082 \
  -e PUBLIC_IS_SELFHOSTED=true \
  -e PUBLIC_SUPABASE_URL=https://hqgygleangptqthjehtb.supabase.co \
  -e PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here \
  -e PRIVATE_SUPABASE_SERVICE_ROLE=your_service_role_here \
  -e PRIVATE_DEEPSEEK_API_KEY=your_deepseek_key_here \
  -e PRIVATE_APP_HOST=5gnu.com \
  -e PRIVATE_APP_SUBDOMAINS=app \
  classroomio/dashboard:local
```

### 3. Access the App

Open your browser to: **http://localhost:3082**

### 4. Stop / Restart

```bash
docker stop ailaeclass-dashboard
docker rm ailaeclass-dashboard
# Then re-run the `docker run` command above
```

---

## Chatbot Configuration

### Behavior

The chatbot is a **floating widget** on the bottom-right of every page. It is strictly scoped to 5G nuMultiMedia and ailaeclass topics only.

- **Model**: `deepseek-chat` (DeepSeek V3)
- **Max tokens**: 512
- **Temperature**: 0.7
- **System prompt**: Hard-coded in `apps/dashboard/src/routes/api/chat/+server.ts`
- **Topics allowed**:
  1. 5G nuMultiMedia Limited company info
  2. ailaeclass platform features
  3. Low-altitude economy (drones, 5G-A live streaming, STEM/STEAM)
  4. Hong Kong Cyberport / Science Park
  5. AOPA drone certification

If a user asks anything outside these topics, the bot replies:
> "Sorry, I can only answer questions related to 5G nuMultiMedia, ailaeclass, and our low-altitude economy services."

### UI Features

- Expand / collapse toggle
- Maximize / minimize chat window
- Loading dots animation while waiting
- Gradient header matching brand colors (`#0E7372` → `#00D4FF`)
- Disclaimer footer: "AI responses are limited to 5G nuMultiMedia & ailaeclass topics only"

### Files

| File | Purpose |
|------|---------|
| `src/lib/components/Chatbot/ChatbotWidget.svelte` | Floating UI component |
| `src/routes/api/chat/+server.ts` | Server-side proxy to DeepSeek |
| `src/routes/+layout.svelte` | Renders `<ChatbotWidget />` globally |

### Changing the API Key

Update the `PRIVATE_DEEPSEEK_API_KEY` value in:
1. `apps/dashboard/.env`
2. `docker/Dockerfile.dashboard`
3. `docker/docker-compose.yaml`
Then rebuild and restart the container.

---

## Dashboard Redesign

The post-login dashboard (`/org/[slug]`) now features a **tech-themed hero section** above the original analytics cards.

### Hero Section Elements

1. **Gradient Background**
   - `from-slate-900 via-slate-800 to-slate-900`
   - Animated cyan/teal glow blurs (`bg-cyan-400/10 blur-3xl`)

2. **Company Badges**
   - "Low-Altitude Economy Pioneer" (with Rocket icon)
   - "5G-A Drone Tech" (with Drone icon)

3. **Company Intro**
   - Welcome title with gradient text (`ailaeclass`)
   - Description of 5GNU's mission
   - Location chip: Cyberport 3, Hong Kong
   - Certification chip: AOPA Exclusive Exam Centre

4. **Hong Kong Map SVG**
   - Simplified HK outline with **cyan/teal gradient stroke**
   - Inner fill at 6% opacity
   - **Science Park marker** (top-right, ping animation)
   - **Cyberport marker** (bottom-left, ping animation)
   - Decorative circuit dash-lines

5. **Stats Bar**
   - 5G-A Drone Broadcast
   - 8K Live Streaming
   - AOPA Certified Centre
   - Founded HK 2020

### File

- `apps/dashboard/src/routes/org/[slug]/+page.svelte`

---

## Rebrand Summary

| Original | Rebranded To |
|----------|-------------|
| ClassroomIO | **ailaeclass** |
| Theme color | `#0E7372` (teal) + `#00D4FF` (cyan accent) |
| Logo / favicon | Retained original asset paths (recommend replacing `/logo-192.png`) |
| Course image template | `/images/ailaeclass-course-img-template.jpg` |
| Site domain helper | `*.ailaeclass.com` |
| Meta tags / titles | "Dashboard — ailaeclass" |

---

## Key File Changes

| File | Change |
|------|--------|
| `apps/dashboard/src/lib/utils/config/brand.ts` | Rebrand constants |
| `apps/dashboard/src/routes/org/[slug]/+page.svelte` | Tech hero + HK map |
| `apps/dashboard/src/lib/components/Chatbot/ChatbotWidget.svelte` | New AI widget |
| `apps/dashboard/src/routes/api/chat/+server.ts` | DeepSeek proxy endpoint |
| `apps/dashboard/src/routes/+layout.svelte` | Mount chatbot globally; force `zh-TW` locale |
| `apps/dashboard/src/lib/utils/functions/supabase.ts` | Inject `ws` transport for Node 20 |
| `apps/dashboard/src/lib/utils/functions/supabase.server.ts` | Inject `ws` transport for Node 20 |
| `docker/Dockerfile.dashboard` | Multi-stage build; pnpm 8.15.9; ignore-scripts |
| `docker/docker-compose.yaml` | Add `PRIVATE_DEEPSEEK_API_KEY` |
| `package.json` | Add `"packageManager": "pnpm@8.15.9"` |
| `apps/dashboard/.env` | Add `PRIVATE_DEEPSEEK_API_KEY` |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Lockfile not compatible with current pnpm` | Uses `pnpm install --ignore-scripts` in Dockerfile (lockfile ignored) |
| `Node.js 20 detected without native WebSocket support` | `ws` package installed; injected into Supabase client options |
| `@sentry/profiling-node` build failure | `--ignore-scripts` skips native compilation |
| `Missing Supabase server config` | Ensure `PRIVATE_SUPABASE_SERVICE_ROLE` is set at build time |
| `Could not resolve workspaces` | Root `package.json` must contain `"packageManager": "pnpm@8.15.9"` |
| Port 3082 already in use | `docker stop <container> && docker rm <container>` then re-run |

---

*Built on 2026-05-18 for 5G nuMultiMedia Limited.*
