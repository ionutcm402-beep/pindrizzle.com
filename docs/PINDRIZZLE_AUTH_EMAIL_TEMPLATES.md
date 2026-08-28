# Pindrizzle production auth email templates

These templates use the same Pindrizzle design language as the app: lowercase navy/blue/aqua visual wordmark, the 4/8/16/24/32 spacing rhythm, navy pill primary action, silver-light surfaces and restrained typography.

The visual wordmark is text only. **Do not redraw or replace the supplied Pindrizzle logo.** Keep the templates image-light until the exact existing asset at `https://pindrizzle.com/pindrizzle-icon-192.png` has been verified on production. At that point the existing icon may be added above the wordmark without changing this treatment.

All confirmation actions must keep Supabase's supported `{{ .ConfirmationURL }}` variable exactly as written.

Before marking `PING_AUTH_PRODUCTION_READY=true`:

1. Keep the Supabase Auth Site URL on `https://pindrizzle.com`.
2. Keep the required production and controlled closed-beta preview redirect URLs.
3. Keep custom SMTP on the Pindrizzle-owned sender.
4. Paste the templates below into Auth > Email Templates.
5. Disable email-provider click tracking for auth emails so confirmation URLs are not rewritten.
6. Smoke-test sign-up confirmation, password reset and email-change flows on the final domain.
7. Only then set the relevant production readiness flags.

## Canonical visual treatment

Use this exact wordmark block in every auth email:

```html
<div aria-label="Pindrizzle" style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:22px;line-height:1;font-weight:790;letter-spacing:-1.1px;">
  <span style="color:#082b49;">pin</span><span style="color:#2f83d6;">drizz</span><span style="color:#25bdc8;">le</span>
</div>
```

Canonical primary action:

```html
style="display:inline-block;min-height:44px;line-height:44px;padding:0 16px;border-radius:999px;background:#082b49;color:#ffffff;text-decoration:none;font-weight:760;"
```

---

## Confirm sign up

**Subject**

`Confirm your Pindrizzle account`

**HTML**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a2b46;background:#ffffff;">
  <div aria-label="Pindrizzle" style="margin:0 0 16px;font-size:22px;line-height:1;font-weight:790;letter-spacing:-1.1px;"><span style="color:#082b49;">pin</span><span style="color:#2f83d6;">drizz</span><span style="color:#25bdc8;">le</span></div>
  <h1 style="margin:0 0 8px;font-size:28px;line-height:1.15;letter-spacing:-.7px;color:#061f36;">Confirm your email</h1>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#496777;">Confirm this email address to finish creating your Pindrizzle account and get back to useful local pins around you.</p>
  <p style="margin:0 0 24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 16px;border-radius:999px;background:#082b49;color:#ffffff;text-decoration:none;font-weight:760;">Confirm email</a></p>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#7d939f;">If you did not create a Pindrizzle account, you can ignore this email.</p>
  <p style="margin:24px 0 0;font-size:12px;color:#0b6a82;font-weight:760;">Drop in daily.</p>
</div>
```

---

## Reset password

**Subject**

`Reset your Pindrizzle password`

**HTML**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a2b46;background:#ffffff;">
  <div aria-label="Pindrizzle" style="margin:0 0 16px;font-size:22px;line-height:1;font-weight:790;letter-spacing:-1.1px;"><span style="color:#082b49;">pin</span><span style="color:#2f83d6;">drizz</span><span style="color:#25bdc8;">le</span></div>
  <h1 style="margin:0 0 8px;font-size:28px;line-height:1.15;letter-spacing:-.7px;color:#061f36;">Reset your password</h1>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#496777;">We received a request to reset the password for your Pindrizzle account.</p>
  <p style="margin:0 0 24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 16px;border-radius:999px;background:#082b49;color:#ffffff;text-decoration:none;font-weight:760;">Choose a new password</a></p>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#7d939f;">If you did not request this, do not use the link. Your existing password remains unchanged.</p>
  <p style="margin:24px 0 0;font-size:12px;color:#0b6a82;font-weight:760;">Drop in daily.</p>
</div>
```

---

## Change email address

**Subject**

`Confirm your new Pindrizzle email`

**HTML**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a2b46;background:#ffffff;">
  <div aria-label="Pindrizzle" style="margin:0 0 16px;font-size:22px;line-height:1;font-weight:790;letter-spacing:-1.1px;"><span style="color:#082b49;">pin</span><span style="color:#2f83d6;">drizz</span><span style="color:#25bdc8;">le</span></div>
  <h1 style="margin:0 0 8px;font-size:28px;line-height:1.15;letter-spacing:-.7px;color:#061f36;">Confirm your new email</h1>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#496777;">Confirm <strong>{{ .NewEmail }}</strong> as the new email address for your Pindrizzle account.</p>
  <p style="margin:0 0 24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 16px;border-radius:999px;background:#082b49;color:#ffffff;text-decoration:none;font-weight:760;">Confirm new email</a></p>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#7d939f;">If you did not request this change, do not use the link.</p>
</div>
```

---

## Invite user

This is not the same as the existing `PING-…` closed-beta participation code. Use this Supabase template only if account-level email invitation is deliberately enabled later.

**Subject**

`You're invited to Pindrizzle`

**HTML**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a2b46;background:#ffffff;">
  <div aria-label="Pindrizzle" style="margin:0 0 16px;font-size:22px;line-height:1;font-weight:790;letter-spacing:-1.1px;"><span style="color:#082b49;">pin</span><span style="color:#2f83d6;">drizz</span><span style="color:#25bdc8;">le</span></div>
  <h1 style="margin:0 0 8px;font-size:28px;line-height:1.15;letter-spacing:-.7px;color:#061f36;">You're invited</h1>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#496777;">Follow the link below to create your Pindrizzle account.</p>
  <p style="margin:0 0 24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 16px;border-radius:999px;background:#082b49;color:#ffffff;text-decoration:none;font-weight:760;">Accept invitation</a></p>
  <p style="margin:24px 0 0;font-size:12px;color:#0b6a82;font-weight:760;">Drop in daily.</p>
</div>
```

---

## Password changed security notification

**Subject**

`Your Pindrizzle password was changed`

**HTML**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a2b46;background:#ffffff;">
  <div aria-label="Pindrizzle" style="margin:0 0 16px;font-size:22px;line-height:1;font-weight:790;letter-spacing:-1.1px;"><span style="color:#082b49;">pin</span><span style="color:#2f83d6;">drizz</span><span style="color:#25bdc8;">le</span></div>
  <h1 style="margin:0 0 8px;font-size:28px;line-height:1.15;letter-spacing:-.7px;color:#061f36;">Your password was changed</h1>
  <p style="margin:0;font-size:15px;line-height:1.6;color:#496777;">The password for your Pindrizzle account was recently changed. If this was not you, reset your password immediately and contact Pindrizzle support.</p>
</div>
```

## Smoke-test checklist

- New account receives the Pindrizzle confirmation email.
- The visible email wordmark matches the app treatment: lowercase, 22px, 790 weight, navy → blue → aqua.
- Confirmation link lands back on the expected Pindrizzle origin and the account can sign in.
- Closed-beta invite still activates after confirmation/sign-in on the same browser.
- Forgot password sends the Pindrizzle reset email.
- Reset link lands on `/reset-password` and successfully updates the password.
- Old password stops working; new password works.
- Email-change flow, if exposed, confirms the new address successfully.
- No email link is rewritten by analytics/click-tracking software.
- Sender name, From address and Reply-To are Pindrizzle-owned.
