# Phase 25 — Supabase advisor review

Date: 2026-08-26

This review records the final Supabase security/performance advisor classification before Ping public launch. It does **not** switch Ping to public mode or enable live payments.

## Release state

- `public.app_release_state.stage` is still `closed_beta`.
- Closed-beta participation enforcement remains active.
- No real Stripe charge was created by this review.

## Security advisor classification

### 1. Intentional deny-all RLS tables

The advisor reports `RLS Enabled No Policy` INFO notices on several internal tables, including beta invite, moderation, analytics, promotion-event and push-delivery tables. For these tables, no direct client policy is intentional: access is routed through guarded RPCs or server-side/service-role paths. These INFO notices are not treated as launch vulnerabilities by themselves.

### 2. SECURITY DEFINER RPC warnings

Supabase flags callable `SECURITY DEFINER` functions for review. The launch-critical Ping functions were inspected directly from the live database.

Verified guards include:

- Beta administration: `create_beta_invite()` and `beta_admin_invites()` require `is_moderator()`.
- Moderation: `moderate_ping_case()` and `moderate_promotion_request()` require moderator access and validate allowed actions/state.
- Operator metrics: `ops_daily_metrics()`, `ops_health_snapshot()` and `ops_product_summary()` require moderator access.
- Payment checkout: `claim_promotion_checkout()`, `register_promotion_checkout()` and `release_promotion_checkout_claim()` require authentication, enforce promoter ownership and validate promotion/payment/claim state before elevated writes.

These warnings remain useful audit reminders, but the reviewed functions are not unguarded privilege-escalation endpoints.

### 3. PostGIS in `public`

The advisor reports:

- `spatial_ref_sys` has RLS disabled.
- PostGIS is installed in the `public` schema.

Live inspection confirms:

- PostGIS is installed in `public`.
- The extension is not relocatable (`extrelocatable = false`).
- `spatial_ref_sys` is owned by managed role `supabase_admin`, while the available SQL execution role cannot assume that role.

A transactional attempt to apply a read-only RLS hardening failed immediately with `must be owner of table spatial_ref_sys`; no change persisted.

Current Supabase guidance recommends installing PostGIS in a separate schema for new setups. For an existing PostGIS 2.3+ installation, moving schemas normally requires backup/drop/recreate, or Supabase Support can perform the documented controlled relocation. Ping will **not** perform a destructive PostGIS relocation during launch preparation because it could break map/geospatial dependencies.

Official reference:
- https://supabase.com/docs/guides/database/extensions/postgis

Launch classification: **managed-extension configuration exception; follow up with Supabase Support / controlled migration, not an emergency Ping data-table RLS bug.**

### 4. Leaked-password protection

The security advisor still reports Supabase Auth leaked-password protection disabled. Supabase documents this as a Pro-plan-or-above feature using the Pwned Passwords API.

Official reference:
- https://supabase.com/docs/guides/auth/password-security

Launch classification: **real authentication-strengthening item still open.** Decide/upgrade/configure before public launch if this protection is required for the launch security standard.

## Performance advisor classification

The performance advisor currently reports only `Unused Index` INFO notices. Ping is still in a very small closed beta, so low index-usage counters are expected. No index is removed solely because it has not yet accumulated production usage.

There is no current Phase 25 performance WARN/ERROR requiring a launch-time database migration.

## Final database conclusion

No new Ping-owned security vulnerability was found in the Phase 25 advisor pass. The remaining launch-relevant Supabase items are:

1. Decide/enable leaked-password protection if required for launch.
2. Track the existing public-schema PostGIS installation as a managed migration/support item rather than attempting destructive relocation during launch.
3. Keep reviewing privileged RPC grants and internal guards whenever these functions change.
