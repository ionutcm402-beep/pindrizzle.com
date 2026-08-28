"use client";

import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token } from "@capacitor/push-notifications";
import { createClient } from "@/lib/supabase/client";

const TOKEN_KEY = "pindrizzle-native-push-token";
const TOKEN_PLATFORM_KEY = "pindrizzle-native-push-platform";
const REGISTRATION_TIMEOUT_MS = 15000;

export type NativePushState = "unsupported" | "off" | "blocked" | "on" | "error";

export function nativePushSupported() {
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android";
}

export function nativePushPlatform(): "ios" | "android" | null {
  if (!nativePushSupported()) return null;
  return Capacitor.getPlatform() === "ios" ? "ios" : "android";
}

function rememberToken(token: string, platform: "ios" | "android") {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_PLATFORM_KEY, platform);
  } catch {}
}

function rememberedToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    const platform = localStorage.getItem(TOKEN_PLATFORM_KEY);
    if (!token || (platform !== "ios" && platform !== "android")) return null;
    return { token, platform } as const;
  } catch {
    return null;
  }
}

function forgetToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_PLATFORM_KEY);
  } catch {}
}

async function waitForRegistration() {
  let resolveToken!: (value: string) => void;
  let rejectToken!: (reason: Error) => void;
  const registered = new Promise<string>((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });

  const successHandle = await PushNotifications.addListener("registration", (token: Token) => resolveToken(token.value));
  const errorHandle = await PushNotifications.addListener("registrationError", (event) => rejectToken(new Error(event.error || "Native push registration failed.")));
  const timer = window.setTimeout(() => rejectToken(new Error("Native push registration timed out.")), REGISTRATION_TIMEOUT_MS);

  try {
    await PushNotifications.register();
    return await registered;
  } finally {
    window.clearTimeout(timer);
    await Promise.allSettled([successHandle.remove(), errorHandle.remove()]);
  }
}

async function ensureAndroidChannel() {
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await PushNotifications.createChannel({
      id: "pindrizzle-default",
      name: "Pindrizzle updates",
      description: "Replies, confirmations, Helpful activity and followed-pin outcomes.",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
  } catch (error) {
    console.warn("Pindrizzle notification channel could not be prepared", error);
  }
}

export async function nativePushPermissionState(): Promise<NativePushState> {
  if (!nativePushSupported()) return "unsupported";
  try {
    const permission = await PushNotifications.checkPermissions();
    if (permission.receive === "granted") return rememberedToken() ? "on" : "off";
    if (permission.receive === "denied") return "blocked";
    return "off";
  } catch {
    return "error";
  }
}

export async function enableNativePushDevice(): Promise<{ state: NativePushState; token?: string }> {
  const platform = nativePushPlatform();
  if (!platform) return { state: "unsupported" };

  try {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive !== "granted") permission = await PushNotifications.requestPermissions();
    if (permission.receive === "denied") return { state: "blocked" };
    if (permission.receive !== "granted") return { state: "off" };

    await ensureAndroidChannel();
    const token = await waitForRegistration();
    if (!token) throw new Error("Native push token is empty.");

    const { error } = await createClient().rpc("upsert_native_push_device", {
      device_platform: platform,
      device_token: token,
      device_label: `${platform} · ${navigator.userAgent}`.slice(0, 180),
    });
    if (error) throw error;

    rememberToken(token, platform);
    return { state: "on", token };
  } catch (error) {
    console.error("Native push enable failed", error);
    return { state: "error" };
  }
}

export async function refreshNativePushDevice(): Promise<NativePushState> {
  if (!nativePushSupported()) return "unsupported";
  try {
    const permission = await PushNotifications.checkPermissions();
    if (permission.receive === "denied") return "blocked";
    if (permission.receive !== "granted") return "off";

    const existing = rememberedToken();
    if (existing) {
      const { error } = await createClient().rpc("upsert_native_push_device", {
        device_platform: existing.platform,
        device_token: existing.token,
        device_label: `${existing.platform} · ${navigator.userAgent}`.slice(0, 180),
      });
      if (!error) return "on";
    }

    const registered = await enableNativePushDevice();
    return registered.state;
  } catch {
    return "error";
  }
}

export async function disableNativePushDevice() {
  if (!nativePushSupported()) return;
  const existing = rememberedToken();
  try {
    if (existing) {
      const { data } = await createClient().auth.getSession();
      if (data.session?.user) {
        await createClient().rpc("disable_native_push_device", { device_token: existing.token });
      }
    }
  } catch (error) {
    console.warn("Native push token could not be detached from the account", error);
  }

  try {
    await PushNotifications.unregister();
  } catch (error) {
    console.warn("Native push unregister failed", error);
  }
  forgetToken();
}
