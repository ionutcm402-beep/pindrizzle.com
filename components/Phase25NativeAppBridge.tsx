"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";

function safeNativePath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function Phase25NativeAppBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const removers: Array<() => void | Promise<void>> = [];
    const platformClass = `pindrizzle-native-${Capacitor.getPlatform()}`;
    document.documentElement.classList.add("pindrizzle-native", platformClass);

    const routeNativeUrl = async (raw: string) => {
      try {
        const url = new URL(raw);
        if (url.protocol !== "pindrizzle:") return;
        const next = safeNativePath(url.searchParams.get("next"));
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await createClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        }
        if (!disposed) window.location.assign(next);
      } catch (error) {
        console.error("Pindrizzle native deep link failed", error);
      }
    };

    void (async () => {
      const [{ App }, { SplashScreen }, { StatusBar, Style }, { PushNotifications }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/splash-screen"),
        import("@capacitor/status-bar"),
        import("@capacitor/push-notifications"),
      ]);
      if (disposed) return;

      await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      await StatusBar.setBackgroundColor({ color: "#082b49" }).catch(() => {});
      await SplashScreen.hide().catch(() => {});

      const appLink = await App.addListener("appUrlOpen", ({ url }) => { void routeNativeUrl(url); });
      removers.push(() => appLink.remove());

      const pushAction = await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const data = notification.data || {};
        const pingId = typeof data.pingId === "string" ? data.pingId : "";
        const target = pingId ? `/#ping=${encodeURIComponent(pingId)}` : "/alerts";
        window.location.assign(target);
      });
      removers.push(() => pushAction.remove());

      const launch = await App.getLaunchUrl().catch(() => null);
      if (launch?.url) void routeNativeUrl(launch.url);
    })();

    return () => {
      disposed = true;
      document.documentElement.classList.remove("pindrizzle-native", platformClass);
      removers.forEach((remove) => { void remove(); });
    };
  }, []);

  return null;
}
