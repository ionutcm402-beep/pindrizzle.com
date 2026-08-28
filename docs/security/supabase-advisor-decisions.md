# Supabase advisor decisions

Last reviewed: 2026-08-28

This file records deliberate decisions from the Pindrizzle Supabase security/performance advisor review so future maintenance does not blindly "fix" intentional access patterns.

## Fixed

- Added `native_push_delivery_attempts_device_id_idx` for the `native_push_delivery_attempts.device_id` foreign key.
- Revoked browser-role execution of superseded `create_ping_v2`.
- Revoked browser-role execution of superseded `create_ping_v3`; `create_ping_v4` remains the canonical client endpoint and calls v3 internally as the SECURITY DEFINER owner.
- Revoked browser-role execution of superseded `update_own_ping`; `update_own_ping_v2` remains the canonical client endpoint and calls the older function internally as the SECURITY DEFINER owner.

## Intentional / do not silence blindly

### RLS enabled with no policy

Several internal tables intentionally use RLS with no client policies. This is deny-by-default, not a missing-access bug. Do not add broad policies merely to remove the advisor INFO message.

Examples include moderator, beta-invite, analytics, push-delivery, place-cache and payment-event tables.

### Public browse RPCs

Pindrizzle supports browsing useful nearby information before sign-in. Public read RPCs such as nearby Feed/Map/Search data, public release stage and selected public contributor/community context therefore intentionally remain callable by `anon` where required.

### Authenticated SECURITY DEFINER RPCs

Many user actions are intentionally exposed to the `authenticated` role and perform ownership/moderator checks inside the function. Do not revoke these solely because the advisor reports SECURITY DEFINER exposure; first prove that the website no longer needs the RPC or replace it with an equivalent safer architecture.

### `can_read_ping_media`

Do not revoke this helper without redesigning media RLS. It is referenced by the `public.ping_media` visibility policy.

### PostGIS / `spatial_ref_sys`

PostGIS is currently installed in `public`, and Supabase reports `spatial_ref_sys` RLS plus extension-placement warnings. Treat moving the extension or changing extension-owned permissions as a separate migration project with spatial regression testing. A rollback-only attempt to revoke browser execution of PostGIS `ST_EstimatedExtent` overloads did not alter the extension-managed ACL, so no permanent PostGIS permission changes were made.

### Unused indexes

Do not drop indexes merely because the closed-beta database reports them unused. Low traffic makes this signal weak, and several indexes protect launch-time spatial, moderation, notification, search, payment or foreign-key workloads.

## Manual Auth setting still outstanding

Supabase reports leaked-password protection disabled. This is a dashboard/Auth configuration item and remains a launch prerequisite; it is intentionally separate from the self-service database maintenance in this pass.

## Safety invariants

Database maintenance must not:

- change release stage from `closed_beta` without explicit owner approval;
- enable live payments;
- loosen Private/approximate location storage;
- add broad client policies to internal tables just to silence advisor output.
