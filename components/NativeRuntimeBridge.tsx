"use client";

import { useEffect } from "react";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Network } from "@capacitor/network";
import { PushNotifications } from "@capacitor/push-notifications";
import { createClient } from "@/lib/supabase/client";
import { isNativeRuntime, nativePlatform } from "@/lib/native-runtime";

function mergedAuthParams(parsed: URL) {
  const params = new URLSearchParams(parsed.search);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  fragment.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

async function routeNativeAuthUrl(event: URLOpenListenerEvent) {
  let parsed: URL;
  try {
    parsed = new URL(event.url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "pindrizzle:") return false;
  if (parsed.hostname !== "auth" && parsed.hostname !== "reset-password") return false;

  const params = mergedAuthParams(parsed);
  const errorText = params.get("error_description") || params.get("error") || "";
  if (errorText) {
    try { sessionStorage.setItem("pindrizzle-native-auth-error", errorText); } catch {}
    window.location.assign(`${window.location.origin}/`);
    return true;
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await createClient().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      try { sessionStorage.setItem("pindrizzle-native-auth-error", error.message); } catch {}
      window.location.assign(`${window.location.origin}/`);
      return true;
    }
  }

  const recovery = parsed.hostname === "reset-password" || params.get("type") === "recovery";
  window.location.assign(`${window.location.origin}${recovery ? "/reset-password" : "/"}`);
  return true;
}

async function routeNativeUrl(event: URLOpenListenerEvent) {
  if (await routeNativeAuthUrl(event)) return;

  let parsed: URL;
  try {
    parsed = new URL(event.url);
  } catch {
    return;
  }

  if (parsed.protocol === "pindrizzle:" && parsed.hostname === "pin") {
    const pingId = parsed.pathname.replace(/^\//, "");
    if (/^[0-9a-f-]{36}$/i.test(pingId)) {
      window.location.assign(`${window.location.origin}/#ping=${encodeURIComponent(pingId)}`);
    }
    return;
  }

  if (parsed.protocol === "pindrizzle:" && parsed.hostname === "open") {
    const path = parsed.searchParams.get("path");
    if (path?.startsWith("/")) window.location.assign(`${window.location.origin}${path}`);
    return;
  }

  if (parsed.protocol === "https:" && /(^|\.)pindrizzle\.com$/i.test(parsed.hostname)) {
    window.location.assign(`${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`);
  }
}

function openPushDestination(data: Record<string, unknown> | undefined) {
  const pingId = typeof data?.pingId === "string"
    ? data.pingId
    : typeof data?.ping_id === "string"
      ? data.ping_id
      : "";
  if (/^[0-9a-f-]{36}$/i.test(pingId)) {
    window.location.assign(`${window.location.origin}/#ping=${encodeURIComponent(pingId)}`);
    return;
  }

  const path = typeof data?.url === "string" ? data.url : typeof data?.path === "string" ? data.path : "";
  if (path.startsWith("/")) window.location.assign(`${window.location.origin}${path}`);
}

export default function NativeRuntimeBridge() {
  useEffect(() => {
    if (!isNativeRuntime()) return;

    const platform = nativePlatform();
    document.documentElement.dataset.pindrizzleNative = platform;
    document.body.dataset.pindrizzleNative = platform;

    let disposed = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    void (async () => {
      const urlHandle = await App.addListener("appUrlOpen", (event) => { void routeNativeUrl(event); });
      if (disposed) await urlHandle.remove(); else handles.push(urlHandle);

      const stateHandle = await App.addListener("appStateChange", ({ isActive }) => {
        document.body.dataset.pindrizzleAppActive = isActive ? "true" : "false";
        if (isActive) window.dispatchEvent(new Event("pindrizzle:native-resume"));
      });
      if (disposed) await stateHandle.remove(); else handles.push(stateHandle);

      const network = await Network.getStatus();
      if (!disposed) document.body.dataset.pindrizzleNetwork = network.connected ? network.connectionType : "offline";

      const networkHandle = await Network.addListener("networkStatusChange", (status) => {
        document.body.dataset.pindrizzleNetwork = status.connected ? status.connectionType : "offline";
        window.dispatchEvent(new CustomEvent("pindrizzle:native-network", { detail: status }));
      });
      if (disposed) await networkHandle.remove(); else handles.push(networkHandle);

      const receiveHandle = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
        window.dispatchEvent(new CustomEvent("pindrizzle:native-push-received", { detail: notification }));
      });
      if (disposed) await receiveHandle.remove(); else handles.push(receiveHandle);

      const actionHandle = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        openPushDestination((action.notification.data || {}) as Record<string, unknown>);
      });
      if (disposed) await actionHandle.remove(); else handles.push(actionHandle);

      const launch = await App.getLaunchUrl();
      if (!disposed && launch?.url) await routeNativeUrl({ url: launch.url });
    })().catch((error) => console.error("Pindrizzle native bridge failed", error));

    const onDocumentClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || event.defaultPrevented || anchor.hasAttribute("download")) return;
      let target: URL;
      try {
        target = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (!/^https?:$/.test(target.protocol) || target.origin === window.location.origin) return;
      event.preventDefault();
      void Browser.open({ url: target.toString(), presentationStyle: "popover" });
    };
    document.addEventListener("click", onDocumentClick, true);

    return () => {
      disposed = true;
      document.removeEventListener("click", onDocumentClick, true);
      handles.forEach((handle) => void handle.remove());
      delete document.documentElement.dataset.pindrizzleNative;
      delete document.body.dataset.pindrizzleNative;
      delete document.body.dataset.pindrizzleAppActive;
      delete document.body.dataset.pindrizzleNetwork;
    };
  }, []);

  return null;
}
