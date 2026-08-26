drop policy if exists "users submit own compliance requests" on public.compliance_requests;
revoke insert on table public.compliance_requests from authenticated;

create or replace function public.submit_compliance_request(
  request_kind text,
  request_details text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  normalized_details text := btrim(coalesce(request_details, ''));
  created_id uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  if request_kind not in (
    'data_access','data_erasure','data_correction','data_restriction',
    'data_objection','safety_complaint','moderation_appeal','other'
  ) then
    raise exception 'Unsupported request type';
  end if;

  if char_length(normalized_details) < 10 or char_length(normalized_details) > 2000 then
    raise exception 'Request details must be between 10 and 2000 characters';
  end if;

  if (
    select count(*)
    from public.compliance_requests
    where user_id = caller
      and created_at >= now() - interval '24 hours'
  ) >= 10 then
    raise exception 'Too many requests submitted recently';
  end if;

  insert into public.compliance_requests (user_id, request_type, details, status)
  values (caller, request_kind, normalized_details, 'open')
  returning id into created_id;

  return created_id;
end;
$$;

revoke all on function public.submit_compliance_request(text,text) from public, anon;
grant execute on function public.submit_compliance_request(text,text) to authenticated;
