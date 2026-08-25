create or replace function public.moderation_report_history()
returns table (
  report_id uuid,
  ping_id uuid,
  reason text,
  details text,
  reported_at timestamptz,
  ping_title text,
  ping_body text,
  ping_status public.ping_status,
  ping_owner_name text,
  reporter_name text,
  reports_on_ping bigint,
  review_status text,
  reviewed_at timestamptz,
  reviewed_by_name text,
  review_notes text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  return query
  select
    r.id,
    r.ping_id,
    r.reason,
    r.details,
    r.created_at,
    p.title,
    p.body,
    p.status,
    coalesce(owner_profile.display_name, 'Neighbour'),
    coalesce(reporter_profile.display_name, 'Neighbour'),
    (select count(*) from public.reports r2 where r2.ping_id = r.ping_id),
    case
      when rr.status = 'dismissed' then 'dismissed'
      when rr.status = 'actioned' then 'removed'
      else 'pending'
    end,
    rr.reviewed_at,
    coalesce(reviewer_profile.display_name, ''),
    rr.notes
  from public.reports r
  join public.pings p on p.id = r.ping_id
  left join public.profiles owner_profile on owner_profile.id = p.user_id
  left join public.profiles reporter_profile on reporter_profile.id = r.reporter_id
  left join public.report_reviews rr on rr.report_id = r.id
  left join public.profiles reviewer_profile on reviewer_profile.id = rr.reviewed_by
  order by
    case when rr.report_id is null then 0 else 1 end,
    coalesce(rr.reviewed_at, r.created_at) desc;
end;
$$;

revoke all on function public.moderation_report_history() from public, anon;
grant execute on function public.moderation_report_history() to authenticated;
