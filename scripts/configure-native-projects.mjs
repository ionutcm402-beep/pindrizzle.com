import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function update(relative, transform) {
  const file = path.join(root, relative);
  const before = await readFile(file, "utf8");
  const after = transform(before);
  if (after !== before) await writeFile(file, after, "utf8");
}

await update("ios/App/App/Info.plist", (content) => {
  if (content.includes("NSCameraUsageDescription") && content.includes("pindrizzle</string>")) return content;
  const block = `
	<key>NSCameraUsageDescription</key>
	<string>Pindrizzle uses the camera only when you choose to add a photo to a pin.</string>
	<key>NSPhotoLibraryUsageDescription</key>
	<string>Pindrizzle lets you choose a photo to attach to a pin.</string>
	<key>NSLocationWhenInUseUsageDescription</key>
	<string>Pindrizzle uses your location while the app is open to show useful pins nearby and to place new pins.</string>
	<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
	<string>Pindrizzle uses location only while you are using the app; background location is not used.</string>
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLName</key>
			<string>com.pindrizzle.app.auth</string>
			<key>CFBundleURLSchemes</key>
			<array><string>pindrizzle</string></array>
		</dict>
	</array>`;
  return content.replace(/\n<\/dict>\n<\/plist>\s*$/, `${block}\n</dict>\n</plist>\n`);
});

await update("ios/App/App/AppDelegate.swift", (content) => {
  if (content.includes("capacitorDidRegisterForRemoteNotifications")) return content;
  const marker = `
    // Pindrizzle native push bridge required by @capacitor/push-notifications.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
`;
  const lastBrace = content.lastIndexOf("}");
  if (lastBrace < 0) throw new Error("Could not patch iOS AppDelegate.swift");
  return `${content.slice(0, lastBrace)}${marker}${content.slice(lastBrace)}`;
});

await update("android/app/src/main/AndroidManifest.xml", (content) => {
  let next = content;
  const permissions = [
    '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  ];
  for (const permission of permissions) {
    if (!next.includes(permission)) next = next.replace(/(<manifest[^>]*>)/, `$1\n    ${permission}`);
  }

  if (!next.includes('android:scheme="pindrizzle"')) {
    const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="pindrizzle" android:host="auth" />
            </intent-filter>`;
    const activityClose = next.indexOf("</activity>");
    if (activityClose < 0) throw new Error("Could not patch Android deep-link intent filter");
    next = `${next.slice(0, activityClose)}${filter}\n        ${next.slice(activityClose)}`;
  }
  return next;
});

console.log("Configured Pindrizzle native permissions, deep links and push hooks.");
