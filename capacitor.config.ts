import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pindrizzle.app",
  appName: "Pindrizzle",
  webDir: "out",
  backgroundColor: "#eef5f7",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  ios: {
    contentInset: "never",
    scrollEnabled: false,
  },
  android: {
    backgroundColor: "#eef5f7",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 500,
      backgroundColor: "#eef5f7",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: true,
      style: "LIGHT",
      backgroundColor: "#082b49",
    },
  },
};

export default config;
