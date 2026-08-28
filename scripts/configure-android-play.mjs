import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function exists(relative) {
  try {
    await access(path.join(root, relative));
    return true;
  } catch {
    return false;
  }
}

async function update(relative, transform) {
  const file = path.join(root, relative);
  const before = await readFile(file, "utf8");
  const after = transform(before);
  if (after !== before) await writeFile(file, after, "utf8");
}

const manifest = `<?xml version="1.0" encoding="utf-8" ?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Pindrizzle only requests permissions used by current product features. -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!-- No CAMERA or storage/media permission is declared. Capacitor Camera uses
         the system camera activity / Android Photo Picker and Pindrizzle never
         saves captured images back to the device gallery. -->

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="false">

        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="@string/default_notification_channel_id" />

        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="pindrizzle" android:host="auth" />
            </intent-filter>
        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
`;

await writeFile(path.join(root, "android/app/src/main/AndroidManifest.xml"), manifest, "utf8");

await writeFile(
  path.join(root, "android/app/src/main/res/values/strings.xml"),
  `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">Pindrizzle</string>
    <string name="title_activity_main">Pindrizzle</string>
    <string name="package_name">com.pindrizzle.app</string>
    <string name="custom_url_scheme">com.pindrizzle.app</string>
    <string name="default_notification_channel_id">pindrizzle-updates</string>
</resources>
`,
  "utf8",
);

await update("android/app/build.gradle", (content) => content
  .replace(/namespace\s*=\s*["'][^"']+["']/, 'namespace = "com.pindrizzle.app"')
  .replace(/applicationId\s+["'][^"']+["']/, 'applicationId "com.pindrizzle.app"'));

await update("android/variables.gradle", (content) => content
  .replace(/minSdkVersion\s*=\s*\d+/, "minSdkVersion = 24")
  .replace(/compileSdkVersion\s*=\s*\d+/, "compileSdkVersion = 36")
  .replace(/targetSdkVersion\s*=\s*\d+/, "targetSdkVersion = 36"));

const buildGradle = await readFile(path.join(root, "android/app/build.gradle"), "utf8");
if (!buildGradle.includes("com.google.gms.google-services")) {
  throw new Error("Android app Gradle config must conditionally apply the Google Services plugin for FCM.");
}

const rootGradle = await readFile(path.join(root, "android/build.gradle"), "utf8");
if (!rootGradle.includes("com.google.gms:google-services")) {
  throw new Error("Android root Gradle config is missing the Google Services classpath required by FCM.");
}

const capacitorGradle = await readFile(path.join(root, "android/app/capacitor.build.gradle"), "utf8");
if (!capacitorGradle.includes("capacitor-push-notifications")) {
  throw new Error("@capacitor/push-notifications is not synced into the Android project.");
}

const expectedIcons = [
  "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml",
  "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml",
];
for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
  expectedIcons.push(
    `android/app/src/main/res/mipmap-${density}/ic_launcher.png`,
    `android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`,
    `android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`,
    `android/app/src/main/res/mipmap-${density}/ic_launcher_background.png`,
  );
}
for (const icon of expectedIcons) {
  if (!(await exists(icon))) throw new Error(`Missing generated Android launcher asset: ${icon}`);
}

const hasFirebaseConfig = await exists("android/app/google-services.json");
console.log(`Configured Google Play identity, API 36 target, minimal permissions and launcher assets. FCM credentials: ${hasFirebaseConfig ? "present" : "not present (expected until Firebase setup)"}.`);
