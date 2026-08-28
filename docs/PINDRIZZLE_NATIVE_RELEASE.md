# Pindrizzle Native Release — iOS + Android

This document is for the installable Capacitor app. `pindrizzle.com` is a separate marketing/landing site and is not the native application binary.

## Native identity

- App name: **Pindrizzle**
- iOS bundle ID / Android application ID: **`com.pindrizzle.app`**
- Capacitor web bundle: `out/`
- Native projects: `ios/` and `android/`
- Existing brand source used for generated native icon/splash sizes: `public/pindrizzle-icon-512.png`
- Do not redraw or replace the Pindrizzle logo.

Treat `com.pindrizzle.app` as permanent once the Apple App Store Connect or Google Play records are created.

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
node scripts/ensure-ios-icon-sizes.mjs
node scripts/configure-native-projects.mjs
```

Open native IDEs:

```bash
npm run cap:open:ios
npm run cap:open:android
```

The CI workflow `.github/workflows/native-capacitor.yml` compiles Android and, on macOS, boots an iPhone Simulator, builds the Xcode target, installs `App.app`, launches `com.pindrizzle.app`, and captures a real Simulator screenshot.

# iOS App Store configuration

## Already done in code

### Bundle identity

- Xcode target bundle identifier: **`com.pindrizzle.app`** for Debug and Release.
- Capacitor `appId`: **`com.pindrizzle.app`**.
- Display name: **Pindrizzle**.
- Current marketing version/build start at `1.0` / `1`; choose the final release version/build before archive upload.

The App Store Connect record must be created with this exact bundle identifier.

### Minimum iOS and orientation

- Minimum iOS deployment target: **iOS 15.0**.
- Capacitor Swift Package platform: iOS 15.
- iPhone: **portrait only**.
- iPad: **portrait only**.

### App icon and launch screen

No new Pindrizzle artwork is generated.

`@capacitor/assets` starts from the existing exact Pindrizzle icon. `scripts/ensure-ios-icon-sizes.mjs` then exports the iPhone, iPad and 1024×1024 App Store catalog slots by resizing that existing artwork only.

The iOS Launch Screen uses the generated `Splash.imageset`, which is also derived from the existing Pindrizzle artwork. The storyboard is `ios/App/App/Base.lproj/LaunchScreen.storyboard`.

If a higher-resolution exact original Pindrizzle icon becomes available before final submission, replace the resize source with that exact original rather than redrawing or altering the logo. The currently available repository source is 512×512.

### Permission purpose strings

Pindrizzle requests only the permission scopes it actually uses.

**Location — When In Use only**

> Pindrizzle uses your location while you use the app to show nearby pins in Feed and Map and to place a new pin near you. Your exact pin location is public only when you explicitly choose Exact.

There is deliberately no `NSLocationAlwaysAndWhenInUseUsageDescription` because Pindrizzle does not use background/Always location.

**Camera**

> Pindrizzle uses the camera only when you choose to take a photo for a pin. The photo is processed before upload to remove embedded location metadata.

**Photo Library**

> Pindrizzle lets you choose a photo from your library to attach to a pin. Only the photo you select is accessed, and it is processed before upload to remove embedded location metadata.

Apple does **not** provide an `Info.plist` usage-description key for the push-notification permission dialog. iOS owns the system notification prompt text. Pindrizzle therefore explains the benefit in its Push notifications settings immediately before the user deliberately taps **Enable push**, then requests the native permission.

### APNs / Capacitor Push Notifications

Already wired in code:

- `@capacitor/push-notifications` is included in the iOS Swift Package.
- `AppDelegate.swift` forwards successful APNs device-token registration to Capacitor.
- `AppDelegate.swift` forwards APNs registration failures to Capacitor.
- `App.entitlements` contains the `aps-environment` entitlement for development builds.
- The Xcode target declares the Push Notifications capability.
- `CODE_SIGN_ENTITLEMENTS` points to `App/App.entitlements`.
- Native APNs tokens are stored separately from browser Web Push subscriptions.

Apple/Xcode will resolve the effective APNs environment through the signed provisioning profile for development versus distribution. Do not hard-code production credentials into the repository.

### Native status bar

- WebView remains edge-to-edge and safe-area aware.
- Pindrizzle paints the iOS status-bar safe area navy: `#082b49`.
- iOS status content is configured as light content so the clock, Wi-Fi and battery remain legible over navy.

### Simulator QA

The macOS native CI does more than compile the Simulator SDK. It:

1. boots an available iPhone Simulator,
2. builds the Xcode `App` scheme for that Simulator,
3. installs `App.app`,
4. launches bundle ID `com.pindrizzle.app`, and
5. captures an iOS Simulator screenshot as a workflow artifact.

A Simulator pass proves the native container launches and renders. It does **not** replace the required real-iPhone QA for APNs, physical camera behavior, actual location permission/location data, sign-in email return flows, and final signing.

# Manual steps — Apple / App Store

These steps require you as the Apple account owner. They cannot be completed safely by code alone.

## What you need

1. **A Mac with a current supported Xcode installation, or a cloud Mac service that gives you Xcode access.** A normal Windows machine cannot perform the final Apple signing/archive/upload workflow by itself.
2. **An active Apple Developer Program membership.** Apple currently charges **99 USD per membership year, or the local-currency equivalent where available**.
3. Your Apple Account with the required App Store Connect / Developer Program role.
4. For final device QA, a real iPhone is strongly recommended before submission.

## Exact manual Apple sequence

1. Enrol in or renew the **Apple Developer Program**.
2. In **Certificates, Identifiers & Profiles**, register an explicit App ID using bundle identifier **`com.pindrizzle.app`**.
3. Enable **Push Notifications** for that App ID.
4. In **App Store Connect → Apps**, create the Pindrizzle app record and select the same registered bundle ID **`com.pindrizzle.app`**.
5. On the Mac, clone/open this branch and open **`ios/App/App.xcodeproj`** in Xcode.
6. Select the **App** target → **Signing & Capabilities**:
   - select your Apple Developer **Team**;
   - keep **Automatically manage signing** on unless you intentionally manage profiles manually;
   - confirm Bundle Identifier is `com.pindrizzle.app`;
   - confirm **Push Notifications** is visible and enabled.
7. Let Xcode create/download the development signing assets/provisioning profile for your account.
8. Create an **APNs authentication key (.p8)** in the Apple Developer portal and record its Key ID and your Apple Team ID. Store the `.p8` securely; never commit it.
9. Configure the push-delivery server secrets securely:
   - `APNS_KEY_ID`
   - `APNS_TEAM_ID`
   - `APNS_PRIVATE_KEY`
   - `APNS_BUNDLE_ID=com.pindrizzle.app`
   - production APNs environment for App Store/TestFlight delivery when the distribution build is being tested.
10. In Supabase Authentication URL Configuration, add **`pindrizzle://auth/callback`** while retaining the existing web URLs.
11. Apply `supabase/migrations/081_phase25_native_push_devices.sql` to the beta Supabase project before native push QA.
12. Run Pindrizzle on a **real iPhone** and test at minimum:
   - first launch/onboarding;
   - location denial/allow and Feed/Map;
   - Private versus explicit Exact pin location;
   - camera capture;
   - Photo Library selection;
   - photo upload metadata stripping flow;
   - sign-up email confirmation returning to the app;
   - password reset returning to the app;
   - notification permission rationale and system prompt;
   - real APNs notification received while foreground/background/closed;
   - notification tap opens the correct pin/activity destination;
   - safe areas/status bar/home indicator on at least one notched/Dynamic Island device.
13. Set the final **Version** and increment the **Build** number in Xcode.
14. Select a distribution destination such as **Any iOS Device (arm64)** / the current Xcode distribution destination and choose **Product → Archive**.
15. In Organizer, run **Validate App** and resolve every signing/App Store validation error.
16. Choose **Distribute App → App Store Connect** and upload the archive.
17. In App Store Connect complete:
   - app name/subtitle/description/keywords;
   - category;
   - support URL and privacy-policy URL;
   - App Privacy data disclosures that match actual Pindrizzle behavior;
   - age rating;
   - required screenshots captured from the real native app/supported devices;
   - review contact details;
   - review notes and any closed-beta/test login instructions Apple needs;
   - encryption/export-compliance questions where applicable.
18. Use TestFlight for signed-distribution QA before public release.
19. Submit for App Review only after native real-device QA, legal/privacy review, and the project's explicit release approval gates are complete.

Do **not** create the App Store record under a different bundle ID unless the code is deliberately changed first.

# Native permissions shared with Android/web

## Location

Feed/Map use `@capacitor/geolocation` on iOS/Android and the existing browser geolocation API on web. Exact coordinates remain memory-only; they are not newly persisted by the native bridge.

## Camera / photos

The composer uses `@capacitor/camera` on native devices. The selected native file is passed into the existing Pindrizzle JPEG/PNG/WebP validation and re-encoding path, so EXIF/GPS metadata protection remains in force.

## Push notifications

Native registration uses `@capacitor/push-notifications`:

- iOS token: APNs device token
- Android token: FCM token
- tokens are stored separately in `native_push_devices`
- existing browser Web Push subscriptions remain unchanged
- server delivery can use APNs and FCM credentials independently

## Auth deep links

Supabase confirmation/recovery redirects are rewritten inside the native app to:

`pindrizzle://auth/callback?next=...`

The native app handles that URL, establishes the Supabase session, then routes to Feed or Reset Password.

# Manual steps — Google Play

These require the account owner in Google Play Console / Firebase:

1. Create a **Google Play Console** developer account if not already available.
2. Create the Pindrizzle app with application ID `com.pindrizzle.app`.
3. Create or choose a Firebase project and register Android app `com.pindrizzle.app`.
4. Download Firebase `google-services.json` and place it at `android/app/google-services.json`. This file is intentionally gitignored and must not be committed.
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

# Release gates that remain off

- Supabase `release_stage`: keep `closed_beta` until explicitly approved.
- Live Stripe payments: keep disabled.
- The nailinthehead.org Stripe identity must not be used for Pindrizzle.
- Native APNs/FCM credentials must be configured and tested before claiming push is production-ready.
- Apple/Google signing and store submission require the account owner.
- Legal/store privacy disclosures must match actual data handling before submission.
