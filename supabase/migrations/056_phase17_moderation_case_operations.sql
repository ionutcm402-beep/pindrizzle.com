create index if not exists reports_ping_created_idx
  on public.reports (ping_id, created_at desc);

create index if not exists report_reviews_reviewed_at_idx
  on public.report_reviews (reviewed_at desc);

create or replace function public.moderation_report_cases()
returns table(
  ping_id uuid,
  ping_title text,
  ping_body text,
  ping_status public.ping_status,
  ping_owner_name text,
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
set search_path to 'public'
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  return query
  with pending as (
    select
      r.ping_id,
      count(*)::bigint as pending_reports,
      min(r.created_at) as oldest_reported_at,
      max(r.created_at) as latest_reported_at,
      array_agg(distinct r.reason order by r.reason) as reasons,
      max(case r.reason
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
    group by r.ping_id
  ), latest_pending as (
    select distinct on (r.ping_id)
      r.ping_id,
      left(nullif(trim(r.details), ''), 500) as latest_details
    from public.reports r
    left join public.report_reviews rr on rr.report_id = r.id
    where rr.report_id is null
    order by r.ping_id, r.created_at desc
  ), scored as (
    select
      pe.*,
      least(
        100,
        pe.base_priority
        + least(greatest(pe.pending_reports - 1, 0) * 8, 24)::integer
        + least(floor(extract(epoch from (now() - pe.oldest_reported_at)) / 3600), 12)::integer
      )::integer as priority_score
    from pending pe
  )
  select
    p.id,
    p.title,
    p.body,
    p.status,
    coalesce(owner_profile.display_name, 'Neighbour'),
    s.pending_reports,
    (select count(*) from public.reports all_reports where all_reports.ping_id = p.id),
    s.reasons,
    s.oldest_reported_at,
    s.latest_reported_at,
    s.priority_score,
    case
      when s.priority_score >= 60 then 'urgent'
      when s.priority_score >= 35 then 'elevated'
      else 'standard'
    end,
    lp.latest_details
  from scored s
  join public.pings p on p.id = s.ping_id
  left join public.profiles owner_profile on owner_profile.id = p.user_id
  left join latest_pending lp on lp.ping_id = p.id
  where p.status = 'active'
  order by s.priority_score desc, s.oldest_reported_at asc;
end;
$$;

create or replace function public.moderation_case_history(result_limit integer default 100)
returns table(
  ping_id uuid,
  ping_title text,
  ping_body text,
  ping_status public.ping_status,
  ping_owner_name text,
  reports_on_ping bigint,
  reviewed_reports bigint,
  case_status text,
  reviewed_at timestamptz,
  reviewed_by_name text,
  review_notes text
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  return query
  with grouped as (
    select
      r.ping_id,
      count(*)::bigint as reviewed_reports,
      bool_or(rr.status = 'actioned') as any_actioned,
      max(rr.reviewed_at) as last_reviewed_at
    from public.reports r
    join public.report_reviews rr on rr.report_id = r.id
    group by r.ping_id
  ), latest_review as (
    select distinct on (r.ping_id)
      r.ping_id,
      rr.reviewed_at,
      rr.reviewed_by,
      rr.notes
    from public.reports r
    join public.report_reviews rr on rr.report_id = r.id
    order by r.ping_id, rr.reviewed_at desc, r.id
  )
  select
    p.id,
    p.title,
    p.body,
    p.status,
    coalesce(owner_profile.display_name, 'Neighbour'),
    (select count(*) from public.reports all_reports where all_reports.ping_id = p.id),
    g.reviewed_reports,
    case when g.any_actioned then 'removed' else 'dismissed' end,
    lr.reviewed_at,
    coalesce(reviewer_profile.display_name, 'Moderator'),
    lr.notes
  from grouped g
  join public.pings p on p.id = g.ping_id
  left join public.profiles owner_profile on owner_profile.id = p.user_id
  join latest_review lr on lr.ping_id = p.id
  left join public.profiles reviewer_profile on reviewer_profile.id = lr.reviewed_by
  order by g.last_reviewed_at desc
  limit least(greatest(coalesce(result_limit, 100), 1), 200);
end;
$$;

create or replace function public.moderate_ping_case(
  target_ping_id uuid,
  moderation_action text,
  moderation_notes text
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  reviewed_count integer := 0;
  current_status public.ping_status;
  clean_notes text;
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  if moderation_action not in ('dismiss', 'remove') then
    raise exception 'Invalid moderation action';
  end if;

  clean_notes := left(nullif(trim(moderation_notes), ''), 500);
  if clean_notes is null or char_length(clean_notes) < 4 then
    raise exception 'Moderator notes are required';
  end if;

  select p.status into current_status
  from public.pings p
  where p.id = target_ping_id
  for update;

  if current_status is null then
    raise exception 'Ping not found';
  end if;

  if moderation_action = 'remove' and current_status = 'active' then
    update public.pings
    set status = 'removed', updated_at = now()
    where id = target_ping_id;
  end if;

  insert into public.report_reviews (report_id, status, reviewed_by, reviewed_at, notes)
  select
    r.id,
    case when moderation_action = 'remove' then 'actioned' else 'dismissed' end,
    auth.uid(),
    now(),
    clean_notes
  from public.reports r
  left join public.report_reviews rr on rr.report_id = r.id
  where r.ping_id = target_ping_id
    and rr.report_id is null
  on conflict (report_id) do nothing;

  get diagnostics reviewed_count = row_count;
  if reviewed_count = 0 then
    raise exception 'No pending reports for this Ping';
  end if;

  return reviewed_count;
end;
$$;

revoke all on function public.moderation_report_cases() from public, anon;
grant execute on function public.moderation_report_cases() to authenticated;

revoke all on function public.moderation_case_history(integer) from public, anon;
grant execute on function public.moderation_case_history(integer) to authenticated;

revoke all on function public.moderate_ping_case(uuid,text,text) from public, anon;
grant execute on function public.moderate_ping_case(uuid,text,text) to authenticated;
