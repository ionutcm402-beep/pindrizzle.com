# Pindrizzle production auth email templates

These are the approved launch templates for Supabase Auth. Keep the templates simple and image-free for deliverability. They use Supabase's supported `{{ .ConfirmationURL }}` variable, so the existing app flows continue to control the final redirect.

Before marking `PING_AUTH_PRODUCTION_READY=true`:

1. Set the Supabase Auth Site URL to `https://pindrizzle.com` only after the domain is valid over HTTPS.
2. Add the required redirect URLs, including `https://pindrizzle.com/**` and the current controlled preview URLs needed during closed-beta QA.
3. Configure custom SMTP for a Pindrizzle-owned sender.
4. Paste the templates below into Auth > Email Templates.
5. Disable email-provider click tracking for auth emails so confirmation URLs are not rewritten.
6. Smoke-test sign-up confirmation, password reset and email-change flows on the final domain.
7. Only then set `PING_SMTP_READY=true` and `PING_AUTH_PRODUCTION_READY=true`.

---

## Confirm sign up

**Subject**

`Confirm your Pindrizzle account`

**HTML**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0b2239;background:#ffffff;">
  <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;color:#1687b8;">PINDRIZZLE</p>
  <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;">Confirm your email</h1>
  <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#526778;">Confirm this email address to finish creating your Pindrizzle account and get back to useful local pins around you.</p>
  <p style="margin:0 0 24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 18px;border-radius:12px;background:#0b2239;color:#ffffff;text-decoration:none;font-weight:700;">Confirm email</a></p>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#738797;">If you did not create a Pindrizzle account, you can ignore this email.</p>
  <p style="margin:28px 0 0;font-size:12px;color:#1687b8;font-weight:700;">Drop in daily.</p>
</div>
```

---

## Reset password

**Subject**

`Reset your Pindrizzle password`

**HTML**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0b2239;background:#ffffff;">
  <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;color:#1687b8;">PINDRIZZLE</p>
  <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;">Reset your password</h1>
  <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#526778;">We received a request to reset the password for your Pindrizzle account.</p>
  <p style="margin:0 0 24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 18px;border-radius:12px;background:#0b2239;color:#ffffff;text-decoration:none;font-weight:700;">Choose a new password</a></p>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#738797;">If you did not request this, do not use the link. Your existing password remains unchanged.</p>
  <p style="margin:28px 0 0;font-size:12px;color:#1687b8;font-weight:700;">Drop in daily.</p>
</div>
```

---

## Change email address

**Subject**

`Confirm your new Pindrizzle email`

**HTML**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0b2239;background:#ffffff;">
  <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;color:#1687b8;">PINDRIZZLE</p>
  <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;">Confirm your new email</h1>
  <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#526778;">Confirm <strong>{{ .NewEmail }}</strong> as the new email address for your Pindrizzle account.</p>
  <p style="margin:0 0 24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 18px;border-radius:12px;background:#0b2239;color:#ffffff;text-decoration:none;font-weight:700;">Confirm new email</a></p>
  <p style="margin:0;font-size:12px;line-height:1.5;color:#738797;">If you did not request this change, do not use the link.</p>
</div>
```

---

## Invite user

This is not the same as the current `PING-…` closed-beta participation code. Use this Supabase template only if account-level email invitation is deliberately enabled later.

**Subject**

`You're invited to Pindrizzle`

**HTML**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0b2239;background:#ffffff;">
  <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;color:#1687b8;">PINDRIZZLE</p>
  <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;">You're invited</h1>
  <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#526778;">Follow the link below to create your Pindrizzle account.</p>
  <p style="margin:0 0 24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 18px;border-radius:12px;background:#0b2239;color:#ffffff;text-decoration:none;font-weight:700;">Accept invitation</a></p>
  <p style="margin:28px 0 0;font-size:12px;color:#1687b8;font-weight:700;">Drop in daily.</p>
</div>
```

---

## Password changed security notification

If Supabase security notifications are enabled, use:

**Subject**

`Your Pindrizzle password was changed`

**HTML**

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0b2239;background:#ffffff;">
  <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;color:#1687b8;">PINDRIZZLE</p>
  <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;">Your password was changed</h1>
  <p style="margin:0;font-size:15px;line-height:1.6;color:#526778;">The password for your Pindrizzle account was recently changed. If this was not you, reset your password immediately and contact Pindrizzle support.</p>
</div>
```

## Smoke-test checklist

- New account receives the Pindrizzle confirmation email.
- Confirmation link lands back on the expected Pindrizzle origin and the account can sign in.
- Closed-beta invite still activates after confirmation/sign-in on the same browser.
- Forgot password sends the Pindrizzle reset email.
- Reset link lands on `/reset-password` and successfully updates the password.
- Old password stops working; new password works.
- Email-change flow, if exposed, confirms the new address successfully.
- No email link is rewritten by analytics/click-tracking software.
- Sender name, From address and Reply-To are Pindrizzle-owned.
