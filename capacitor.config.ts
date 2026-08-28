import type { CapacitorConfig } from "@capacitor/cli";

const betaUrl = process.env.CAPACITOR_SERVER_URL?.trim();

if (!betaUrl) {
  throw new Error(
    "CAPACITOR_SERVER_URL is required for native beta builds. Use the stable HTTPS beta deployment, for example https://beta.pindrizzle.com.",
  );
}

const parsed = new URL(betaUrl);
if (parsed.protocol !== "https:") {
  throw new Error("CAPACITOR_SERVER_URL must use HTTPS.");
}

const config: CapacitorConfig = {
  appId: "com.pindrizzle.app",
  appName: "Pindrizzle",
  webDir: "native-shell",
  backgroundColor: "#eef5f7",
  server: {
    url: parsed.origin,
    cleartext: false,
    allowNavigation: ["pindrizzle.com", "*.pindrizzle.com", "*.vercel.app"],
  },
  ios: {
    backgroundColor: "#eef5f7",
    contentInset: "never",
    preferredContentMode: "mobile",
  },
  android: {
    backgroundColor: "#eef5f7",
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;
