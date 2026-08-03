-- AiLAE Funnel MVP: page builder, contacts, events, automations and orders.
-- Public writes go through validated SvelteKit server routes; browsers do not
-- receive direct insert permission on these tables.

create extension if not exists pgcrypto;

create table if not exists public.funnel_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  default_locale text not null default 'zh-Hant',
  supported_locales text[] not null default array['zh-Hant', 'en', 'zh-Hans'],
  content_html text not null default '',
  content_css text not null default '',
  settings jsonb not null default '{}'::jsonb,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.funnel_leads (
  id uuid primary key default gen_random_uuid(),
  funnel_slug text not null references public.funnel_pages(slug) on update cascade on delete cascade,
  name text not null,
  email text not null,
  phone text not null default '',
  role_context text not null default '',
  locale text not null default 'zh-Hant',
  source text not null default 'website',
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'booked', 'customer', 'unqualified')),
  score integer not null default 10,
  tags text[] not null default '{}',
  consent_at timestamptz not null,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funnel_slug, email)
);

create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  funnel_slug text not null references public.funnel_pages(slug) on update cascade on delete cascade,
  lead_id uuid null references public.funnel_leads(id) on delete set null,
  event_type text not null,
  step text not null default 'landing',
  locale text not null default 'zh-Hant',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.funnel_campaigns (
  id uuid primary key default gen_random_uuid(),
  funnel_slug text not null references public.funnel_pages(slug) on update cascade on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  trigger_type text not null,
  workflow jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.funnel_orders (
  id uuid primary key default gen_random_uuid(),
  funnel_slug text not null references public.funnel_pages(slug) on update cascade on delete restrict,
  lead_id uuid not null references public.funnel_leads(id) on delete restrict,
  payer_email text not null,
  reference text not null unique,
  payment_method text not null check (payment_method in ('stripe', 'fps')),
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'HKD' check (currency = 'HKD'),
  status text not null default 'pending' check (status in ('pending', 'checkout_created', 'awaiting_receipt', 'receipt_submitted', 'paid', 'failed', 'cancelled', 'refunded')),
  provider_session_id text null,
  receipt_path text null,
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists funnel_leads_activity_idx on public.funnel_leads (funnel_slug, last_activity_at desc);
create index if not exists funnel_events_lookup_idx on public.funnel_events (funnel_slug, event_type, created_at desc);
create index if not exists funnel_orders_lookup_idx on public.funnel_orders (funnel_slug, status, created_at desc);

insert into public.funnel_pages (slug, name, status, published_at, settings)
values (
  'caac-m-150kg',
  'CAAC-M 150Kg 無人機牌照課程和考試',
  'published',
  now(),
  jsonb_build_object(
    'originalPrice', 23400,
    'salePrice', 18000,
    'bonusValue', 1800,
    'paymentMethods', jsonb_build_array('stripe', 'fps')
  )
)
on conflict (slug) do update set settings = excluded.settings, updated_at = now();

insert into public.funnel_campaigns (funnel_slug, name, status, trigger_type, workflow)
values
  ('caac-m-150kg', '電子書下載後跟進', 'active', 'lead_captured', '[{"type":"wait","minutes":5},{"type":"email","template":"ebook-delivery"},{"type":"tag","value":"ebook-downloaded"}]'::jsonb),
  ('caac-m-150kg', 'Calendly 預約提醒', 'active', 'booking_created', '[{"type":"email","template":"booking-confirmed"},{"type":"wait","hours":24},{"type":"email","template":"booking-reminder"}]'::jsonb),
  ('caac-m-150kg', '未完成付款提醒', 'draft', 'checkout_abandoned', '[{"type":"wait","hours":2},{"type":"email","template":"checkout-reminder"}]'::jsonb)
on conflict do nothing;

alter table public.funnel_pages enable row level security;
alter table public.funnel_leads enable row level security;
alter table public.funnel_events enable row level security;
alter table public.funnel_campaigns enable row level security;
alter table public.funnel_orders enable row level security;

drop policy if exists funnel_pages_member_read on public.funnel_pages;
create policy funnel_pages_member_read on public.funnel_pages
for select to authenticated using (
  organization_id is null or exists (
    select 1 from public.organizationmember om
    where om.organization_id = funnel_pages.organization_id
      and om.profile_id = auth.uid()
      and om.verified = true
  )
);

comment on table public.funnel_pages is 'AiLAE funnel pages edited with GrapesJS.';
comment on table public.funnel_campaigns is 'Mautic-inspired trigger/condition/action workflow definitions.';
