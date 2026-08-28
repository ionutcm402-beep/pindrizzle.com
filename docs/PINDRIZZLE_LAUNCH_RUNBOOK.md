# Pindrizzle launch runbook

This is the controlled production-release checklist for Pindrizzle. It is intentionally fail-closed. A green Vercel build is necessary but is not, by itself, approval to launch.

## Current protected state

- Release stage must remain `closed_beta` until every production gate is complete.
- Live payments must remain disabled until public release is already active and verified.
- Do not merge this launch branch to production without explicit user approval.
- Do not replace privacy-safe approximate locations with exact locations unless a user explicitly opts in.
- Do not delete payment history or manually rewrite completed Stripe events during rollback.

## Required production values

Configure these in the production environment only after the underlying real-world setup is complete:

- `PING_OPERATOR_NAME` — real operator/legal identity used by the public legal pages.
- `PING_OPERATOR_ADDRESS` — valid operator contact address suitable for the legal pages.
- `PING_SUPPORT_EMAIL` — monitored support address.
- `PING_PRIVACY_EMAIL` — monitored privacy/data-rights address.
- `PING_SAFETY_EMAIL` — monitored safety/moderation escalation address.
- `PING_GOVERNING_LAW` — wording approved in the final legal review.
- `PING_PUBLIC_URL` — final canonical HTTPS URL, expected to be the custom Pindrizzle domain.
- `PING_DOMAIN_READY=true` — set only after DNS resolves correctly, HTTPS is valid, and both canonical/www behaviour has been checked.
- `PING_SMTP_READY=true` — set only after custom SMTP has been configured and confirmation/reset messages have been smoke-tested.
- `PING_AUTH_PRODUCTION_READY=true` — set only after Supabase Auth Site URL, redirect allowlist, confirmation/reset links and Pindrizzle-branded templates have been tested on the final domain.
- `PING_STRIPE_ACCOUNT_READY=true` — set only after the live Stripe account/key/webhook are confirmed to belong to Pindrizzle, not another product/account.
- `PING_LEGAL_REVIEW_COMPLETE=true` — set only after the final public Terms, Privacy and operator disclosures have been reviewed.
- `PING_ONLINE_SAFETY_REVIEW_COMPLETE=true` — set only after the required risk assessment, moderation ownership, complaint/escalation process and operating responsibility are complete.

`PING_LIVE_PAYMENTS_ENABLED=true` is **not** a prerequisite gate. It is the final payment switch and must remain off until after public release is active.

## Launch order

1. **Domain**
   - Configure `pindrizzle.com` and `www` at the registrar/Vercel.
   - Verify public DNS propagation.
   - Verify HTTPS certificate and redirect/canonical behaviour.
   - Set `PING_PUBLIC_URL` to the final canonical URL.
   - Only after verification, set `PING_DOMAIN_READY=true`.

2. **Operator + contact channels**
   - Confirm real operator identity/address.
   - Create and monitor support, privacy and safety inboxes.
   - Put the final addresses into the production environment.

3. **Supabase Auth + email**
   - Set the final Site URL to the production Pindrizzle domain.
   - Add only required production/preview redirect URLs.
   - Configure custom SMTP.
   - Brand confirmation, password-reset and other auth messages as Pindrizzle.
   - Test sign-up confirmation and password reset from a fresh account on the final domain.
   - Then set `PING_SMTP_READY=true` and `PING_AUTH_PRODUCTION_READY=true`.

4. **Legal and online-safety operations**
   - Complete the final legal review.
   - Confirm governing-law wording.
   - Confirm who monitors reports/safety escalations and how complaints/incidents are handled.
   - Complete the required online-safety assessment/process ownership.
   - Only then set the two review flags to `true`.

5. **Stripe — prepare, do not enable**
   - Use the dedicated Pindrizzle Stripe identity/account only.
   - Confirm live secret key and webhook secret belong to Pindrizzle.
   - Verify webhook endpoint/signing and supported events.
   - Set `PING_STRIPE_ACCOUNT_READY=true` only when confirmed.
   - Keep `PING_LIVE_PAYMENTS_ENABLED` off.

6. **Final closed-beta smoke test**
   - Launch-readiness dashboard must show every prerequisite gate complete.
   - Test Feed, Map, Search, My Pins, Activity, You, Public Profile, Beta access, Promote and Business screens.
   - Test Private vs Exact location choice.
   - Test sign-up, sign-in, sign-out, reset password and auth redirects.
   - Test reporting/blocking and moderator operations.
   - Confirm there are no unresolved operational anomalies.
   - Confirm the final Vercel build is green.

7. **Explicit approval + production merge**
   - Obtain explicit user approval to merge.
   - Merge through the protected branch/PR workflow.
   - Verify the production deployment before changing release stage.

8. **Open public access**
   - Change Supabase release stage from `closed_beta` to `public` using the controlled release operation.
   - Re-open the launch-readiness dashboard.
   - Confirm Public access shows LIVE and Payments still shows LOCKED.
   - Run a public-account smoke test.

9. **Enable live payments last**
   - Only after public access is verified, set `PING_LIVE_PAYMENTS_ENABLED=true`.
   - Checkout independently requires both the live-payment flag and database release stage `public`.
   - Perform one controlled live-payment smoke test.
   - Verify the webhook, activation record and business dashboard result.

## Rollback order

If a launch issue occurs:

1. Disable `PING_LIVE_PAYMENTS_ENABLED` first.
2. Switch release stage back to `closed_beta` if public participation needs to be stopped.
3. Leave Stripe webhook processing available so already-started payments can still finalize/refund safely.
4. Do not delete payment records, promotion history, reports, moderation history or completed Stripe events.
5. Diagnose and fix on a branch, obtain a green build, then repeat the controlled release checks.

## Optional future hardening

- Supabase leaked-password protection is a Pro-plan feature. The current Supabase organization is Free, so it is not a launch blocker. Revisit if/when the project upgrades.
- Do not remove apparently unused indexes solely because beta traffic is low; reassess with real production query data.
