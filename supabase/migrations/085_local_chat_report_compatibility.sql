-- Extend the existing report anti-abuse triggers so Ping and Local Chat reports
-- continue to share one report/review/moderation pipeline.

create or replace function public.validate_report_submission()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  owner_id uuid;
begin
  if auth.uid() is null or new.reporter_id <> auth.uid() then
    raise exception 'Authentication required';
  end if;

  if num_nonnulls(new.ping_id, new.chat_message_id) <> 1 then
    raise exception 'Report must target one content item';
  end if;

  if new.chat_message_id is not null then
    if new.reason not in ('incorrect','spam','harassment','dangerous','privacy','csam','other') then
      raise exception 'Invalid report reason';
    end if;
    select m.author_id into owner_id
    from public.chat_messages m
    where m.id = new.chat_message_id
      and m.deleted_at is null
      and m.retention_purged_at is null;
    if owner_id is null then raise exception 'Chat message not available'; end if;
    if owner_id = auth.uid() then raise exception 'You cannot report your own chat message'; end if;
  else
    if new.reason not in ('incorrect','spam','unsafe','harassment','dangerous','privacy','other') then
      raise exception 'Invalid report reason';
    end if;
    select p.user_id into owner_id
    from public.pings p
    where p.id = new.ping_id
      and p.status = 'active'
      and p.expires_at > now();
    if owner_id is null then raise exception 'Ping not available'; end if;
    if owner_id = auth.uid() then raise exception 'You cannot report your own Ping'; end if;
  end if;

  if (
    select count(*) from public.reports r
    where r.reporter_id = auth.uid()
      and r.created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'Report limit reached. Please try again later.';
  end if;

  new.details := left(nullif(btrim(coalesce(new.details,'')),''),500);
  return new;
end;
$function$;

create or replace function public.hide_reported_ping_for_reporter()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  if new.chat_message_id is not null then
    insert into public.chat_message_hides(user_id,chat_message_id,reason)
    values(new.reporter_id,new.chat_message_id,'reported')
    on conflict(user_id,chat_message_id)
    do update set reason=excluded.reason, created_at=now();
  elsif new.ping_id is not null then
    insert into public.ping_hides(user_id,ping_id,reason)
    values(new.reporter_id,new.ping_id,'reported')
    on conflict(user_id,ping_id)
    do update set reason=excluded.reason, created_at=now();
  end if;
  return new;
end;
$function$;
