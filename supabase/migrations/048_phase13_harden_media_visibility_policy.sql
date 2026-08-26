-- Keep the internal block/hide helper private while exposing only the minimum
-- boolean needed by Ping media RLS.

create or replace function public.can_read_ping_media(target_ping_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pings p
    where p.id = target_ping_id
      and p.status = 'active'
      and p.expires_at > now()
      and not public.ping_hidden_for_viewer(p.id, p.user_id)
  );
$$;

revoke all on function public.can_read_ping_media(uuid) from public;
grant execute on function public.can_read_ping_media(uuid) to anon, authenticated;

drop policy if exists "visible ping media is readable" on public.ping_media;
create policy "visible ping media is readable"
on public.ping_media
for select
to anon, authenticated
using (public.can_read_ping_media(ping_id));

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
    where m.storage_path = name
  )
);
