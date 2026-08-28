# Pindrizzle Native Release — iOS + Android

This document is for the installable Capacitor app. `pindrizzle.com` is a separate marketing/landing site and is not the native application binary.

## Native identity

- App name: **Pindrizzle**
- iOS bundle ID / Android application ID: **`com.pindrizzle.app`**
- Capacitor web bundle: `out/`
- Native projects: `ios/` and `android/`
- Existing brand source used for generated native icon/splash sizes: `public/pindrizzle-icon-512.png`
- Do not redraw or replace the Pindrizzle logo.

The bundle/application ID should be treated as permanent once App Store Connect or Google Play records are created.

## Architecture

The native app bundles the statically exported customer UI locally in the Capacitor WebView. It does **not** load the website from Vercel through `server.url`.

Supabase remains the data/auth backend. Next.js server-only `/api/*` handlers remain deployed separately and are reached by the native bundle through `NEXT_PUBLIC_PINDRIZZLE_API_ORIGIN`. Do not point this at the marketing site unless that host actually serves those API routes.

Current safe temporary backend origin for native CI: `https://ping-app-cyan.vercel.app`. A dedicated API hostname can replace it later without changing the app UI architecture.

## Build commands

```bash
npm install
npm run build:native:web
npx cap sync
npm run native:assets
node scripts/configure-native-projects.mjs
```

Open native IDEs:

```bash
npm run cap:open:ios
npm run cap:open:android
```

The CI workflow `.github/workflows/native-capacitor.yml` also compiles an unsigned Android debug build and unsigned iOS simulator build before committing generated native project changes.

## Native permissions already wired in code

### Location

Feed/Map use `@capacitor/geolocation` on iOS/Android and the existing browser geolocation API on web. Exact coordinates remain memory-only; they are not newly persisted by the native bridge.

### Camera / photos

The composer uses `@capacitor/camera` on native devices. The selected native file is passed into the existing Pindrizzle JPEG/PNG/WebP validation and re-encoding path, so EXIF/GPS metadata protection remains in force.

### Push notifications

Native registration uses `@capacitor/push-notifications`:

- iOS token: APNs device token
- Android token: FCM token
- tokens are stored separately in `native_push_devices`
- existing browser Web Push subscriptions remain unchanged
- server delivery can use APNs and FCM credentials independently

### Auth deep links

Supabase confirmation/recovery redirects are rewritten inside the native app to:

`pindrizzle://auth/callback?next=...`

The native app handles that URL, establishes the Supabase session, then routes to Feed or Reset Password. Add `pindrizzle://auth/callback` to Supabase Authentication Redirect URLs before native email-flow QA.

## Manual steps — Apple

These require the account owner in Apple Developer / App Store Connect:

1. Enrol in the **Apple Developer Program** if not already enrolled.
2. Create/register bundle identifier `com.pindrizzle.app`.
3. In Xcode, select the Pindrizzle/App target and your Apple development team.
4. Enable the **Push Notifications** capability. Capacitor's AppDelegate token-forwarding methods are already added by `scripts/configure-native-projects.mjs`.
5. Create an APNs `.p8` key with push access and securely configure the server environment:
   - `APNS_KEY_ID`
   - `APNS_TEAM_ID`
   - `APNS_PRIVATE_KEY`
   - `APNS_BUNDLE_ID=com.pindrizzle.app`
   - `APNS_USE_SANDBOX=false` for App Store production delivery
6. Confirm signing/provisioning in Xcode.
7. Set app version/build number.
8. Test on a real iPhone: sign-up confirmation, password reset, location permission, Private/Exact pin, camera/photo library, push, Feed/Map, safe areas.
9. Archive in Xcode: **Product → Archive**.
10. Validate and upload the archive to App Store Connect.
11. Supply App Store listing metadata, screenshots, support/privacy URLs, age rating, App Privacy answers, review contact and review notes.
12. Submit for review only after Pindrizzle is intentionally moved from closed beta/public gates according to the product release plan.

Do not create an App Store record with a different bundle ID unless the code/config is deliberately changed first.

## Manual steps — Google Play

These require the account owner in Google Play Console / Firebase:

1. Create a **Google Play Console** developer account if not already available.
2. Create the Pindrizzle app with application ID `com.pindrizzle.app`.
3. Create or choose a Firebase project and register Android app `com.pindrizzle.app`.
4. Download Firebase `google-services.json` and place it at:
   `android/app/google-services.json`
   This file is intentionally gitignored and must not be committed.
5. Configure the FCM HTTP v1 service-account credentials on the server:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
6. Create/store an Android upload key securely; never commit `.jks`/`.keystore` files or passwords.
7. Configure release signing in Android Studio/Gradle using secure local/CI secrets.
8. Set versionCode/versionName.
9. Test on a real Android phone, including Android 13+ notification permission, location choices, camera/photo picker and back navigation.
10. Build a signed **Android App Bundle (.aab)** in Android Studio.
11. Upload to an Internal Testing track first.
12. Complete store listing, screenshots, content rating, Data safety form, privacy-policy URL, ads declaration and app-access/reviewer instructions.
13. Promote to production only after QA and explicit release approval.

## Manual Supabase step before native auth QA

In Authentication → URL Configuration, add:

`pindrizzle://auth/callback`

Keep the existing web preview/production redirect URLs; the native deep link is additive.

## Database migration

`supabase/migrations/081_phase25_native_push_devices.sql` is additive and creates native push-token/attempt storage and RPCs. Apply it to the beta Supabase project as part of native QA, before testing the native Push settings screen.

## Store assets

Native icon and splash sizes are derived automatically from the existing exact `public/pindrizzle-icon-512.png`; no alternate logo is introduced. The current source is 512×512. Before final store submission, use the highest-resolution exact original Pindrizzle artwork available if a 1024×1024-or-larger original exists; do not redraw it.

Store screenshots are **not** app icons. Capture real app screens on approved device sizes after final native QA.

## Release gates that remain off

- Supabase `release_stage`: keep `closed_beta` until explicitly approved.
- Live Stripe payments: keep disabled.
- The nailinthehead.org Stripe identity must not be used for Pindrizzle.
- Native APNs/FCM credentials must be configured and tested before claiming push is production-ready.
- Apple/Google signing and store submission require the account owner.
- Legal/store privacy disclosures must match actual data handling before submission.
