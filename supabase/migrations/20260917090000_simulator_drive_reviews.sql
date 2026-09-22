create table public.simulator_drive_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  source_url text not null check (char_length(source_url) <= 2048),
  flight_type text not null default 'simulator' check (flight_type in ('simulator', 'real')),
  video_source_url text check (char_length(video_source_url) <= 2048),
  scenario text not null check (scenario in ('figure_eight', 'hover', 'route', 'landing')),
  source_kind text check (source_kind in ('data', 'video', 'image', 'image_video')),
  status text not null default 'pending' check (status in ('pending', 'imported', 'processing', 'completed', 'failed')),
  data_summary jsonb,
  report jsonb,
  error_code text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index simulator_drive_reviews_user_time on public.simulator_drive_reviews (user_id, created_at desc);
alter table public.simulator_drive_reviews enable row level security;
revoke all on public.simulator_drive_reviews from anon, authenticated;
grant select, delete on public.simulator_drive_reviews to authenticated;
grant all on public.simulator_drive_reviews to service_role;
create policy simulator_review_owner_read on public.simulator_drive_reviews for select to authenticated using (auth.uid() = user_id);
create policy simulator_review_owner_delete on public.simulator_drive_reviews for delete to authenticated using (auth.uid() = user_id);

-- Keep a separate quota ledger: deleting a report must not reset its AI allowance.
create table public.simulator_review_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index simulator_review_requests_user_time on public.simulator_review_requests(user_id, requested_at);
alter table public.simulator_review_requests enable row level security;
revoke all on public.simulator_review_requests from anon, authenticated;
grant all on public.simulator_review_requests to service_role;

create function public.reserve_simulator_review(p_user_id uuid, p_title text, p_source_url text, p_scenario text, p_flight_type text default 'simulator', p_video_source_url text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare review_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 92717));
  delete from public.simulator_review_requests where user_id = p_user_id and requested_at < now() - interval '1 day';
  if (select count(*) from public.simulator_review_requests where user_id = p_user_id and requested_at > now() - interval '10 minutes') >= 5
     or (select count(*) from public.simulator_review_requests where user_id = p_user_id) >= 30 then
    raise exception 'SIMULATOR_RATE_LIMIT';
  end if;
  insert into public.simulator_review_requests(user_id) values (p_user_id);
  insert into public.simulator_drive_reviews(user_id,title,source_url,scenario,flight_type,video_source_url)
    values (p_user_id,p_title,p_source_url,p_scenario,p_flight_type,p_video_source_url) returning id into review_id;
  return review_id;
end;
$$;

create function public.claim_simulator_analysis(p_user_id uuid, p_review_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare claimed uuid;
begin
  update public.simulator_drive_reviews set status='processing', attempts=attempts+1, updated_at=now(), error_code=null
  where id=p_review_id and user_id=p_user_id and source_kind is not null and attempts < 3
    and (status in ('imported','failed') or (status='processing' and updated_at < now() - interval '5 minutes'))
  returning id into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.reserve_simulator_review(uuid,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.claim_simulator_analysis(uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_simulator_review(uuid,text,text,text,text,text) to service_role;
grant execute on function public.claim_simulator_analysis(uuid,uuid) to service_role;
