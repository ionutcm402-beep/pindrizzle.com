import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = (process.env.CAPACITOR_SERVER_URL || "").trim();

const config: CapacitorConfig = {
  appId: "com.pindrizzle.app",
  appName: "Pindrizzle",
  webDir: "native-web",
  backgroundColor: "#eef5f7",
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: false,
        allowNavigation: ["pindrizzle.com", "*.pindrizzle.com", "*.vercel.app"],
      }
    : undefined,
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
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
