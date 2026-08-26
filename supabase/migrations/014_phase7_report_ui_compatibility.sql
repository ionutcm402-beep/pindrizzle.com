drop policy if exists "users create reports" on public.reports;
create policy "users create reports"
on public.reports for insert
to authenticated
with check (auth.uid() = reporter_id);

grant insert on table public.reports to authenticated;

create or replace function public.validate_report_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  if auth.uid() is null or new.reporter_id <> auth.uid() then
    raise exception 'Authentication required';
  end if;

  if new.reason not in ('incorrect','spam','unsafe','harassment','dangerous','privacy','other') then
    raise exception 'Invalid report reason';
  end if;

  select p.user_id into owner_id
  from public.pings p
  where p.id = new.ping_id
    and p.status = 'active'
    and p.expires_at > now();

  if owner_id is null then
    raise exception 'Ping not available';
  end if;
  if owner_id = auth.uid() then
    raise exception 'You cannot report your own Ping';
  end if;

  if (
    select count(*)
    from public.reports r
    where r.reporter_id = auth.uid()
      and r.created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'Report limit reached. Please try again later.';
  end if;

  new.details := left(nullif(trim(coalesce(new.details, '')), ''), 500);
  return new;
end;
$$;

revoke all on function public.validate_report_submission() from public, anon, authenticated;

drop trigger if exists validate_report_submission on public.reports;
create trigger validate_report_submission
before insert on public.reports
for each row execute function public.validate_report_submission();

create or replace function public.hide_reported_ping_for_reporter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ping_hides (user_id, ping_id, reason)
  values (new.reporter_id, new.ping_id, 'reported')
  on conflict (user_id, ping_id)
  do update set reason = excluded.reason, created_at = now();
  return new;
end;
$$;

revoke all on function public.hide_reported_ping_for_reporter() from public, anon, authenticated;

drop trigger if exists hide_reported_ping_for_reporter on public.reports;
create trigger hide_reported_ping_for_reporter
after insert on public.reports
for each row execute function public.hide_reported_ping_for_reporter();

create or replace function public.report_ping(
  target_ping_id uuid,
  report_reason text,
  report_details text default ''
)
returns table (report_id uuid, hidden boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  existing_report_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if report_reason not in ('incorrect','spam','unsafe','harassment','dangerous','privacy','other') then
    raise exception 'Invalid report reason';
  end if;

  select p.user_id into owner_id
  from public.pings p
  where p.id = target_ping_id
    and p.status = 'active'
    and p.expires_at > now();

  if owner_id is null then
    raise exception 'Ping not available';
  end if;
  if owner_id = auth.uid() then
    raise exception 'You cannot report your own Ping';
  end if;

  if (
    select count(*)
    from public.reports r
    where r.reporter_id = auth.uid()
      and r.created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'Report limit reached. Please try again later.';
  end if;

  insert into public.reports (ping_id, reporter_id, reason, details)
  values (target_ping_id, auth.uid(), report_reason, left(nullif(trim(report_details), ''), 500))
  on conflict (ping_id, reporter_id)
  do update set reason = excluded.reason, details = excluded.details, created_at = now()
  returning id into existing_report_id;

  insert into public.ping_hides (user_id, ping_id, reason)
  values (auth.uid(), target_ping_id, 'reported')
  on conflict (user_id, ping_id)
  do update set reason = excluded.reason, created_at = now();

  report_id := existing_report_id;
  hidden := true;
  return next;
end;
$$;

revoke all on function public.report_ping(uuid, text, text) from public, anon;
grant execute on function public.report_ping(uuid, text, text) to authenticated;
