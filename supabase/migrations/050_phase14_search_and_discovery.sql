-- Phase 14: privacy-safe nearby search + discovery.
-- Search uses the same active/expiry/block/hide/location rules as nearby_pings().

create index if not exists pings_search_document_idx
on public.pings using gin (
  to_tsvector(
    'simple'::regconfig,
    coalesce(title, '') || ' ' || coalesce(body, '') || ' ' || coalesce(place_label, '')
  )
);

create or replace function public.search_nearby_pings(
  viewer_lat double precision,
  viewer_lng double precision,
  search_query text default '',
  category_filter public.ping_category default null,
  radius_meters integer default 1609,
  result_limit integer default 50
)
returns table(
  id uuid,
  user_id uuid,
  category public.ping_category,
  title text,
  body text,
  place_label text,
  confirmation_count integer,
  comment_count integer,
  created_at timestamptz,
  expires_at timestamptz,
  distance_meters double precision,
  search_rank real
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      st_setsrid(st_makepoint(viewer_lng, viewer_lat), 4326)::geography as viewer_location,
      least(greatest(coalesce(radius_meters, 1609), 100), 8047) as capped_radius,
      left(trim(coalesce(search_query, '')), 120) as query_text
  ),
  query_params as (
    select
      p.*,
      plainto_tsquery('simple'::regconfig, p.query_text) as query_vector
    from params p
  ),
  candidates as (
    select
      p.*,
      to_tsvector(
        'simple'::regconfig,
        coalesce(p.title, '') || ' ' || coalesce(p.body, '') || ' ' || coalesce(p.place_label, '')
      ) as search_vector,
      case
        when auth.uid() is not null and p.user_id = auth.uid() then p.location::geometry
        else st_translate(st_snaptogrid(p.location::geometry, 0.004), 0.002, 0.002)
      end as display_location
    from public.pings p
    cross join query_params v
    where p.status = 'active'
      and p.expires_at > now()
      and (category_filter is null or p.category = category_filter)
      and not public.ping_hidden_for_viewer(p.id, p.user_id)
      and st_dwithin(p.location, v.viewer_location, v.capped_radius + 1000)
  ),
  matched as (
    select
      p.*,
      case
        when v.query_text = '' then 0::real
        else ts_rank_cd(p.search_vector, v.query_vector)
      end as rank_value
    from candidates p
    cross join query_params v
    where (v.query_text = '' or p.search_vector @@ v.query_vector)
      and st_dwithin(p.display_location::geography, v.viewer_location, v.capped_radius)
  )
  select
    p.id,
    p.user_id,
    p.category,
    p.title,
    p.body,
    p.place_label,
    p.confirmation_count,
    p.comment_count,
    p.created_at,
    p.expires_at,
    st_distance(p.display_location::geography, v.viewer_location) as distance_meters,
    p.rank_value as search_rank
  from matched p
  cross join query_params v
  order by
    case when v.query_text <> '' then p.rank_value else 0 end desc,
    p.confirmation_count desc,
    p.created_at desc
  limit greatest(0, least(coalesce(result_limit, 50), 100));
$$;

revoke all on function public.search_nearby_pings(double precision,double precision,text,public.ping_category,integer,integer) from public;
grant execute on function public.search_nearby_pings(double precision,double precision,text,public.ping_category,integer,integer) to anon, authenticated;
