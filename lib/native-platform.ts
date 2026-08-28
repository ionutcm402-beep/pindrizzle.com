import { Capacitor } from "@capacitor/core";

export type PindrizzleNativePlatform = "ios" | "android" | "web";

export function isPindrizzleNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function pindrizzleNativePlatform(): PindrizzleNativePlatform {
  if (!isPindrizzleNativeApp()) return "web";
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
}

export function pindrizzleAuthRedirectUrl() {
  if (isPindrizzleNativeApp()) return "pindrizzle://auth/callback";
  if (typeof window !== "undefined") return `${window.location.origin}/reset-password`;
  return "https://pindrizzle.com/reset-password";
}

export function pindrizzleSignupRedirectUrl() {
  if (isPindrizzleNativeApp()) return "pindrizzle://auth/callback";
  if (typeof window !== "undefined") return window.location.origin;
  return "https://pindrizzle.com";
}
