-- Phase 13: real Ping photo storage.
-- One optional image per Ping, stored in a private bucket and served with short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ping-media',
  'ping-media',
  false,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.ping_media (
  id uuid primary key default gen_random_uuid(),
  ping_id uuid not null unique references public.pings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 6291456),
  created_at timestamptz not null default now()
);

alter table public.ping_media enable row level security;

revoke all on table public.ping_media from public, anon, authenticated;
grant select (ping_id, storage_path, mime_type) on table public.ping_media to anon, authenticated;

drop policy if exists "visible ping media is readable" on public.ping_media;
create policy "visible ping media is readable"
on public.ping_media
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.pings p
    where p.id = ping_media.ping_id
      and p.user_id = ping_media.user_id
      and p.status = 'active'
      and p.expires_at > now()
      and not public.ping_hidden_for_viewer(p.id, p.user_id)
  )
);

create or replace function public.attach_ping_media(
  target_ping_id uuid,
  object_path text,
  media_mime_type text,
  media_byte_size integer
)
returns uuid
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  viewer_id uuid := auth.uid();
  media_id uuid;
  expected_path text;
begin
  if viewer_id is null then
    raise exception 'Authentication required';
  end if;

  if media_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Unsupported image type';
  end if;
  if media_byte_size is null or media_byte_size <= 0 or media_byte_size > 6291456 then
    raise exception 'Image must be 6 MB or smaller';
  end if;

  expected_path := viewer_id::text || '/' || target_ping_id::text || '/photo';
  if object_path is distinct from expected_path then
    raise exception 'Invalid media path';
  end if;

  if not exists (
    select 1 from public.pings p
    where p.id = target_ping_id
      and p.user_id = viewer_id
      and p.status = 'active'
      and p.expires_at > now()
  ) then
    raise exception 'Ping is not available for media';
  end if;

  if exists (select 1 from public.ping_media m where m.ping_id = target_ping_id) then
    raise exception 'This Ping already has a photo';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'ping-media'
      and o.name = object_path
      and o.owner_id = viewer_id::text
  ) then
    raise exception 'Uploaded image was not found';
  end if;

  insert into public.ping_media (ping_id, user_id, storage_path, mime_type, byte_size)
  values (target_ping_id, viewer_id, object_path, media_mime_type, media_byte_size)
  returning id into media_id;

  return media_id;
end;
$$;

revoke all on function public.attach_ping_media(uuid, text, text, integer) from public, anon;
grant execute on function public.attach_ping_media(uuid, text, text, integer) to authenticated;

-- Storage upload: authenticated owners can create exactly one fixed object path per owned live Ping.
drop policy if exists "ping media owners can upload" on storage.objects;
create policy "ping media owners can upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ping-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.filename(name) = 'photo'
  and exists (
    select 1 from public.pings p
    where p.id::text = (storage.foldername(name))[2]
      and p.user_id = (select auth.uid())
      and p.status = 'active'
      and p.expires_at > now()
  )
);

-- Owners can read/delete their own object, including cleanup after a failed metadata attach.
drop policy if exists "ping media owners can read" on storage.objects;
create policy "ping media owners can read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ping-media'
  and owner_id = (select auth.uid())::text
);

drop policy if exists "ping media owners can delete" on storage.objects;
create policy "ping media owners can delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ping-media'
  and owner_id = (select auth.uid())::text
);

-- Visitors may request an authenticated object read/signed URL only when metadata
-- belongs to a currently visible Ping. The operation filter prevents bucket listing.
drop policy if exists "visible ping photos can be served" on storage.objects;
create policy "visible ping photos can be served"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'ping-media'
  and storage.allow_any_operation(array['object.get_authenticated_info', 'object.get_authenticated'])
  and exists (
    select 1
    from public.ping_media m
    join public.pings p on p.id = m.ping_id and p.user_id = m.user_id
    where m.storage_path = name
      and p.status = 'active'
      and p.expires_at > now()
      and not public.ping_hidden_for_viewer(p.id, p.user_id)
  )
);
