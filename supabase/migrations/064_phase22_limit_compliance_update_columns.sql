revoke update on table public.compliance_requests from authenticated;
grant update (status, response_note, updated_at, resolved_at) on table public.compliance_requests to authenticated;
