create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash bytea not null unique,
  label text not null check (char_length(label) between 1 and 80),
  max_uses integer not null default 1 check (max_uses between 1 and 50),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.beta_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null check (source in ('grandfathered','invite','moderator')),
  invite_id uuid references public.beta_invites(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('bug','idea','confusing','praise','other')),
  message text not null check (char_length(message) between 10 and 2000),
  page_path text check (page_path is null or (char_length(page_path) <= 160 and page_path ~ '^/')),
  rating smallint check (rating is null or rating between 1 and 5),
  status text not null default 'new' check (status in ('new','reviewed','planned','resolved','dismissed')),
  moderator_note text check (moderator_note is null or char_length(moderator_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists beta_feedback_user_created_idx on public.beta_feedback(user_id, created_at desc);
create index if not exists beta_feedback_status_created_idx on public.beta_feedback(status, created_at desc);
create index if not exists beta_invites_active_expiry_idx on public.beta_invites(active, expires_at);

alter table public.beta_invites enable row level security;
alter table public.beta_access enable row level security;
alter table public.beta_feedback enable row level security;

revoke all on public.beta_invites from anon, authenticated;
revoke all on public.beta_access from anon, authenticated;
revoke all on public.beta_feedback from anon, authenticated;

grant select on public.beta_access to authenticated;
grant select on public.beta_feedback to authenticated;
grant update (status, moderator_note, updated_at, resolved_at) on public.beta_feedback to authenticated;

create policy "users read own beta access" on public.beta_access for select to authenticated using (user_id = auth.uid());
create policy "moderators read beta access" on public.beta_access for select to authenticated using (public.is_moderator());
create policy "users read own beta feedback" on public.beta_feedback for select to authenticated using (user_id = auth.uid());
create policy "moderators read beta feedback" on public.beta_feedback for select to authenticated using (public.is_moderator());
create policy "moderators update beta feedback" on public.beta_feedback for update to authenticated using (public.is_moderator()) with check (public.is_moderator());

insert into public.beta_access (user_id, source)
select id, 'grandfathered' from auth.users
on conflict (user_id) do nothing;

create or replace function public.my_beta_state()
returns table(has_access boolean, access_source text, granted_at timestamptz)
language sql security definer set search_path = public, pg_temp as $$
  select
    exists(select 1 from public.beta_access b where b.user_id = auth.uid() and b.revoked_at is null),
    (select b.source from public.beta_access b where b.user_id = auth.uid() and b.revoked_at is null limit 1),
    (select b.granted_at from public.beta_access b where b.user_id = auth.uid() and b.revoked_at is null limit 1);
$$;
revoke all on function public.my_beta_state() from public, anon;
grant execute on function public.my_beta_state() to authenticated;

create or replace function public.redeem_beta_invite(invite_code text)
returns boolean
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  uid uuid := auth.uid();
  normalized text := upper(trim(invite_code));
  target public.beta_invites%rowtype;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if exists(select 1 from public.beta_access where user_id = uid and revoked_at is null) then return true; end if;
  if normalized !~ '^PING-[A-Z0-9]{10,32}$' then raise exception 'Invalid beta invite'; end if;
  select * into target from public.beta_invites
  where code_hash = digest(normalized, 'sha256') and active = true and expires_at > now() and use_count < max_uses
  for update;
  if target.id is null then raise exception 'Invite is invalid, expired, or fully used'; end if;
  insert into public.beta_access(user_id, source, invite_id)
  values (uid, 'invite', target.id)
  on conflict (user_id) do update set source = 'invite', invite_id = excluded.invite_id, granted_at = now(), revoked_at = null;
  update public.beta_invites set use_count = use_count + 1 where id = target.id;
  return true;
end;
$$;
revoke all on function public.redeem_beta_invite(text) from public, anon;
grant execute on function public.redeem_beta_invite(text) to authenticated;

create or replace function public.submit_beta_feedback(feedback_kind text, feedback_message text, feedback_page text default null, feedback_rating integer default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  clean_message text := trim(feedback_message);
  clean_page text := nullif(trim(feedback_page), '');
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists(select 1 from public.beta_access where user_id = uid and revoked_at is null) then raise exception 'Closed beta access required' using errcode = '42501'; end if;
  if feedback_kind not in ('bug','idea','confusing','praise','other') then raise exception 'Invalid feedback type'; end if;
  if char_length(clean_message) < 10 or char_length(clean_message) > 2000 then raise exception 'Feedback must be 10 to 2000 characters'; end if;
  if clean_page is not null and (char_length(clean_page) > 160 or clean_page !~ '^/') then raise exception 'Invalid page path'; end if;
  if feedback_rating is not null and (feedback_rating < 1 or feedback_rating > 5) then raise exception 'Rating must be between 1 and 5'; end if;
  if (select count(*) from public.beta_feedback where user_id = uid and created_at > now() - interval '24 hours') >= 20 then raise exception 'Feedback limit reached for today'; end if;
  insert into public.beta_feedback(user_id, feedback_type, message, page_path, rating)
  values(uid, feedback_kind, clean_message, clean_page, feedback_rating) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.submit_beta_feedback(text,text,text,integer) from public, anon;
grant execute on function public.submit_beta_feedback(text,text,text,integer) to authenticated;

create or replace function public.create_beta_invite(invite_label text, invite_max_uses integer default 1, valid_days integer default 30)
returns table(invite_code text, expires_at timestamptz)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  code text;
  expiry timestamptz;
begin
  if not public.is_moderator() then raise exception 'Moderator access required' using errcode = '42501'; end if;
  if char_length(trim(invite_label)) < 1 or char_length(trim(invite_label)) > 80 then raise exception 'Invite label must be 1 to 80 characters'; end if;
  if invite_max_uses < 1 or invite_max_uses > 50 then raise exception 'Invite uses must be between 1 and 50'; end if;
  if valid_days < 1 or valid_days > 90 then raise exception 'Invite validity must be between 1 and 90 days'; end if;
  code := 'PING-' || upper(encode(gen_random_bytes(8), 'hex'));
  expiry := now() + make_interval(days => valid_days);
  insert into public.beta_invites(code_hash, label, max_uses, expires_at, created_by)
  values(digest(code, 'sha256'), trim(invite_label), invite_max_uses, expiry, auth.uid());
  return query select code, expiry;
end;
$$;
revoke all on function public.create_beta_invite(text,integer,integer) from public, anon;
grant execute on function public.create_beta_invite(text,integer,integer) to authenticated;

create or replace function public.beta_admin_invites()
returns table(id uuid, label text, max_uses integer, use_count integer, expires_at timestamptz, active boolean, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_moderator() then raise exception 'Moderator access required' using errcode = '42501'; end if;
  return query select b.id,b.label,b.max_uses,b.use_count,b.expires_at,b.active,b.created_at from public.beta_invites b order by b.created_at desc limit 100;
end;
$$;
revoke all on function public.beta_admin_invites() from public, anon;
grant execute on function public.beta_admin_invites() to authenticated;

create or replace function public.enforce_closed_beta_participation()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.role() = 'authenticated' and not exists(select 1 from public.beta_access where user_id = auth.uid() and revoked_at is null) then
    raise exception 'Closed beta invite required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_closed_beta_participation() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['pings','comments','confirmations','ping_helpful','ping_follows','promotions'] loop
    execute format('drop trigger if exists enforce_closed_beta_participation on public.%I', t);
    execute format('create trigger enforce_closed_beta_participation before insert on public.%I for each row execute function public.enforce_closed_beta_participation()', t);
  end loop;
end $$;