create table if not exists public.platform_analytics_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organization(id) on delete cascade,
  actor_profile_id uuid null references public.profile(id) on delete set null,
  category text not null,
  event_name text not null,
  entity_type text null,
  entity_id text null,
  page_path text null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '365 days')
);

create table if not exists public.privacy_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organization(id) on delete cascade,
  actor_profile_id uuid null references public.profile(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text null,
  outcome text not null default 'success',
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text null,
  user_agent_hash text null,
  occurred_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '365 days')
);

create table if not exists public.platform_privacy_settings (
  organization_id uuid primary key references public.organization(id) on delete cascade,
  retention_days integer not null default 365 check (retention_days between 30 and 2555),
  store_ai_content boolean not null default false,
  pseudonymize_exports boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profile(id) on delete set null
);

create index if not exists platform_analytics_events_org_time_idx
  on public.platform_analytics_events (organization_id, occurred_at desc);
create index if not exists platform_analytics_events_name_time_idx
  on public.platform_analytics_events (event_name, occurred_at desc);
create index if not exists privacy_audit_log_org_time_idx
  on public.privacy_audit_log (organization_id, occurred_at desc);
create index if not exists privacy_audit_log_action_time_idx
  on public.privacy_audit_log (action, occurred_at desc);

alter table public.platform_analytics_events enable row level security;
alter table public.privacy_audit_log enable row level security;
alter table public.platform_privacy_settings enable row level security;

revoke all on public.platform_analytics_events from anon, authenticated;
revoke all on public.privacy_audit_log from anon, authenticated;
revoke all on public.platform_privacy_settings from anon, authenticated;
grant all on public.platform_analytics_events to service_role;
grant all on public.privacy_audit_log to service_role;
grant all on public.platform_privacy_settings to service_role;

create or replace function public.cleanup_expired_platform_records()
returns table (analytics_deleted bigint, audit_deleted bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  analytics_count bigint;
  audit_count bigint;
begin
  delete from public.platform_analytics_events where expires_at < now();
  get diagnostics analytics_count = row_count;
  delete from public.privacy_audit_log where expires_at < now();
  get diagnostics audit_count = row_count;
  return query select analytics_count, audit_count;
end;
$$;

revoke all on function public.cleanup_expired_platform_records() from public, anon, authenticated;
grant execute on function public.cleanup_expired_platform_records() to service_role;
