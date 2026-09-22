-- Additive only: existing courses, exams and private AI reviews are unchanged.
create table public.flight_link_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.course(id) on delete restrict,
  client_request_id uuid not null,
  title text not null check(char_length(title) between 1 and 120),
  flight_type text not null check(flight_type in ('simulator','real')),
  scenario text not null check(scenario in ('figure_eight','hover','route','landing')),
  occurred_at timestamptz not null,
  result_url text check(char_length(result_url) <= 2048 and result_url like 'https://drive.google.com/%'),
  video_url text check(char_length(video_url) <= 2048 and video_url like 'https://drive.google.com/%'),
  note text not null default '' check(char_length(note) <= 2000),
  status text not null default 'submitted' check(status in ('submitted','withdrawn')),
  consent_version text not null default 'course-staff-v1',
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique(user_id, client_request_id),
  check(result_url is not null or video_url is not null),
  check(flight_type = 'real' or (result_url is not null and video_url is null))
);
create index flight_links_course_time on public.flight_link_submissions(course_id, created_at desc, id);
create index flight_links_user_time on public.flight_link_submissions(user_id, created_at desc, id);

create function public.can_read_flight_link(p_course_id uuid, p_user_id uuid, p_status text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = p_user_id or (p_status = 'submitted' and exists (
    select 1 from public.course c
    join public."group" g on g.id = c.group_id
    join public.organizationmember om on om.organization_id = g.organization_id
      and om.profile_id = auth.uid() and om.verified = true
    join auth.users u on u.id = om.profile_id
    where c.id = p_course_id and c.status = 'ACTIVE' and (
      (om.role_id = 1 and lower(u.email) = 'admin@5gnu.com') or
      (om.role_id = 2 and exists(select 1 from public.groupmember gm
        where gm.group_id = c.group_id and gm.profile_id = auth.uid() and gm.role_id in (1,2)))
    )
  ));
$$;
revoke all on function public.can_read_flight_link(uuid,uuid,text) from public, anon;
grant execute on function public.can_read_flight_link(uuid,uuid,text) to authenticated, service_role;
alter table public.flight_link_submissions enable row level security;
revoke all on public.flight_link_submissions from anon, authenticated;
grant select on public.flight_link_submissions to authenticated;
grant all on public.flight_link_submissions to service_role;
create policy flight_links_visible on public.flight_link_submissions for select to authenticated
  using(public.can_read_flight_link(course_id,user_id,status));

create function public.submit_flight_link(p_user_id uuid, p_course_id uuid, p_request_id uuid,
  p_title text, p_flight_type text, p_scenario text, p_occurred_at timestamptz,
  p_result_url text, p_video_url text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare saved public.flight_link_submissions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 92226));
  if not exists(select 1 from public.course c
    join public."group" g on g.id = c.group_id
    join public.organizationmember om on om.organization_id = g.organization_id
      and om.profile_id = p_user_id and om.verified = true
    join public.groupmember gm on gm.group_id = c.group_id and gm.profile_id = p_user_id and gm.role_id = 3
    where c.id = p_course_id and c.status = 'ACTIVE') then
    raise exception 'FLIGHT_ACCESS_DENIED';
  end if;
  select * into saved from public.flight_link_submissions where user_id=p_user_id and client_request_id=p_request_id;
  if found then
    if saved.course_id=p_course_id and saved.title=p_title and saved.flight_type=p_flight_type
      and saved.scenario=p_scenario and saved.occurred_at=p_occurred_at
      and saved.result_url is not distinct from p_result_url and saved.video_url is not distinct from p_video_url
      and saved.note=p_note then return saved.id;
    else raise exception 'FLIGHT_REQUEST_CONFLICT'; end if;
  end if;
  if (select count(*) from public.flight_link_submissions where user_id=p_user_id and created_at > now()-interval '10 minutes') >= 5
    or (select count(*) from public.flight_link_submissions where user_id=p_user_id and created_at > now()-interval '1 day') >= 30 then
    raise exception 'FLIGHT_RATE_LIMIT';
  end if;
  if p_occurred_at > now()+interval '5 minutes' then raise exception 'FLIGHT_INVALID_TIME'; end if;
  insert into public.flight_link_submissions(user_id,course_id,client_request_id,title,flight_type,scenario,occurred_at,result_url,video_url,note)
  values(p_user_id,p_course_id,p_request_id,p_title,p_flight_type,p_scenario,p_occurred_at,p_result_url,p_video_url,p_note)
  returning * into saved;
  return saved.id;
end;
$$;
revoke all on function public.submit_flight_link(uuid,uuid,uuid,text,text,text,timestamptz,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_flight_link(uuid,uuid,uuid,text,text,text,timestamptz,text,text,text) to service_role;
