# Pindrizzle real-device beta runbook

This runbook prepares the existing closed-beta Pindrizzle web app for a Capacitor iOS/Android wrapper without changing branding or public release state.

## Current release safety

- Supabase `app_release_state.stage` must remain `closed_beta` throughout this phase.
- Do not enable live Stripe payments.
- Do not merge PR #25 or switch public release state without explicit approval.
- Native wrappers use the same Supabase project and therefore the same database-side participation gates.

## Native beta architecture

Pindrizzle currently depends on Next.js server routes and Supabase, so the beta wrapper loads a stable HTTPS beta deployment in Capacitor. The native wrapper is configured by `CAPACITOR_SERVER_URL`.

Use a stable beta origin such as:

```text
https://beta.pindrizzle.com
```

Do not point distributed TestFlight/Play builds at an authentication-protected Vercel preview URL. A tester must be able to launch the wrapper without a Vercel account.

The wrapper includes a local `native-shell/index.html` fallback, but the product UI comes from the HTTPS beta deployment.

## 1. Generate native projects locally

Prerequisites:

- Node/npm
- Xcode on a Mac for iOS
- Android Studio for Android
- Apple Developer Program membership for TestFlight distribution
- Google Play developer account for Play Internal Testing

From the repository on `phase-25-7-pindrizzle-premium-ui`:

```bash
npm install
CAPACITOR_SERVER_URL=https://beta.pindrizzle.com npx cap add ios
CAPACITOR_SERVER_URL=https://beta.pindrizzle.com npx cap add android
CAPACITOR_SERVER_URL=https://beta.pindrizzle.com npm run native:sync
```

On Windows PowerShell use:

```powershell
$env:CAPACITOR_SERVER_URL="https://beta.pindrizzle.com"
npx cap add android
npm run native:sync
```

The iOS project must be generated/opened on macOS.

Bundle/package identifier is currently:

```text
com.pindrizzle.app
```

Confirm this identifier before the first App Store Connect / Play Console upload. Google fixes the package name after the first artifact upload.

## 2. iOS native settings

Open:

```bash
CAPACITOR_SERVER_URL=https://beta.pindrizzle.com npm run native:ios
```

In Xcode:

1. Select the App target.
2. Signing & Capabilities:
   - Team: your Apple Developer team
   - Bundle Identifier: `com.pindrizzle.app`
   - Automatically manage signing: on for beta unless there is a reason not to
3. Add the **Push Notifications** capability only after the native push pipeline is configured.
4. Add location privacy strings to `Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Pindrizzle uses your location to show useful pins nearby and to let you choose a Private area or Exact point when posting.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Pindrizzle uses your location only to power nearby features while you use the app.</string>
```

5. Register the custom auth callback scheme so confirmation/reset links can reopen the real app:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.pindrizzle.app</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>pindrizzle</string>
    </array>
  </dict>
</array>
```

6. Do not add background location capability. Pindrizzle does not require background tracking.

## 3. Android native settings

Open:

```bash
CAPACITOR_SERVER_URL=https://beta.pindrizzle.com npm run native:android
```

In `android/app/src/main/AndroidManifest.xml`, confirm location permissions:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

Inside the main activity add the Pindrizzle auth scheme intent filter:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="pindrizzle" />
</intent-filter>
```

Do not add background location permissions.

For Google Play, produce an Android App Bundle (`.aab`) signed with the upload key. Keep the upload key backed up securely.

## 4. Supabase native auth redirect allowlist

Before testing email confirmation or password reset from the installed app, open Supabase Dashboard > Authentication > URL Configuration and add the native redirect pattern:

```text
pindrizzle://**
```

Keep the existing HTTPS production/preview redirects needed for web closed-beta QA.

The native bridge maps:

- `pindrizzle://auth...` -> Pindrizzle root inside the WebView
- `pindrizzle://reset-password...` -> `/reset-password` inside the WebView

Do not mark auth production readiness complete until confirmation and password reset are tested from a real installed build.

## 5. TestFlight internal testing

In App Store Connect:

1. Apps > `+` > New App.
2. Platform: iOS.
3. Name: Pindrizzle.
4. Primary language: choose the launch language.
5. Bundle ID: the registered identifier matching `com.pindrizzle.app`.
6. SKU: an internal value such as `pindrizzle-ios`.
7. Create the app record.

In Xcode:

1. Increment Version/Build as needed.
2. Product > Archive.
3. Organizer > Distribute App > App Store Connect > Upload.
4. Wait for App Store Connect processing.

In App Store Connect > Pindrizzle > TestFlight:

1. Create an Internal Testing group, e.g. `Pindrizzle Core Beta`.
2. Add the processed build.
3. Invite yourself and trusted testers.
4. Internal testers must be App Store Connect users with access to the app.
5. Testers install Apple's TestFlight app, accept the invitation, and install Pindrizzle.

If a tester should not be an App Store Connect user, use TestFlight External Testing later; that path requires Beta App Review.

## 6. Google Play Internal Testing

In Play Console:

1. Home > Create app.
2. Name: Pindrizzle.
3. App (not game), free for beta unless business requirements say otherwise.
4. Add the required contact email/declarations and accept Play App Signing.
5. Confirm package name `com.pindrizzle.app` before the first upload.

In Android Studio:

1. Build > Generate Signed Bundle / APK.
2. Choose Android App Bundle.
3. Create/use the upload keystore and save it securely.
4. Generate the release `.aab`.

In Play Console:

1. Test and release > Testing > Internal testing.
2. Testers tab > create/select an email list.
3. Add tester Google-account email addresses.
4. Create new release.
5. Upload the `.aab`.
6. Add release notes, review, and roll out to Internal testing.
7. Save the tester opt-in link and send it to testers.

Internal testing is limited to 100 testers and can be used before the public store listing is fully complete.

## 7. Native push blocker

The existing production code uses Web Push (`serviceWorker`, `PushManager`, VAPID and the `web-push` server library). That is not a native APNs/FCM delivery pipeline.

Before the push-notification row in the real-device checklist can pass, Pindrizzle still needs:

### iOS

- Apple Push Notifications capability
- APNs key/certificate configuration
- native token registration
- server-side APNs delivery

### Android

- Firebase project / `google-services.json`
- FCM configuration
- native token registration
- server-side FCM delivery

Do **not** treat a Web Push success in Safari/Chrome as proof that TestFlight or Play native push works.

## 8. Manual real-device checklist

Run the entire checklist separately on at least one real iPhone and one real Android phone.

### Install / lifecycle

- Fresh install opens edge-to-edge with no browser chrome.
- Splash/signature moment completes and app becomes interactive.
- Bottom tab bar is visible and safe-area correct.
- Background for 30 seconds, resume: current tab/session remains usable.
- Background for several minutes, resume: Supabase session is still valid or refreshes without a blank screen.
- Force-close and reopen: authentication persistence behaves correctly.

### Account / closed beta

Use at least two accounts: one with valid beta access and one authenticated account without beta access.

- Sign up with a valid beta invite.
- Confirmation email link opens the installed Pindrizzle app, not a browser-only flow.
- Sign in with email/password.
- Sign out and sign back in.
- Forgot password from the installed app.
- Reset email link opens the installed app at the reset screen.
- New password works; old password fails.
- Account without beta access can browse but sees the closed-beta participation gate.
- Account without beta access cannot create a pin, Confirm, Helpful, reply, follow, or promote.
- Valid beta account can perform those actions.

### Location

Test once after resetting app permissions so the OS prompt is genuine.

- First location action triggers the native OS permission dialog.
- Deny -> app shows a useful blocked state and does not loop permission prompts.
- Re-enable permission in device Settings -> app recovers.
- Allow approximate/coarse location where the OS supports it -> Feed/Map still work.
- Private location is selected by default when dropping a pin.
- Private pin stores/displays approximate area only.
- Exact location requires explicit user selection.
- Exact picker can be moved/tapped.
- Exact pin displays the selected public point.
- Switching Private -> Exact requires choosing an exact point.

### Create one pin in every current top-level category

- Alert
- Traffic
- Lost & Found
- Free
- Help
- Deals
- Marketplace
- Events
- Outages
- Other local

For each: create -> appears in My Pins -> appears in Feed/Map where appropriate -> open detail -> expiry/category data looks correct.

Marketplace: also test Property and the currently supported subtypes/intents/price presentation.

### Community interactions

Use a second beta-enabled account/device so you are not interacting with your own pin.

- Confirm a pin; count updates once and duplicate confirmation is not double-counted.
- Helpful action works once and persists after refresh/restart.
- Reply posts and survives refresh/restart.
- Follow/unfollow behaves correctly.
- Report a pin; reported pin is hidden for the reporting account.
- Block the other user; their content disappears where expected.
- Unblock from Safety/Privacy controls and confirm content behaviour recovers as designed.

### Push notifications — BLOCKED until native push pipeline is configured

After APNs/FCM work is complete, test:

- iOS permission prompt.
- Android permission prompt on versions that require it.
- Notification arrives while app is foregrounded.
- Notification arrives while app is backgrounded.
- Notification arrives after app is force-closed where OS policy permits.
- Tapping a pin-related notification opens the correct pin detail.
- Tapping a general notification opens Activity/Alerts.
- Sign out prevents the previous account's notifications from continuing to appear on that device.
- Disable notifications in Pindrizzle and in OS Settings; states remain truthful.

### Offline / poor connection

- Launch with airplane mode after at least one successful online run.
- Move between Feed/Map/My Pins while offline; no infinite loaders or white screens.
- Try posting while offline; failure is clear and does not create duplicate pins when connection returns.
- Start a post, switch to weak connection, submit once; verify no double submission.
- Restore connection; Feed/Map recover without reinstalling/restarting.
- Map tile/style failure has a controlled state.

### Resume / interruption

- Open composer, background app, return: draft is not corrupted.
- Open Exact-location picker, background app, return: map does not jump or lose the chosen point unexpectedly.
- Receive a phone call / lock screen / unlock: app remains usable.
- Rotate Android device if rotation is allowed; layout remains intact.
- Change system text size and dark/light system setting; no critical control becomes inaccessible.

## 9. Evidence to record during beta

For each platform/build record:

- device model
- OS version
- app version/build number
- tester account type (beta-enabled / no beta access)
- pass/fail for every checklist section
- screenshots/video for layout or permission issues
- exact steps for any crash or failed auth link

Never include passwords, beta invite secrets, auth tokens, seed phrases, API keys or signing keys in screenshots/bug reports.
