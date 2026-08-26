# Phase 25 — Public Launch Checklist

This is the final operator gate for Ping. Completing code on the Phase 25 branch is not the same as opening public participation or live payments.

## Current safe state

- [x] Phase 24 closed beta is the production baseline.
- [x] `app_release_state.stage` is `closed_beta`.
- [x] Closed-beta participation triggers remain active.
- [x] Live Stripe charging is fail-closed unless `PING_LIVE_PAYMENTS_ENABLED=true`.
- [x] Payment amount/currency, ownership and active-Ping duration are verified server-side.
- [x] Duplicate Checkout creation is guarded with checkout claims/session reuse.
- [x] Stripe webhook events are signature-verified and recorded idempotently.
- [x] Full refunds stop active placement; disputes pause/end placement as appropriate.
- [x] A payment that cannot activate its placement is refunded rather than silently retained.
- [x] Public-mode signup and beta UI are already release-stage aware.
- [x] Independent GitHub `next build` CI is enabled for PRs.
- [x] Supabase security/performance advisors were reviewed after Phase 25 database changes.
- [x] Duplicate Stripe checkout-session index removed.

## Required before public accounts are opened

- [ ] Configure production custom SMTP in Supabase Auth.
- [ ] Verify signup confirmation delivery to an ordinary external email address.
- [ ] Verify password-reset delivery and reset flow end-to-end.
- [ ] Confirm production Site URL and allowed redirect URLs point at Ping production.
- [ ] Keep email confirmation enabled.
- [ ] Decide whether to upgrade Supabase if leaked-password protection / higher production guarantees are required.

## Required before live payments are opened

- [ ] Use a Stripe live account/configuration whose customer-facing business identity and statement descriptor are appropriate for Ping.
- [ ] Configure the production Stripe webhook endpoint for `/api/stripe/webhook`.
- [ ] Store the matching live webhook signing secret in production only.
- [ ] Store the correct live Stripe secret key in production only.
- [ ] Confirm the live account can accept GBP card payments and payouts.
- [ ] Confirm the customer-facing refund/cancellation terms shown by Ping match the operating policy.
- [ ] Run one controlled low-value live promotion payment and verify Checkout → webhook/return verification → placement activation → dashboard state.
- [ ] Test a controlled refund and verify placement/payment state changes correctly.
- [ ] Only after those checks set `PING_LIVE_PAYMENTS_ENABLED=true` in production.

## Required legal / safety operator details

These items require the real operator's final decisions and legal review; code must not invent them.

- [ ] Publish the correct operator/controller identity and dedicated contact route.
- [ ] Finalise governing-law / jurisdiction wording where appropriate.
- [ ] Finalise promotion cancellation/refund wording before live payment.
- [ ] Confirm Privacy Notice provider/transfer wording against the actual production providers/configuration.
- [ ] Maintain the required UK online-safety risk assessments and evidence appropriate to Ping's service and likely users.
- [ ] Assign the accountable safety/moderation owner and escalation route.
- [ ] Define moderation/illegal-content complaint service targets and evidence-retention procedure.
- [ ] Perform final legal review of Terms, Privacy and Safety pages before switching public.

## Final technical release sequence

Do these in order after all blockers above are complete.

1. Confirm Phase 25 PR CI and Vercel preview are green.
2. Smoke-test anonymous Feed/Search/Map, sign-in, posting, replies, confirmations, Helpful, Follow, reports, photos and push on the preview.
3. Smoke-test moderator/report/promotion operations with an authorised moderator account.
4. Verify production environment variables contain no test credentials where live values are required.
5. Merge Phase 25 only with explicit approval.
6. Verify the merge commit deploys green to production.
7. Verify SMTP signup/reset on production.
8. Change `public.app_release_state.stage` from `closed_beta` to `public` as the explicit participation-opening action.
9. Confirm public signup no longer asks for a beta invite and a fresh account can participate.
10. Enable live Stripe payments only after the Stripe production checklist above is complete.
11. Run the controlled live payment/refund checks.
12. Monitor runtime errors, moderation queue, auth delivery and payment events closely after launch.

## Rollback controls

- To close new public participation quickly, return the release stage to `closed_beta`; the existing participation triggers then enforce beta access again.
- To stop new real payment Checkout immediately, set `PING_LIVE_PAYMENTS_ENABLED=false`.
- Do not delete payment, moderation or safety evidence as part of a rollback.
- A deployment rollback does not automatically roll back database state; verify both app and database state explicitly.
