import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";

const TOKEN_KEY = "ping-native-push-token";

export type NativePushState = "unsupported" | "off" | "blocked" | "on";

function nativePlatform(): "ios" | "android" | null {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return null;
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : null;
}

function storedToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
function saveToken(token: string) {
  try { if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY); } catch {}
}

export function supportsNativePush() {
  return nativePlatform() !== null;
}

export async function readNativePushState(userId: string | null): Promise<NativePushState> {
  const platform = nativePlatform();
  if (!platform) return "unsupported";
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const permission = await PushNotifications.checkPermissions();
  if (permission.receive === "denied") return "blocked";
  const token = storedToken();
  if (!userId || permission.receive !== "granted" || !token) return "off";

  const { error } = await createClient().rpc("upsert_native_push_device", {
    device_platform: platform,
    device_token: token,
    device_label: `${platform} · Pindrizzle native`,
  });
  if (error) console.error("Native push token refresh failed", error);
  return "on";
}

export async function enableNativePush(userId: string): Promise<void> {
  const platform = nativePlatform();
  if (!platform) throw new Error("Native push is not available on this device.");
  if (!userId) throw new Error("Sign in before enabling notifications.");

  const { PushNotifications } = await import("@capacitor/push-notifications");
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== "granted") throw new Error("Notification permission was not granted.");

  if (platform === "android") {
    await PushNotifications.createChannel({
      id: "pindrizzle-updates",
      name: "Pindrizzle updates",
      description: "Useful local activity from Pindrizzle",
      importance: 3,
      visibility: 1,
    });
  }

  const token = await new Promise<string>(async (resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Native push registration timed out."));
    }, 15000);
    const registered = await PushNotifications.addListener("registration", (value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(value.value);
    });
    const failed = await PushNotifications.addListener("registrationError", (value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(new Error(value.error || "Native push registration failed."));
    });
    try {
      await PushNotifications.register();
    } catch (error) {
      if (!settled) {
        settled = true;
        window.clearTimeout(timeout);
        reject(error);
      }
    } finally {
      window.setTimeout(() => { void registered.remove(); void failed.remove(); }, 0);
    }
  });

  if (!token) throw new Error("The device did not return a push token.");
  const { error } = await createClient().rpc("upsert_native_push_device", {
    device_platform: platform,
    device_token: token,
    device_label: `${platform} · Pindrizzle native`,
  });
  if (error) throw error;
  saveToken(token);
}

export async function disableNativePush() {
  const platform = nativePlatform();
  if (!platform) return;
  const token = storedToken();
  if (token) {
    const { error } = await createClient().rpc("disable_native_push_device", { device_token: token });
    if (error) console.error("Disable native push record failed", error);
  }
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await PushNotifications.unregister();
  saveToken("");
}
