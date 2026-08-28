# Pindrizzle Native Beta Testing Runbook

This phase is for **real iPhone and Android device testing before public submission**. The native app remains a closed beta. Do not move Supabase `app_release_state.stage` to `public`, enable live payments, or submit a production store release during this phase.

## Current technical state

- Native app identity: `com.pindrizzle.app`
- App name: Pindrizzle
- Native branch: `phase-25-8-capacitor-native`
- Supabase release stage: `closed_beta`
- Capacitor iOS and Android projects exist.
- Native geolocation, camera/photo selection, deep links and push registration are wired.
- Native push database schema/RPCs are applied to the beta Supabase project.
- Closed-beta participation is enforced in PostgreSQL, not only by the UI.

## Before the first real-device beta

These are required before a complete device test:

1. In Supabase Authentication -> URL Configuration, add this allowed redirect without removing existing web redirects:
   `pindrizzle://auth/callback`
2. iOS push:
   - active Apple Developer membership
   - App ID `com.pindrizzle.app`
   - Push Notifications capability enabled
   - APNs `.p8` key/team/key IDs configured on the Pindrizzle push backend
3. Android push:
   - Firebase Android app registered as `com.pindrizzle.app`
   - `google-services.json` placed locally at `android/app/google-services.json`
   - FCM service-account credentials configured on the Pindrizzle push backend
4. Use a beta account that has active `beta_access` for participation tests.
5. Also create one signed-in account **without** beta access to verify that closed-beta enforcement cannot be bypassed in the native WebView.

---

# iOS — TestFlight internal testing

## Account/App Store Connect setup — manual

1. Use an active Apple Developer Program account.
2. In App Store Connect -> Apps, create/select **Pindrizzle**.
3. Bundle ID must be exactly `com.pindrizzle.app`.
4. In Xcode open `ios/App/App.xcodeproj`.
5. Select target **App** -> Signing & Capabilities:
   - select your Apple Development Team
   - keep automatic signing unless you intentionally manage profiles manually
   - verify Push Notifications capability
6. Increase the build number for every upload. Version may remain `1.0` during the beta, but each uploaded build needs a unique build number.

## Create and upload the beta build — manual on Mac/Xcode

1. Run the native preparation steps for the exact beta commit.
2. In Xcode choose a generic iOS device / Any iOS Device destination, not a Simulator.
3. Product -> Archive.
4. When Organizer opens, select the archive.
5. Distribute App -> App Store Connect -> Upload.
6. Resolve any signing/export-compliance warnings Xcode/App Store Connect reports.
7. Wait for the build to finish processing in App Store Connect -> Pindrizzle -> TestFlight.

## Internal tester group

Apple internal testers must be **App Store Connect users**. They are not arbitrary email-only testers.

1. App Store Connect -> Pindrizzle -> TestFlight.
2. Under **Internal Testing**, click `+` and create group `Pindrizzle Beta`.
3. Optional: enable automatic distribution for future uploaded builds.
4. Add the processed build to the group.
5. Enter `What to Test`, for example:
   `Test Feed, Map, Private/Exact pin creation, replies, Confirm/Helpful, reports/blocks, password reset, push notifications, poor connection and app resume.`
6. Click **Invite Testers**.
7. Add yourself and trusted team members who already exist in App Store Connect Users and Access.
8. Testers install Apple's TestFlight app, accept the invitation and install Pindrizzle.

Internal testing supports up to 100 App Store Connect users. TestFlight builds expire after 90 days.

If friends/family are **not** App Store Connect users, use an External Testing group instead. External TestFlight distribution can require Apple Beta App Review.

---

# Android — Google Play Internal Testing

## Play/Firebase setup — manual

1. In Google Play Console create/select **Pindrizzle**.
2. Package/application ID must be exactly `com.pindrizzle.app`.
3. Enrol in Play App Signing when prompted.
4. Create/register Firebase Android app `com.pindrizzle.app`.
5. Download Firebase `google-services.json` to:
   `android/app/google-services.json`
6. Do not commit `google-services.json`.
7. Keep the Android upload keystore and passwords outside Git/GitHub.

## Build the internal-testing bundle — manual

1. Open `android/` in Android Studio.
2. Increment `versionCode` for each Play upload.
3. Build -> Generate Signed App Bundle or APK.
4. Choose **Android App Bundle**.
5. Sign with the Pindrizzle upload key.
6. Produce a signed `.aab`.

## Internal testing track

1. Play Console -> Pindrizzle -> Test and release -> Testing -> Internal testing.
2. Open **Testers**.
3. Create an email list such as `Pindrizzle Beta`.
4. Add your Google-account email and your trusted testers' Google-account emails.
5. Internal testing supports up to 100 testers.
6. Add a feedback email/URL and save.
7. Go back to the release tab and choose **Create new release**.
8. Upload the signed `.aab`.
9. Add release notes, for example:
   `First native closed-beta build. Please test location privacy, posting, interactions, notifications, offline behavior and app resume.`
10. Review and roll out the release to **Internal testing** only.
11. Copy the tester opt-in/share link and send it to testers.
12. Each tester must open the link while signed into an allowed Google account, opt in, then install Pindrizzle from Google Play.

Do not choose Production during this phase.

---

# Real-device manual test checklist

Run the checklist on **at least one physical iPhone and one physical Android phone**. Simulator/emulator success is useful but does not verify camera, push delivery, background/resume, real GPS or OS permission behavior completely.

Record: device model, OS version, app version/build, account email, beta-access state, Pass/Fail and notes.

## A. Install / native shell

- [ ] Fresh install succeeds from TestFlight / Play Internal Testing.
- [ ] Pindrizzle opens full-screen without browser chrome.
- [ ] Safe areas are correct around notch/Dynamic Island/home indicator/system navigation.
- [ ] Bottom tab bar remains visible and tappable.
- [ ] Splash/open signature moment plays once and does not delay usability.
- [ ] Background -> resume returns to the same usable state without a white flash or reload loop.
- [ ] Force-close -> reopen restores authentication appropriately.

## B. Account and native auth deep links

- [ ] Sign up inside the installed app.
- [ ] Receive confirmation email.
- [ ] Tap confirmation link and confirm it returns into **Pindrizzle**, not a browser dead-end.
- [ ] Sign out.
- [ ] Sign in again.
- [ ] Forgot password from the installed app.
- [ ] Receive reset email.
- [ ] Tap reset link and confirm it opens the native Pindrizzle reset-password flow.
- [ ] Set a new password successfully.
- [ ] Confirm the new password works after another sign out/sign in.

## C. Closed-beta access

### Invited beta account

- [ ] Signed-in invited tester can browse Feed and Map.
- [ ] Can create a pin.
- [ ] Can reply.
- [ ] Can Confirm.
- [ ] Can mark Helpful.
- [ ] Can follow where applicable.
- [ ] Closed-beta UI accurately shows access active.

### Signed-in account without beta access

- [ ] Can browse permitted public/beta-visible content.
- [ ] Sees the closed-beta/invite messaging.
- [ ] Attempt to create a pin is refused.
- [ ] Attempt to reply is refused.
- [ ] Attempt to Confirm is refused.
- [ ] Attempt to mark Helpful is refused.
- [ ] Cannot bypass the restriction by backgrounding/reopening or navigating directly.
- [ ] Safety actions such as report/block remain testable as designed.

## D. Location permissions and privacy

Run this from a fresh install if possible.

- [ ] First location request shows the real iOS/Android system permission prompt.
- [ ] Deny location: app remains usable and explains how to continue/enable location.
- [ ] Grant approximate/coarse OS location where the OS offers that choice: app behaves sensibly.
- [ ] Grant precise OS location: nearby Feed/Map works.
- [ ] Feed radius changes work.
- [ ] Map recenter works.

### Private pin — default

- [ ] Open Drop a pin.
- [ ] Location choice defaults to **Private**.
- [ ] Publish a Private pin.
- [ ] Public/map position is approximate rather than the exact selected GPS point.
- [ ] Reopen/edit does not silently change Private to Exact.

### Exact pin — explicit opt-in

- [ ] Choose **Exact** deliberately.
- [ ] Select the exact point on the map.
- [ ] Publish.
- [ ] Exact pin appears at that chosen point.
- [ ] Private -> Exact cannot occur without explicitly choosing a new exact point.

## E. Create one pin in every launch category

For each pin, verify category label, title/body, location behavior, Feed visibility, Map behavior where applicable, expiry/time display and detail opening.

- [ ] Alert
- [ ] Traffic
- [ ] Lost & Found
- [ ] Free
- [ ] Help
- [ ] Local / Other local as currently labelled in the native build
- [ ] Deals
- [ ] Events
- [ ] Outages
- [ ] Marketplace

For Marketplace also verify any current subtype/price/property fields that are visible in the launch build.

## F. Photos

- [ ] Add photo using camera on a physical phone.
- [ ] Add photo using photo library/system picker.
- [ ] Cancel camera/picker: composer stays stable.
- [ ] Reject unsupported/oversized file safely.
- [ ] Uploaded image displays correctly in the resulting pin.
- [ ] No unexpected OS storage permission is requested on Android.

## G. Community interactions

Use two beta-enabled accounts/devices where possible.

- [ ] Open pin detail.
- [ ] Confirm a pin.
- [ ] Remove/change confirmation if supported.
- [ ] Mark Helpful.
- [ ] Reply.
- [ ] Reply/thread presentation is correct after app restart.
- [ ] Report a pin/content item.
- [ ] Block another user.
- [ ] Blocked user's content/interaction behaves according to the current product rules.
- [ ] Activity screen records relevant events without duplicate entries.

## H. Push notifications — physical devices required

Test with the app in foreground, background and fully closed.

### iPhone

- [ ] Enable push from Pindrizzle settings.
- [ ] iOS system notification prompt appears.
- [ ] Allow notifications.
- [ ] Device registers a native iOS push token.
- [ ] Trigger an event from another account that should notify this user.
- [ ] Notification arrives with app backgrounded.
- [ ] Notification arrives with app closed where expected.
- [ ] Tap notification -> opens the correct Pindrizzle screen/pin.
- [ ] Disable notifications in app / OS and verify behavior is clear.

### Android

- [ ] Enable push.
- [ ] Android notification permission appears on Android 13+.
- [ ] `Pindrizzle updates` notification channel exists.
- [ ] Device registers an FCM token.
- [ ] Trigger an event from another account.
- [ ] Notification arrives in background/closed state.
- [ ] Tap notification -> correct Pindrizzle target.
- [ ] Test with battery optimisation/default settings; note any manufacturer-specific delay.

## I. Offline / poor connection

Test Airplane Mode and a throttled/weak mobile connection.

- [ ] Launch while offline gives a useful offline/connection state rather than a blank screen.
- [ ] Feed request failure is understandable and recoverable.
- [ ] Map failure/degraded loading is understandable.
- [ ] Attempting to post offline does not falsely claim success.
- [ ] Restore connection -> retry/refresh succeeds without reinstalling.
- [ ] Slow upload does not duplicate a pin when the user taps more than once.
- [ ] Photo upload failure is recoverable.
- [ ] Auth session survives temporary connectivity loss.

## J. Background / resume lifecycle

- [ ] Leave Feed, background for 30 seconds, resume.
- [ ] Leave Map, background for several minutes, resume.
- [ ] Resume after changing OS location permission while app is backgrounded.
- [ ] Resume after changing notification permission in OS Settings.
- [ ] Deep-link into app from confirmation/reset email while app is already running.
- [ ] Open notification while app is running/backgrounded.
- [ ] No duplicate splash loop on normal resume.
- [ ] No duplicate pin submission or stale modal after resume.

## K. Final beta sign-off

Do not advance to public submission until:

- [ ] iPhone checklist passes on a physical device.
- [ ] Android checklist passes on a physical device.
- [ ] Sign-up confirmation and password reset deep links pass on both platforms.
- [ ] Private/Exact location behavior is physically verified.
- [ ] Push delivery and notification tap routing pass on both platforms.
- [ ] Closed-beta account without access cannot participate.
- [ ] Beta-enabled account can complete all intended launch interactions.
- [ ] Critical/high bugs are fixed and retested in a newer beta build.
- [ ] Store privacy/legal metadata matches observed device behavior.

## What cannot be proven by code review alone

The following require physical-device testing:

- real GPS permission wording/behavior and OS-level precise/approximate choices
- real camera/photo picker behavior
- APNs delivery to an iPhone
- FCM delivery to an Android phone
- notification behavior while backgrounded/terminated
- battery optimisation/manufacturer Android behavior
- confirmation/reset email deep-link handoff from Mail/Gmail into the installed app
- safe-area behavior across actual notched devices
- cellular/poor-network behavior
- background/resume lifecycle under real OS memory pressure

A successful CI build or Simulator/emulator launch does **not** replace these tests.
