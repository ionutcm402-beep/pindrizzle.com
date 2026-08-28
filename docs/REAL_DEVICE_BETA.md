# Pindrizzle real-device beta runbook

Status: closed beta only. This document prepares internal TestFlight and Google Play Internal Testing. It does not authorize a public release.

## 0. Current safety state

- Supabase `app_release_state.stage` must remain `closed_beta` throughout this phase.
- Participation is enforced in Postgres, not only in the UI. Users without active beta access are blocked from inserting pings, confirmations, comments, Helpful actions, follows and promotions.
- Private location remains the default. Exact location remains an explicit per-pin choice.
- Live Stripe payments remain off.
- App ID / package name: `com.pindrizzle.app`.
- Native URL scheme: `pindrizzle`.
- Native auth return URL: `pindrizzle://auth/callback`.

## 1. Stable beta web origin

The current Next.js product still depends on server/API routes. For internal native beta, Capacitor loads a stable HTTPS beta deployment through `CAPACITOR_SERVER_URL`.

Use a persistent URL such as:

`https://beta.pindrizzle.com`

Requirements:

- HTTPS only.
- No temporary `_vercel_share` parameter.
- No Vercel Authentication login wall for testers.
- Must point to the native-beta code being tested.
- Must not be the public `pindrizzle.com` production origin unless explicitly approved.

Set locally before `cap sync`:

```bash
CAPACITOR_SERVER_URL=https://beta.pindrizzle.com
```

The repository guard `npm run native:check` fails if this is missing, temporary, insecure or accidentally points at public production.

## 2. Supabase Auth URL configuration

Before testing confirmation/reset links from the installed app:

1. Supabase Dashboard -> Authentication -> URL Configuration.
2. Keep the existing HTTPS production/controlled beta redirects.
3. Add the native redirect pattern `pindrizzle://**` (or the exact callback if Supabase accepts it in the current dashboard).
4. Save.
5. Do not change the release stage.

The native client rewrites sign-up and reset `redirect_to` values to `pindrizzle://auth/callback`. The installed app handles that URL and routes a password-recovery callback to `/reset-password` inside Pindrizzle.

## 3. Generate native projects

On a development machine with Node installed:

```bash
git checkout phase-26-capacitor-beta
npm install
npx cap add ios
npx cap add android
CAPACITOR_SERVER_URL=https://beta.pindrizzle.com npm run cap:sync
```

After the first generation, commit the resulting `ios/` and `android/` folders to the native-beta branch only after the settings below are correct. Never commit Apple private keys, Android keystores, Firebase service-account JSON, `google-services.json` if the project treats it as secret, or signing passwords.

## 4. iOS project configuration

Requires macOS + Xcode + an active Apple Developer Program membership.

### Identity and signing

1. Run `npm run native:ios` or open `ios/App/App.xcworkspace`.
2. Select the App target -> Signing & Capabilities.
3. Team: select the Apple Developer team that owns Pindrizzle.
4. Bundle Identifier: `com.pindrizzle.app`.
5. Keep automatic signing on for the first internal beta unless there is a deliberate manual-signing setup.
6. Add the **Push Notifications** capability.
7. Do not add background location capability.

### Location privacy text

Add to `ios/App/App/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Pindrizzle uses your location to show useful nearby pins and to place a pin when you choose to post.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Pindrizzle uses your location to show useful nearby pins and to place a pin when you choose to post.</string>
```

Pindrizzle does not request background location.

### Native URL scheme

In `Info.plist`, add a URL type with URL Schemes containing:

`pindrizzle`

This is required for `pindrizzle://auth/callback`.

### Push registration forwarding

In `AppDelegate.swift`, forward Apple remote-notification registration to Capacitor:

```swift
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
}

func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
}
```

### APNs provider key

In Apple Developer -> Certificates, Identifiers & Profiles -> Keys:

1. Create or select a key with Apple Push Notifications service access.
2. Download the `.p8` once and store it securely.
3. Record Key ID and Team ID.
4. Configure the beta server secrets:

```text
PINDRIZZLE_APNS_TEAM_ID=<Team ID>
PINDRIZZLE_APNS_KEY_ID=<Key ID>
PINDRIZZLE_APNS_PRIVATE_KEY=<contents of the .p8 key>
PINDRIZZLE_APNS_BUNDLE_ID=com.pindrizzle.app
PINDRIZZLE_APNS_ENV=production
```

TestFlight/distribution builds use production APNs.

## 5. TestFlight internal testing

### Create the App Store Connect app

1. Open App Store Connect -> Apps -> **+** -> New App.
2. Platforms: iOS.
3. Name: Pindrizzle.
4. Primary language: English (UK) unless deliberately changed.
5. Bundle ID: the identifier for `com.pindrizzle.app`.
6. SKU: an internal unique value such as `pindrizzle-ios-001`.

### Upload a build

In Xcode:

1. Select a generic/connected iOS device, not a simulator.
2. Product -> Archive.
3. In Organizer: Distribute App -> App Store Connect -> Upload.
4. Resolve any signing/export-compliance prompts.
5. Wait for the build to finish processing in App Store Connect -> TestFlight.

Increment the Xcode build number before every subsequent upload.

### Add internal testers

1. App Store Connect -> Users and Access: invite any internal tester who is not already an App Store Connect user.
2. App -> TestFlight -> Internal Testing -> create group `Pindrizzle Internal`.
3. Add the processed build.
4. Add yourself and the chosen internal testers.
5. Add concise **What to Test** notes, e.g. `Auth, Private/Exact location, posting, interactions, push, offline/resume.`
6. On each iPhone install Apple's **TestFlight** app, accept the invitation and install Pindrizzle.

Use internal testing first. Do not add external testers or submit a public App Store version during this phase.

## 6. Android project configuration

Requires Android Studio / Android SDK and a Google Play developer account.

### Package and permissions

Package/application ID must remain:

`com.pindrizzle.app`

Add to `android/app/src/main/AndroidManifest.xml` above `<application>`:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

Do not add background-location permission.

Inside the main activity, add an intent filter for the Pindrizzle custom scheme:

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="pindrizzle" />
</intent-filter>
```

### Firebase / FCM

1. Firebase Console -> create/select the Pindrizzle project.
2. Add an Android app with package `com.pindrizzle.app`.
3. Download `google-services.json`.
4. Put it at `android/app/google-services.json`.
5. In Firebase/Google Cloud, ensure the Firebase Cloud Messaging API is enabled.
6. Create a server service account/key for the Pindrizzle push sender and store its JSON as the server-only secret:

`PINDRIZZLE_FIREBASE_SERVICE_ACCOUNT_JSON`

The client receives an FCM registration token. The Pindrizzle server exchanges the service-account credential for a short-lived OAuth token and sends through FCM HTTP v1.

### Android push icon

Before wider testing, generate a proper monochrome notification icon in Android Studio and set it as the Firebase default notification icon. Do not rely on the full-colour launcher artwork as a status-bar notification glyph.

## 7. Google Play Internal Testing

### Create the Play Console app

1. Play Console -> All apps -> Create app.
2. App name: Pindrizzle.
3. Default language: English (United Kingdom), unless deliberately changed.
4. App or game: App.
5. Free or paid: choose the intended listing state; internal testing itself does not enable Pindrizzle live payments.
6. Complete the account/app declarations Play requires before it allows a release.
7. Keep Play App Signing enabled.

### Create a signed Android App Bundle

In Android Studio:

1. Build -> Generate Signed Bundle / APK.
2. Choose **Android App Bundle**.
3. Create/use a secure upload keystore.
4. Store the keystore and passwords securely outside the repository.
5. Build the release `.aab`.
6. Increase `versionCode` for every later Play upload.

### Internal testing track

1. Play Console -> Testing -> Internal testing.
2. Testers -> create an email list / Google Group and add up to the internal group you want.
3. Releases -> Create new release.
4. Upload the signed `.aab`.
5. Add release notes / testing notes.
6. Review and roll out to Internal testing.
7. Copy the tester opt-in link.
8. Each tester opens the link using the Google account included in the tester list, opts in, then installs Pindrizzle from Google Play.

Do not promote the build to Closed/Open testing or Production during this phase.

## 8. Real-device manual acceptance checklist

Record `PASS`, `FAIL`, device/OS and notes for every item. Test on at least one physical iPhone and one physical Android phone. A second beta account/device is needed for interaction and notification cases.

### Install / shell / navigation

- Fresh install launches to Pindrizzle with no browser chrome.
- No visible website-card border/background around the app.
- Status-bar/notch and home-indicator safe areas are correct.
- Bottom tab bar remains visible and tappable.
- Keyboard does not permanently hide important controls.
- Feed -> Map -> My Pins -> Activity -> You navigation has no browser reload flash.
- External HTTPS links open outside the app and returning restores Pindrizzle.
- Force-close/relaunch preserves the correct signed-in state.

### Closed-beta gate

- Signed-out user can perform the intended public browsing only.
- New sign-up in closed beta requires a valid beta invite.
- Invalid/expired invite is rejected.
- A signed-in account with no active `beta_access` cannot post a pin.
- Same no-access account cannot Confirm, Helpful, reply, follow or promote.
- A valid invited account can perform those actions.
- Revoked beta access stops participation without reinstalling the app.

### Sign up / sign in / reset

- Sign up from the installed app with a valid beta invite.
- Confirmation email arrives.
- Tapping the confirmation link returns to the installed Pindrizzle app, not a stranded browser tab.
- Sign out and sign in again using email/password.
- Wrong password shows a controlled error.
- Forgot password from the installed app sends the reset email.
- Tapping reset email opens the installed app on the reset-password flow.
- New password works; old password no longer works.
- Repeat one auth return while app is backgrounded and one while app is force-closed.

### Location permission / privacy

- First explicit location action triggers the real OS permission prompt.
- Deny -> app stays usable and explains location is blocked/unavailable.
- Re-enable in iOS/Android system Settings -> returning to app recovers without reinstall.
- Android: test Approximate permission if offered.
- Android: test Precise permission if offered.
- Feed and Map recenter correctly after permission.
- New pin defaults to **Private location**.
- Private publish shows an approximate area, not the selected exact point.
- Exact requires deliberate selection.
- Exact published point matches the chosen map point closely enough to be useful.
- Switching back to Private before publish does not leak the exact point.

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

For Deals, also test merchant/source/kind fields. For Marketplace, test at least Property and Vehicle, including price/period and one Parking space subtype under Property. For one category attach a real camera/gallery photo and confirm it uploads/displays correctly.

For each created pin verify Feed, Map, My Pins, expiry/status and full detail agree.

### Community interactions — use a second account/device

- Confirm another user's pin; count changes once and duplicate Confirm does not inflate incorrectly.
- Mark Helpful where available; reputation/activity updates correctly.
- Reply; owner receives activity and content appears in detail.
- Follow a pin; outcome appears in Following/activity as intended.
- Report a pin; reporter no longer sees it where expected and moderation data is created.
- Block another user; their content is hidden according to the product rules.
- Unblock and re-check visibility.
- Try reporting/confirming your own pin and confirm prohibited actions are rejected.

### Native push — must be physical-device tested

On both platforms:

- Notifications screen asks for the native OS notification permission, not browser permission.
- Enable push registers exactly one active native device for the account.
- Trigger a Reply notification from the second account/device.
- Trigger Confirmation notification.
- Trigger Helpful notification.
- Verify foreground delivery.
- Background the app and verify delivery.
- Lock the phone and verify delivery.
- Force-close the app and verify notification display.
- Tap a pin-related notification and confirm Pindrizzle opens the correct pin/detail.
- Sign out and verify that device no longer receives notifications for the previous account.
- Sign into a second account and enable push; verify the token is attached to the new account only.

Additional Android checks:

- Android 13+ notification permission prompt behaves correctly.
- The Pindrizzle notification channel exists in system settings.
- Notification status-bar icon is clean, not a white square.
- Test once with battery saver / Doze conditions if practical.

Additional iOS checks:

- TestFlight build obtains a real APNs token on a physical iPhone.
- Banner/list/sound behavior matches system permission choices.
- Notification tap works from locked/background/terminated state.

### Offline / poor connection

- Open app online, then enable Airplane Mode.
- App shows a controlled offline/failed state rather than a blank/crash.
- Attempt a Confirm/reply/post while offline; no phantom success.
- Restore connection; refresh/retry works without duplicate mutation.
- Test on weak/slow mobile data if possible.
- Start a photo upload then interrupt the network; text/photo outcome is explained honestly.
- Map failure does not block access to non-map screens.

### Background / resume / interruptions

- Background for 30 seconds and resume.
- Background for 10+ minutes and resume.
- Lock/unlock while on Feed.
- Lock/unlock while composer is open.
- Switch apps during exact-location selection and return.
- Receive a phone call/system interruption and return.
- Rotate only if platform/device permits rotation; layout must not become unusable.
- Session refresh after long background does not unexpectedly sign the tester out.
- Map resizes/recenters correctly after resume.
- No duplicate composer submission after interruption.

## 9. What code review cannot prove

The following remain **real-device-only** acceptance gates:

- actual TestFlight installation, signing and launch on an iPhone;
- actual Play Internal Testing installation/update flow;
- APNs token issuance and APNs delivery on physical iPhone;
- FCM delivery under real Android OS/battery conditions;
- OS location permission wording, deny/re-enable and Android Approximate vs Precise behavior;
- Mail/Gmail confirmation/reset handoff back into the installed app;
- safe areas, system keyboard, status bar and home indicator on actual hardware;
- lock-screen/background/terminated notification behavior;
- GPS quality in Private vs Exact flows;
- weak-radio/Airplane Mode recovery;
- WebView lifecycle after long backgrounding and real OS interruptions.

Do not mark any of those complete from desktop browser QA alone.

## 10. Beta exit criteria

Do not submit publicly until:

- all critical checklist items pass on both iPhone and Android;
- no severity-1 privacy/auth/location/push defect remains;
- closed-beta gate is still active until the deliberate public-release step;
- native auth redirects are verified end-to-end;
- native push is verified end-to-end;
- legal/operator/support details are complete;
- the correct Pindrizzle payment identity is configured before live payments;
- explicit release approval is given.
