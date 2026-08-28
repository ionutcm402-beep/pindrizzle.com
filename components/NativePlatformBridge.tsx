"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Network } from "@capacitor/network";
import { PushNotifications } from "@capacitor/push-notifications";
import { createClient } from "@/lib/supabase/client";

function authParams(url: URL) {
  const params = new URLSearchParams(url.search);
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  fragment.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

async function handleAuthCallback(url: URL) {
  const isCustomAuth = url.protocol === "pindrizzle:" && url.hostname === "auth" && url.pathname === "/callback";
  if (!isCustomAuth) return false;

  const params = authParams(url);
  const errorDescription = params.get("error_description") || params.get("error");
  if (errorDescription) {
    try { sessionStorage.setItem("pindrizzle-native-auth-error", errorDescription); } catch {}
    window.location.replace("/");
    return true;
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await createClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) {
      try { sessionStorage.setItem("pindrizzle-native-auth-error", error.message); } catch {}
      window.location.replace("/");
      return true;
    }
  }

  const type = params.get("type");
  window.location.replace(type === "recovery" ? "/reset-password" : "/");
  return true;
}

async function handleIncomingUrl(rawUrl: string) {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return; }

  if (await handleAuthCallback(url)) return;

  if (url.protocol === "pindrizzle:" && url.hostname === "open") {
    const path = url.searchParams.get("path");
    if (path?.startsWith("/")) window.location.assign(path);
    return;
  }

  if (url.protocol === "pindrizzle:" && url.hostname === "pin") {
    const id = url.pathname.replace(/^\//, "");
    if (/^[0-9a-f-]{36}$/i.test(id)) window.location.assign(`/#ping=${encodeURIComponent(id)}`);
    return;
  }

  if (url.protocol === "https:" && /(^|\.)pindrizzle\.com$/i.test(url.hostname)) {
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  }
}

function openNativeNotification(data: Record<string, unknown> | undefined) {
  const pingId = typeof data?.pingId === "string" ? data.pingId : typeof data?.ping_id === "string" ? data.ping_id : "";
  if (/^[0-9a-f-]{36}$/i.test(pingId)) {
    window.location.assign(`/#ping=${encodeURIComponent(pingId)}`);
    return;
  }
  const rawPath = typeof data?.url === "string" ? data.url : typeof data?.path === "string" ? data.path : "";
  if (rawPath.startsWith("/")) window.location.assign(rawPath);
}

export default function NativePlatformBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const platform = Capacitor.getPlatform();
    document.documentElement.dataset.pindrizzleNative = platform;
    document.body.dataset.pindrizzleNative = platform;

    let disposed = false;
    const removers: Array<() => void | Promise<void>> = [];

    void App.addListener("appUrlOpen", ({ url }) => { void handleIncomingUrl(url); }).then((handle) => {
      if (disposed) void handle.remove(); else removers.push(() => handle.remove());
    });

    void App.addListener("appStateChange", ({ isActive }) => {
      document.body.dataset.pindrizzleAppActive = isActive ? "true" : "false";
      if (isActive) window.dispatchEvent(new Event("pindrizzle:native-resume"));
    }).then((handle) => {
      if (disposed) void handle.remove(); else removers.push(() => handle.remove());
    });

    void Network.getStatus().then((status) => {
      if (!disposed) document.body.dataset.pindrizzleNetwork = status.connected ? status.connectionType : "offline";
    });
    void Network.addListener("networkStatusChange", (status) => {
      document.body.dataset.pindrizzleNetwork = status.connected ? status.connectionType : "offline";
      window.dispatchEvent(new CustomEvent("pindrizzle:native-network", { detail: status }));
    }).then((handle) => {
      if (disposed) void handle.remove(); else removers.push(() => handle.remove());
    });

    void PushNotifications.addListener("pushNotificationReceived", (notification) => {
      window.dispatchEvent(new CustomEvent("pindrizzle:native-push-received", { detail: notification }));
    }).then((handle) => {
      if (disposed) void handle.remove(); else removers.push(() => handle.remove());
    });

    void PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      openNativeNotification((action.notification.data || {}) as Record<string, unknown>);
    }).then((handle) => {
      if (disposed) void handle.remove(); else removers.push(() => handle.remove());
    });

    const onDocumentClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || event.defaultPrevented) return;
      let target: URL;
      try { target = new URL(anchor.href, window.location.href); } catch { return; }
      if (!/^https?:$/.test(target.protocol) || target.origin === window.location.origin) return;
      event.preventDefault();
      void Browser.open({ url: target.toString(), presentationStyle: "popover" });
    };
    document.addEventListener("click", onDocumentClick, true);

    void App.getLaunchUrl().then((launch) => {
      if (launch?.url && !disposed) void handleIncomingUrl(launch.url);
    });

    return () => {
      disposed = true;
      document.removeEventListener("click", onDocumentClick, true);
      removers.forEach((remove) => { void remove(); });
      delete document.documentElement.dataset.pindrizzleNative;
      delete document.body.dataset.pindrizzleNative;
      delete document.body.dataset.pindrizzleAppActive;
      delete document.body.dataset.pindrizzleNetwork;
    };
  }, []);

  return null;
}
