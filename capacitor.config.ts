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
  server: {
    url: parsed.origin,
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
