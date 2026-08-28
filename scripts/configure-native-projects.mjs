import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function update(relative, transform) {
  const file = path.join(root, relative);
  const before = await readFile(file, "utf8");
  const after = transform(before);
  if (after !== before) await writeFile(file, after, "utf8");
}

async function write(relative, content) {
  await writeFile(path.join(root, relative), content, "utf8");
}

function replacePlistString(content, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(<key>${escaped}<\\/key>\\s*<string>)[\\s\\S]*?(<\\/string>)`);
  return pattern.test(content) ? content.replace(pattern, `$1${value}$2`) : content;
}

await update("ios/App/App/Info.plist", (content) => {
  let next = content;

  next = replacePlistString(next, "CFBundleDisplayName", "Pindrizzle");
  next = replacePlistString(
    next,
    "NSCameraUsageDescription",
    "Pindrizzle uses the camera only when you choose to take a photo for a pin. The photo is processed before upload to remove embedded location metadata.",
  );
  next = replacePlistString(
    next,
    "NSPhotoLibraryUsageDescription",
    "Pindrizzle lets you choose a photo from your library to attach to a pin. Only the photo you select is accessed, and it is processed before upload to remove embedded location metadata.",
  );
  next = replacePlistString(
    next,
    "NSLocationWhenInUseUsageDescription",
    "Pindrizzle uses your location while you use the app to show nearby pins in Feed and Map and to place a new pin near you. Your exact pin location is public only when you explicitly choose Exact.",
  );

  // Pindrizzle never requests background/Always location. Keeping this key would
  // imply a permission scope the product does not use and create unnecessary review risk.
  next = next.replace(/\s*<key>NSLocationAlwaysAndWhenInUseUsageDescription<\/key>\s*<string>[\s\S]*?<\/string>/g, "");

  const portraitOnly = `
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
	</array>
	<key>UISupportedInterfaceOrientations~ipad</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
	</array>`;
  next = next.replace(
    /\s*<key>UISupportedInterfaceOrientations<\/key>\s*<array>[\s\S]*?<\/array>\s*<key>UISupportedInterfaceOrientations~ipad<\/key>\s*<array>[\s\S]*?<\/array>/,
    portraitOnly,
  );

  if (!next.includes("NSCameraUsageDescription")) {
    const permissions = `
	<key>NSCameraUsageDescription</key>
	<string>Pindrizzle uses the camera only when you choose to take a photo for a pin. The photo is processed before upload to remove embedded location metadata.</string>
	<key>NSPhotoLibraryUsageDescription</key>
	<string>Pindrizzle lets you choose a photo from your library to attach to a pin. Only the photo you select is accessed, and it is processed before upload to remove embedded location metadata.</string>
	<key>NSLocationWhenInUseUsageDescription</key>
	<string>Pindrizzle uses your location while you use the app to show nearby pins in Feed and Map and to place a new pin near you. Your exact pin location is public only when you explicitly choose Exact.</string>`;
    next = next.replace(/\n<\/dict>\n<\/plist>\s*$/, `${permissions}\n</dict>\n</plist>\n`);
  }

  if (!next.includes("<string>pindrizzle</string>")) {
    const deepLink = `
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLName</key>
			<string>com.pindrizzle.app.auth</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>pindrizzle</string>
			</array>
		</dict>
	</array>`;
    next = next.replace(/\n<\/dict>\n<\/plist>\s*$/, `${deepLink}\n</dict>\n</plist>\n`);
  }

  return next;
});

await write("ios/App/App/App.entitlements", `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>development</string>
</dict>
</plist>
`);

await update("ios/App/App.xcodeproj/project.pbxproj", (content) => {
  let next = content
    .replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, "PRODUCT_BUNDLE_IDENTIFIER = com.pindrizzle.app;")
    .replace(/IPHONEOS_DEPLOYMENT_TARGET = [^;]+;/g, "IPHONEOS_DEPLOYMENT_TARGET = 15.0;");

  if (!next.includes("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;")) {
    next = next.replace(
      /CODE_SIGN_STYLE = Automatic;/g,
      "CODE_SIGN_STYLE = Automatic;\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;",
    );
  }

  if (!next.includes("com.apple.Push")) {
    next = next.replace(
      "ProvisioningStyle = Automatic;",
      `ProvisioningStyle = Automatic;
						SystemCapabilities = {
							com.apple.Push = {
								enabled = 1;
							};
						};`,
    );
  }

  return next;
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

console.log("Configured Pindrizzle native permissions, deep links, iOS App Store target settings and push hooks.");
