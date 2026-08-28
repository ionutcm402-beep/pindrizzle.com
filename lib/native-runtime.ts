import { Capacitor } from "@capacitor/core";

export function isNativeRuntime() {
  return Capacitor.isNativePlatform();
}

export function authRedirectUrl(kind: "confirm" | "reset") {
  if (!isNativeRuntime()) {
    return kind === "reset" ? `${window.location.origin}/reset-password` : window.location.origin;
  }
  return kind === "reset" ? "pindrizzle://reset-password" : "pindrizzle://auth";
}

export function nativePlatform() {
  return isNativeRuntime() ? Capacitor.getPlatform() : "web";
}
