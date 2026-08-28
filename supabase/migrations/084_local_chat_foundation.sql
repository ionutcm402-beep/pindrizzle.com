-- Local Chat: radius-scoped public group chat for authenticated users.
-- Messages use an approximate snapped point; exact device coordinates are not stored on chat messages.
-- 90-day retention is enforced by a daily pg_cron job, except while a report remains pending review.

create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists pindrizzle_private;
revoke all on schema pindrizzle_private from public, anon, authenticated;
grant usage on schema pindrizzle_private to authenticated;

create table if not exists public.chat_viewer_scopes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  location geography(Point,4326) not null,
  radius_meters integer not null check (radius_meters in (805,1609,4828,8047)),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  location geography(Point,4326),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  edited_at timestamptz,
  moderation_reason text,
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null,
  retention_purged_at timestamptz,
  constraint chat_messages_body_length_check check (char_length(btrim(body)) between 1 and 500)
);

create table if not exists public.chat_message_hides (
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_message_id uuid not null references public.chat_messages(id) on delete cascade,
  reason text not null default 'reported',
  created_at timestamptz not null default now(),
  primary key (user_id, chat_message_id)
);

create index if not exists chat_messages_location_gix on public.chat_messages using gist(location);
create index if not exists chat_messages_created_idx on public.chat_messages(created_at desc, id desc);
create index if not exists chat_messages_author_created_idx on public.chat_messages(author_id, created_at desc);
create index if not exists chat_message_hides_message_idx on public.chat_message_hides(chat_message_id);

alter table public.chat_viewer_scopes enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_hides enable row level security;

revoke all on table public.chat_viewer_scopes from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;
revoke all on table public.chat_message_hides from anon, authenticated;
grant select on table public.chat_messages to authenticated;
grant update(body, deleted_at) on table public.chat_messages to authenticated;
grant select on table public.chat_message_hides to authenticated;

drop policy if exists "users read own chat hides" on public.chat_message_hides;
create policy "users read own chat hides"
on public.chat_message_hides for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function pindrizzle_private.chat_hidden_for_viewer(target_message_id uuid, target_author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
  select auth.uid() is not null and (
    exists (
      select 1 from public.chat_message_hides h
      where h.user_id = auth.uid() and h.chat_message_id = target_message_id
    )
    or exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = target_author_id)
         or (b.blocker_id = target_author_id and b.blocked_id = auth.uid())
    )
  );
$function$;

create or replace function pindrizzle_private.chat_visible_to_current_viewer(
  target_message_id uuid,
  target_author_id uuid,
  target_location geography
)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $function$
  select auth.uid() is not null
    and target_author_id is not null
    and target_location is not null
    and exists (
      select 1
      from public.chat_viewer_scopes s
      where s.user_id = auth.uid()
        and s.updated_at > now() - interval '15 minutes'
        and st_dwithin(target_location, s.location, s.radius_meters)
    )
    and not pindrizzle_private.chat_hidden_for_viewer(target_message_id, target_author_id);
$function$;

revoke all on function pindrizzle_private.chat_hidden_for_viewer(uuid,uuid) from public, anon, authenticated;
revoke all on function pindrizzle_private.chat_visible_to_current_viewer(uuid,uuid,geography) from public, anon, authenticated;
grant execute on function pindrizzle_private.chat_hidden_for_viewer(uuid,uuid) to authenticated;
grant execute on function pindrizzle_private.chat_visible_to_current_viewer(uuid,uuid,geography) to authenticated;

drop policy if exists "authenticated read local chat" on public.chat_messages;
create policy "authenticated read local chat"
on public.chat_messages for select
to authenticated
using (
  deleted_at is null
  and retention_purged_at is null
  and pindrizzle_private.chat_visible_to_current_viewer(id, author_id, location)
);

drop policy if exists "authors edit recent chat messages" on public.chat_messages;
create policy "authors edit recent chat messages"
on public.chat_messages for update
to authenticated
using (
  (select auth.uid()) = author_id
  and deleted_at is null
  and retention_purged_at is null
  and created_at > now() - interval '5 minutes'
)
with check (
  (select auth.uid()) = author_id
  and retention_purged_at is null
  and created_at > now() - interval '5 minutes'
);

create or replace function pindrizzle_private.guard_chat_message_update()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  if new.body is distinct from old.body then
    new.body := btrim(new.body);
    new.edited_at := now();
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    if old.deleted_at is not null or new.deleted_at is null then
      raise exception 'Deleted chat messages cannot be restored';
    end if;
    new.deleted_at := now();
  end if;
  return new;
end;
$function$;

revoke all on function pindrizzle_private.guard_chat_message_update() from public, anon, authenticated;
drop trigger if exists chat_message_update_guard on public.chat_messages;
create trigger chat_message_update_guard
before update on public.chat_messages
for each row execute function pindrizzle_private.guard_chat_message_update();

create or replace function public.chat_set_viewer_scope(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer
)
returns boolean
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  snapped geography;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if viewer_lat is null or viewer_lat < -90 or viewer_lat > 90 or viewer_lng is null or viewer_lng < -180 or viewer_lng > 180 then
    raise exception 'Location is unavailable';
  end if;
  if radius_meters not in (805,1609,4828,8047) then
    raise exception 'Unsupported chat radius';
  end if;

  snapped := st_snaptogrid(st_setsrid(st_makepoint(viewer_lng, viewer_lat),4326), 0.004)::geography;
  insert into public.chat_viewer_scopes(user_id, location, radius_meters, updated_at)
  values (auth.uid(), snapped, radius_meters, now())
  on conflict (user_id) do update
    set location = excluded.location,
        radius_meters = excluded.radius_meters,
        updated_at = now();
  return true;
end;
$function$;

revoke all on function public.chat_set_viewer_scope(double precision,double precision,integer) from public, anon;
grant execute on function public.chat_set_viewer_scope(double precision,double precision,integer) to authenticated;

create or replace function public.nearby_chat_messages(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer default 1609,
  before_created_at timestamptz default null,
  before_id uuid default null,
  result_limit integer default 40
)
returns table(
  id uuid,
  author_id uuid,
  display_name text,
  body text,
  created_at timestamptz,
  edited_at timestamptz,
  distance_meters double precision
)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  viewer_location geography;
  capped_limit integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.chat_set_viewer_scope(viewer_lat, viewer_lng, radius_meters);
  viewer_location := st_snaptogrid(st_setsrid(st_makepoint(viewer_lng, viewer_lat),4326), 0.004)::geography;
  capped_limit := greatest(1, least(coalesce(result_limit,40),60));

  return query
  select m.id,
         m.author_id,
         coalesce(nullif(btrim(p.display_name),''),'Neighbour') as display_name,
         m.body,
         m.created_at,
         m.edited_at,
         st_distance(m.location, viewer_location) as distance_meters
  from public.chat_messages m
  left join public.profiles p on p.id = m.author_id
  where m.author_id is not null
    and m.deleted_at is null
    and m.retention_purged_at is null
    and m.location is not null
    and st_dwithin(m.location, viewer_location, radius_meters)
    and not pindrizzle_private.chat_hidden_for_viewer(m.id, m.author_id)
    and (
      before_created_at is null
      or m.created_at < before_created_at
      or (m.created_at = before_created_at and before_id is not null and m.id < before_id)
    )
  order by m.created_at desc, m.id desc
  limit capped_limit;
end;
$function$;

revoke all on function public.nearby_chat_messages(double precision,double precision,integer,timestamptz,uuid,integer) from public, anon;
grant execute on function public.nearby_chat_messages(double precision,double precision,integer,timestamptz,uuid,integer) to authenticated;

create or replace function public.post_chat_message(
  message_body text,
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters integer default 1609
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  clean_body text;
  message_id uuid;
  snapped geography;
  compact_phone text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.chat_set_viewer_scope(viewer_lat, viewer_lng, radius_meters);
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 92837));

  clean_body := btrim(coalesce(message_body,''));
  if char_length(clean_body) = 0 then raise exception 'Write a message before sending.'; end if;
  if char_length(clean_body) > 500 then raise exception 'Chat messages can be up to 500 characters.'; end if;

  if clean_body ~* '^(https?://[^[:space:]]+|www[.][^[:space:]]+)$'
     or clean_body ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$' then
    raise exception 'Add some context instead of sending only a link or email address.';
  end if;
  compact_phone := regexp_replace(clean_body, '[^0-9+]', '', 'g');
  if clean_body !~ '[[:alpha:]]' and compact_phone ~ '^[+]?[0-9]{7,15}$' then
    raise exception 'Add some context instead of sending only a phone number.';
  end if;

  if exists (
    select 1 from public.chat_messages m
    where m.author_id = auth.uid()
      and m.created_at > now() - interval '5 seconds'
  ) then
    raise exception 'CHAT_RATE_LIMIT: Wait a few seconds before sending another message.';
  end if;

  if exists (
    select 1 from public.chat_messages m
    where m.author_id = auth.uid()
      and m.created_at > now() - interval '60 seconds'
      and lower(btrim(m.body)) = lower(clean_body)
  ) then
    raise exception 'Please do not repeat the same message.';
  end if;

  snapped := st_snaptogrid(st_setsrid(st_makepoint(viewer_lng, viewer_lat),4326), 0.004)::geography;
  insert into public.chat_messages(author_id, body, location)
  values (auth.uid(), clean_body, snapped)
  returning id into message_id;
  return message_id;
end;
$function$;

revoke all on function public.post_chat_message(text,double precision,double precision,integer) from public, anon;
grant execute on function public.post_chat_message(text,double precision,double precision,integer) to authenticated;

alter table public.reports add column if not exists chat_message_id uuid references public.chat_messages(id) on delete cascade;

alter table public.reports drop constraint if exists reports_one_content_target_check;
alter table public.reports add constraint reports_one_content_target_check
  check (num_nonnulls(ping_id, chat_message_id) = 1);

create unique index if not exists reports_chat_message_reporter_key
  on public.reports(chat_message_id, reporter_id)
  where chat_message_id is not null;
create index if not exists reports_chat_message_created_idx
  on public.reports(chat_message_id, created_at desc)
  where chat_message_id is not null;

create or replace function public.report_chat_message(
  target_chat_message_id uuid,
  report_reason text,
  report_details text default ''
)
returns table(report_id uuid, hidden boolean)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  owner_id uuid;
  existing_report_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if report_reason not in ('incorrect','spam','harassment','dangerous','privacy','csam','other') then
    raise exception 'Invalid report reason';
  end if;

  select m.author_id into owner_id
  from public.chat_messages m
  where m.id = target_chat_message_id
    and m.deleted_at is null
    and m.retention_purged_at is null;

  if owner_id is null then raise exception 'Chat message not available'; end if;
  if owner_id = auth.uid() then raise exception 'You cannot report your own chat message'; end if;

  if (
    select count(*) from public.reports r
    where r.reporter_id = auth.uid()
      and r.created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'Report limit reached. Please try again later.';
  end if;

  insert into public.reports(chat_message_id, reporter_id, reason, details)
  values (target_chat_message_id, auth.uid(), report_reason, left(nullif(btrim(report_details),''),500))
  on conflict (chat_message_id, reporter_id) where chat_message_id is not null
  do update set reason = excluded.reason, details = excluded.details, created_at = now()
  returning id into existing_report_id;

  insert into public.chat_message_hides(user_id, chat_message_id, reason)
  values (auth.uid(), target_chat_message_id, 'reported')
  on conflict (user_id, chat_message_id)
  do update set reason = excluded.reason, created_at = now();

  report_id := existing_report_id;
  hidden := true;
  return next;
end;
$function$;

revoke all on function public.report_chat_message(uuid,text,text) from public, anon;
grant execute on function public.report_chat_message(uuid,text,text) to authenticated;

create or replace function public.moderation_content_cases()
returns table(
  target_type text,
  target_id uuid,
  content_title text,
  content_body text,
  content_status text,
  content_owner_name text,
  pending_reports bigint,
  total_reports bigint,
  reasons text[],
  oldest_reported_at timestamptz,
  latest_reported_at timestamptz,
  priority_score integer,
  priority_label text,
  latest_details text
)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  if not public.is_moderator() then raise exception 'Moderator access required'; end if;

  return query
  with pending as (
    select case when r.chat_message_id is not null then 'chat_message' else 'ping' end as target_type,
           coalesce(r.chat_message_id, r.ping_id) as target_id,
           count(*)::bigint as pending_reports,
           min(r.created_at) as oldest_reported_at,
           max(r.created_at) as latest_reported_at,
           array_agg(distinct r.reason order by r.reason) as reasons,
           max(case r.reason
             when 'csam' then 100
             when 'dangerous' then 65
             when 'unsafe' then 55
             when 'harassment' then 40
             when 'privacy' then 40
             when 'spam' then 25
             when 'incorrect' then 15
             else 10
           end)::integer as base_priority
    from public.reports r
    left join public.report_reviews rr on rr.report_id = r.id
    where rr.report_id is null
    group by 1,2
  ), scored as (
    select p.*,
           least(100, p.base_priority + least(greatest(p.pending_reports - 1,0) * 8,24)::integer + least(floor(extract(epoch from (now()-p.oldest_reported_at))/3600),12)::integer)::integer as score
    from pending p
  )
  select s.target_type,
         s.target_id,
         case when s.target_type='chat_message' then 'Local Chat message' else p.title end,
         case when s.target_type='chat_message' then cm.body else p.body end,
         case when s.target_type='chat_message' then case when cm.deleted_at is null then 'active' else 'removed' end else p.status::text end,
         coalesce(owner_profile.display_name,'Neighbour'),
         s.pending_reports,
         (select count(*) from public.reports r2 where (s.target_type='chat_message' and r2.chat_message_id=s.target_id) or (s.target_type='ping' and r2.ping_id=s.target_id)),
         s.reasons,
         s.oldest_reported_at,
         s.latest_reported_at,
         s.score,
         case when 'csam'=any(s.reasons) then 'critical' when s.score>=60 then 'urgent' when s.score>=35 then 'elevated' else 'standard' end,
         (select left(nullif(btrim(r3.details),''),500)
          from public.reports r3 left join public.report_reviews rr3 on rr3.report_id=r3.id
          where rr3.report_id is null and ((s.target_type='chat_message' and r3.chat_message_id=s.target_id) or (s.target_type='ping' and r3.ping_id=s.target_id))
          order by r3.created_at desc limit 1)
  from scored s
  left join public.pings p on s.target_type='ping' and p.id=s.target_id
  left join public.chat_messages cm on s.target_type='chat_message' and cm.id=s.target_id
  left join public.profiles owner_profile on owner_profile.id=case when s.target_type='chat_message' then cm.author_id else p.user_id end
  where (s.target_type='ping' and p.status='active')
     or (s.target_type='chat_message' and cm.deleted_at is null and cm.retention_purged_at is null)
  order by case when 'csam'=any(s.reasons) then 0 else 1 end, s.score desc, s.oldest_reported_at asc;
end;
$function$;

create or replace function public.moderation_content_history(result_limit integer default 100)
returns table(
  target_type text,
  target_id uuid,
  content_title text,
  content_body text,
  content_status text,
  content_owner_name text,
  reports_on_target bigint,
  reviewed_reports bigint,
  case_status text,
  reviewed_at timestamptz,
  reviewed_by_name text,
  review_notes text
)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  if not public.is_moderator() then raise exception 'Moderator access required'; end if;

  return query
  with grouped as (
    select case when r.chat_message_id is not null then 'chat_message' else 'ping' end as target_type,
           coalesce(r.chat_message_id,r.ping_id) as target_id,
           count(*)::bigint as reviewed_reports,
           bool_or(rr.status='actioned') as any_actioned,
           max(rr.reviewed_at) as last_reviewed_at
    from public.reports r join public.report_reviews rr on rr.report_id=r.id
    group by 1,2
  ), latest_review as (
    select distinct on (case when r.chat_message_id is not null then 'chat_message' else 'ping' end, coalesce(r.chat_message_id,r.ping_id))
           case when r.chat_message_id is not null then 'chat_message' else 'ping' end as target_type,
           coalesce(r.chat_message_id,r.ping_id) as target_id,
           rr.reviewed_at, rr.reviewed_by, rr.notes
    from public.reports r join public.report_reviews rr on rr.report_id=r.id
    order by case when r.chat_message_id is not null then 'chat_message' else 'ping' end, coalesce(r.chat_message_id,r.ping_id), rr.reviewed_at desc, r.id
  )
  select g.target_type,
         g.target_id,
         case when g.target_type='chat_message' then 'Local Chat message' else p.title end,
         case when g.target_type='chat_message' then cm.body else p.body end,
         case when g.target_type='chat_message' then case when cm.retention_purged_at is not null then 'expired' when cm.deleted_at is not null then 'removed' else 'active' end else p.status::text end,
         coalesce(owner_profile.display_name,'Neighbour'),
         (select count(*) from public.reports r2 where (g.target_type='chat_message' and r2.chat_message_id=g.target_id) or (g.target_type='ping' and r2.ping_id=g.target_id)),
         g.reviewed_reports,
         case when g.any_actioned then 'removed' else 'dismissed' end,
         lr.reviewed_at,
         coalesce(reviewer_profile.display_name,'Moderator'),
         lr.notes
  from grouped g
  join latest_review lr on lr.target_type=g.target_type and lr.target_id=g.target_id
  left join public.pings p on g.target_type='ping' and p.id=g.target_id
  left join public.chat_messages cm on g.target_type='chat_message' and cm.id=g.target_id
  left join public.profiles owner_profile on owner_profile.id=case when g.target_type='chat_message' then cm.author_id else p.user_id end
  left join public.profiles reviewer_profile on reviewer_profile.id=lr.reviewed_by
  order by g.last_reviewed_at desc
  limit least(greatest(coalesce(result_limit,100),1),200);
end;
$function$;

create or replace function public.moderate_content_case(
  target_type text,
  target_id uuid,
  moderation_action text,
  moderation_notes text
)
returns integer
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  clean_notes text;
  reviewed_count integer;
begin
  if not public.is_moderator() then raise exception 'Moderator access required'; end if;
  if target_type not in ('ping','chat_message') then raise exception 'Invalid content type'; end if;
  if moderation_action not in ('dismiss','remove') then raise exception 'Invalid moderation action'; end if;
  clean_notes := left(nullif(btrim(moderation_notes),''),500);
  if clean_notes is null or char_length(clean_notes)<4 then raise exception 'Moderator notes are required'; end if;

  if target_type='ping' then
    return public.moderate_ping_case(target_id, moderation_action, clean_notes);
  end if;

  if not exists (select 1 from public.chat_messages m where m.id=target_id and m.deleted_at is null and m.retention_purged_at is null) then
    raise exception 'Chat message not found';
  end if;

  if moderation_action='remove' then
    update public.chat_messages
    set deleted_at=now(), moderation_reason=clean_notes, moderated_at=now(), moderated_by=auth.uid()
    where id=target_id and deleted_at is null and retention_purged_at is null;
  end if;

  insert into public.report_reviews(report_id,status,reviewed_by,reviewed_at,notes)
  select r.id, case when moderation_action='remove' then 'actioned' else 'dismissed' end, auth.uid(), now(), clean_notes
  from public.reports r
  left join public.report_reviews rr on rr.report_id=r.id
  where r.chat_message_id=target_id and rr.report_id is null
  on conflict (report_id) do nothing;

  get diagnostics reviewed_count = row_count;
  if reviewed_count=0 then raise exception 'No pending reports for this chat message'; end if;
  return reviewed_count;
end;
$function$;

create or replace function public.my_chat_moderation_notices(result_limit integer default 10)
returns table(message_id uuid, message_excerpt text, moderation_reason text, moderated_at timestamptz)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
  select m.id, left(m.body,120), m.moderation_reason, m.moderated_at
  from public.chat_messages m
  where m.author_id=auth.uid()
    and m.moderation_reason is not null
    and m.moderated_at is not null
    and m.retention_purged_at is null
  order by m.moderated_at desc
  limit least(greatest(coalesce(result_limit,10),1),20);
end;
$function$;

revoke all on function public.moderation_content_cases() from public, anon;
revoke all on function public.moderation_content_history(integer) from public, anon;
revoke all on function public.moderate_content_case(text,uuid,text,text) from public, anon;
revoke all on function public.my_chat_moderation_notices(integer) from public, anon;
grant execute on function public.moderation_content_cases() to authenticated;
grant execute on function public.moderation_content_history(integer) to authenticated;
grant execute on function public.moderate_content_case(text,uuid,text,text) to authenticated;
grant execute on function public.my_chat_moderation_notices(integer) to authenticated;

create or replace function public.purge_expired_chat_messages()
returns integer
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  purged integer;
begin
  update public.chat_messages m
  set body='[expired after 90 days]',
      location=null,
      author_id=null,
      deleted_at=coalesce(m.deleted_at,now()),
      moderation_reason=null,
      moderated_at=null,
      moderated_by=null,
      retention_purged_at=now()
  where m.retention_purged_at is null
    and m.created_at < now() - interval '90 days'
    and not exists (
      select 1 from public.reports r
      left join public.report_reviews rr on rr.report_id=r.id
      where r.chat_message_id=m.id and rr.report_id is null
    );
  get diagnostics purged = row_count;

  delete from public.chat_viewer_scopes where updated_at < now() - interval '2 hours';
  return purged;
end;
$function$;

revoke all on function public.purge_expired_chat_messages() from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname='pindrizzle-chat-retention-90d';
select cron.schedule('pindrizzle-chat-retention-90d','17 3 * * *',$cron$select public.purge_expired_chat_messages();$cron$);

alter table public.product_events drop constraint if exists product_events_event_type_check;
alter table public.product_events add constraint product_events_event_type_check check (event_type = any(array[
  'session_start','feed_view','map_view','search_view','place_view','alerts_view','you_view','promote_view','business_view','ping_open',
  'onboarding_complete','onboarding_skip','return_visit','location_enabled','quiet_feed_seen','quiet_expand_radius','quiet_open_map','quiet_create_ping',
  'chat_view','chat_message_sent','chat_message_reported','chat_user_blocked'
]::text[]));

create or replace function public.record_product_event(target_event_type text, browser_session uuid)
returns boolean
language plpgsql
security definer
set search_path = 'public'
as $function$
begin
  if browser_session is null then raise exception 'Missing browser session'; end if;
  if target_event_type not in (
    'session_start','feed_view','map_view','search_view','place_view','alerts_view','you_view','promote_view','business_view','ping_open',
    'onboarding_complete','onboarding_skip','return_visit','location_enabled','quiet_feed_seen','quiet_expand_radius','quiet_open_map','quiet_create_ping',
    'chat_view','chat_message_sent','chat_message_reported','chat_user_blocked'
  ) then raise exception 'Unsupported analytics event'; end if;

  insert into public.product_events(browser_session_id,event_type,signed_in)
  values(browser_session,target_event_type,auth.uid() is not null)
  on conflict(browser_session_id,event_type) do update
    set signed_in=public.product_events.signed_in or excluded.signed_in;

  if target_event_type='session_start' then
    delete from public.product_events where created_at < now() - interval '90 days';
  end if;
  return true;
end;
$function$;

do $do$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$do$;
