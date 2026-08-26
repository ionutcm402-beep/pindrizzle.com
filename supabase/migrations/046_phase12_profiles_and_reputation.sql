-- Phase 12: profiles + transparent reputation.
-- Reputation is derived from existing community signals; it is not identity verification.

create or replace function public.public_profile(target_profile_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  helpful_pings integer,
  confirmations integer,
  member_since timestamptz,
  reputation_points integer,
  reputation_level text,
  next_level_points integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    pr.id as profile_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Neighbour') as display_name,
    greatest(coalesce(pr.helpful_pings, 0), 0)::integer as helpful_pings,
    greatest(coalesce(pr.confirmation_count, 0), 0)::integer as confirmations,
    pr.created_at as member_since,
    score.points as reputation_points,
    case
      when score.points >= 60 then 'Community regular'
      when score.points >= 20 then 'Local contributor'
      when score.points >= 5 then 'Active neighbour'
      else 'New neighbour'
    end as reputation_level,
    case
      when score.points >= 60 then null
      when score.points >= 20 then 60
      when score.points >= 5 then 20
      else 5
    end::integer as next_level_points
  from public.profiles pr
  cross join lateral (
    select (
      greatest(coalesce(pr.helpful_pings, 0), 0) * 3
      + greatest(coalesce(pr.confirmation_count, 0), 0)
    )::integer as points
  ) score
  where pr.id = target_profile_id
  limit 1;
$$;

revoke all on function public.public_profile(uuid) from public, anon, authenticated;
grant execute on function public.public_profile(uuid) to anon, authenticated;

create or replace function public.update_my_display_name(requested_display_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  cleaned text;
begin
  if viewer_id is null then
    raise exception 'Authentication required';
  end if;

  cleaned := regexp_replace(trim(coalesce(requested_display_name, '')), '[[:space:]]+', ' ', 'g');

  if char_length(cleaned) < 2 or char_length(cleaned) > 32 then
    raise exception 'Display name must be between 2 and 32 characters';
  end if;

  if cleaned ~ '[[:cntrl:]]' then
    raise exception 'Display name contains invalid characters';
  end if;

  if lower(cleaned) in ('ping', 'ping support', 'admin', 'administrator', 'moderator', 'staff') then
    raise exception 'That display name is reserved';
  end if;

  if lower(cleaned) like '%http://%'
     or lower(cleaned) like '%https://%'
     or lower(cleaned) like '%www.%' then
    raise exception 'Links are not allowed in display names';
  end if;

  update public.profiles
  set display_name = cleaned,
      updated_at = now()
  where id = viewer_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  return cleaned;
end;
$$;

revoke all on function public.update_my_display_name(text) from public, anon, authenticated;
grant execute on function public.update_my_display_name(text) to authenticated;

create or replace function public.ping_author_profile_context(target_ping_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  helpful_pings integer,
  confirmations integer,
  member_since timestamptz,
  reputation_points integer,
  reputation_level text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.id as profile_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Neighbour') as display_name,
    greatest(coalesce(pr.helpful_pings, 0), 0)::integer as helpful_pings,
    greatest(coalesce(pr.confirmation_count, 0), 0)::integer as confirmations,
    pr.created_at as member_since,
    score.points as reputation_points,
    case
      when score.points >= 60 then 'Community regular'
      when score.points >= 20 then 'Local contributor'
      when score.points >= 5 then 'Active neighbour'
      else 'New neighbour'
    end as reputation_level
  from public.pings p
  join public.profiles pr on pr.id = p.user_id
  cross join lateral (
    select (
      greatest(coalesce(pr.helpful_pings, 0), 0) * 3
      + greatest(coalesce(pr.confirmation_count, 0), 0)
    )::integer as points
  ) score
  where p.id = target_ping_id
    and p.status = 'active'
    and p.expires_at > now()
    and not public.ping_hidden_for_viewer(p.id, p.user_id)
  limit 1;
$$;

revoke all on function public.ping_author_profile_context(uuid) from public, anon, authenticated;
grant execute on function public.ping_author_profile_context(uuid) to anon, authenticated;
