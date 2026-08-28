"use client";

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";
import PingIcon from "@/components/PingIcon";
import {
  disableNativePushDevice,
  enableNativePushDevice,
  nativePushPermissionState,
  nativePushSupported,
  refreshNativePushDevice,
} from "@/lib/native-push";

type PushState = "checking" | "unsupported" | "off" | "blocked" | "on" | "working";

type Props = {
  userId: string | null;
  authLoading: boolean;
};

function vapidKeyToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function subscriptionKeys(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh || "",
    auth: json.keys?.auth || "",
  };
}

export default function Phase16PushSettings({ userId, authLoading }: Props) {
  const [state, setState] = useState<PushState>("checking");
  const [deviceCount, setDeviceCount] = useState(0);
  const [message, setMessage] = useState("");
  const native = Capacitor.isNativePlatform();

  const supported = useCallback(() => {
    if (Capacitor.isNativePlatform()) return nativePushSupported();
    return typeof window !== "undefined"
      && window.isSecureContext
      && "serviceWorker" in navigator
      && "PushManager" in window
      && "Notification" in window;
  }, []);

  const refreshDeviceCount = useCallback(async () => {
    if (!userId) {
      setDeviceCount(0);
      return;
    }
    const stateResult = await createClient().rpc("my_push_state");
    const row = Array.isArray(stateResult.data) ? stateResult.data[0] : stateResult.data;
    setDeviceCount(Number(row?.active_subscriptions || 0));
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!supported()) {
      setState("unsupported");
      return;
    }
    if (!userId) {
      setState("off");
      setDeviceCount(0);
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const permission = await nativePushPermissionState();
        if (permission === "blocked") {
          setState("blocked");
          await refreshDeviceCount();
          return;
        }
        const nativeState = await refreshNativePushDevice();
        setState(nativeState === "on" ? "on" : nativeState === "blocked" ? "blocked" : nativeState === "unsupported" ? "unsupported" : "off");
        await refreshDeviceCount();
      } catch (error) {
        console.error("Native push state check failed", error);
        setState("off");
      }
      return;
    }

    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      await refreshDeviceCount();

      if (subscription && Notification.permission === "granted") {
        const keys = subscriptionKeys(subscription);
        if (keys.p256dh && keys.auth) {
          await createClient().rpc("upsert_push_subscription", {
            subscription_endpoint: keys.endpoint,
            subscription_p256dh: keys.p256dh,
            subscription_auth: keys.auth,
            subscription_device_label: navigator.userAgent.slice(0, 180),
          });
        }
        setState("on");
      } else {
        setState("off");
      }
    } catch (error) {
      console.error("Push state check failed", error);
      setState("off");
    }
  }, [refreshDeviceCount, supported, userId]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const enable = async () => {
    if (!userId) {
      window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to enable Pindrizzle notifications on this device." } }));
      return;
    }
    if (!supported()) {
      setState("unsupported");
      return;
    }

    setState("working");
    setMessage("");

    if (native) {
      const result = await enableNativePushDevice();
      if (result.state === "on") {
        setState("on");
        setMessage("Pindrizzle notifications are enabled on this device.");
      } else if (result.state === "blocked") {
        setState("blocked");
        setMessage("Notifications are blocked in this device’s system settings.");
      } else {
        setState(result.state === "unsupported" ? "unsupported" : "off");
        setMessage("Notifications could not be enabled on this device yet.");
      }
      await refreshDeviceCount();
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("blocked");
        setMessage("Notifications are blocked in this browser’s site settings.");
        return;
      }
      if (permission !== "granted") {
        setState("off");
        return;
      }

      const registration = await navigator.serviceWorker.register("/ping-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const keyResponse = await fetch("/api/push/public-key", { cache: "no-store" });
      if (!keyResponse.ok) throw new Error("Push public key is unavailable");
      const { publicKey } = await keyResponse.json() as { publicKey?: string };
      if (!publicKey) throw new Error("Push public key is missing");

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyToBytes(publicKey),
        });
      }

      const keys = subscriptionKeys(subscription);
      if (!keys.p256dh || !keys.auth) throw new Error("Push subscription keys are missing");
      const { error } = await createClient().rpc("upsert_push_subscription", {
        subscription_endpoint: keys.endpoint,
        subscription_p256dh: keys.p256dh,
        subscription_auth: keys.auth,
        subscription_device_label: navigator.userAgent.slice(0, 180),
      });
      if (error) throw error;

      setMessage("Pindrizzle notifications are enabled on this device.");
      await refresh();
    } catch (error) {
      console.error("Enable push failed", error);
      setState("off");
      setMessage("Notifications could not be enabled on this device yet.");
    }
  };

  const disable = async () => {
    if (!supported()) return;
    setState("working");
    setMessage("");

    if (native) {
      await disableNativePushDevice();
      setState("off");
      setMessage("Pindrizzle notifications are off on this device.");
      await refreshDeviceCount();
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (subscription && userId) {
        await createClient().rpc("disable_push_subscription", { subscription_endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("Pindrizzle notifications are off on this device.");
      await refresh();
    } catch (error) {
      console.error("Disable push failed", error);
      setMessage("Notification settings could not be changed right now.");
      await refresh();
    }
  };

  const statusCopy = state === "on"
    ? "Enabled on this device"
    : state === "blocked"
      ? native ? "Blocked by device settings" : "Blocked by browser settings"
      : state === "unsupported"
        ? "Not available on this device"
        : state === "working" || state === "checking"
          ? "Checking this device…"
          : "Off on this device";

  return (
    <section className="phase16-push-card" aria-label="Pindrizzle notification settings">
      <div className="phase16-push-icon"><PingIcon name="alerts" size={20} /></div>
      <div className="phase16-push-copy">
        <div className="phase16-push-title"><strong>Push notifications</strong><span className={state === "on" ? "on" : ""}>{statusCopy}</span></div>
        <p>Get useful local activity even when Pindrizzle is closed. Notifications follow your Reply, Confirmation and Helpful choices below.</p>
        {deviceCount > 0 && <small>{deviceCount} {deviceCount === 1 ? "device" : "devices"} connected to this account.</small>}
        {message && <div className="phase16-push-message">{message}</div>}
      </div>
      <button
        type="button"
        onClick={state === "on" ? disable : enable}
        disabled={authLoading || state === "checking" || state === "working" || state === "blocked" || state === "unsupported"}
      >
        {state === "on" ? "Turn off" : state === "working" ? "Working…" : "Enable push"}
      </button>
      <style jsx>{`
        .phase16-push-card{margin:0 0 13px;padding:15px;border:1px solid rgba(31,91,124,.13);background:linear-gradient(135deg,#edf8fc,#fff);border-radius:20px;display:grid;grid-template-columns:42px 1fr;gap:11px;align-items:start}.phase16-push-icon{width:42px;height:42px;border-radius:14px;background:#dff5fb;color:#0a668d;display:grid;place-items:center}.phase16-push-copy{min-width:0}.phase16-push-title{display:flex;align-items:center;justify-content:space-between;gap:8px}.phase16-push-title strong{font-size:12px;color:#17364a}.phase16-push-title span{font-size:8px;font-weight:900;color:#6f8490;background:#edf3f6;border-radius:999px;padding:5px 7px;white-space:nowrap}.phase16-push-title span.on{color:#0d6182;background:#d9f1f8}.phase16-push-copy p{margin:6px 0 0;color:#657d8b;font-size:10px;line-height:1.45}.phase16-push-copy small{display:block;margin-top:6px;color:#778d98;font-size:8px;font-weight:800}.phase16-push-message{margin-top:7px;color:#245b74;font-size:9px;font-weight:850}.phase16-push-card>button{grid-column:2;justify-self:start;border:0;border-radius:11px;background:#123c57;color:#fff;padding:9px 12px;font-size:9px;font-weight:900}.phase16-push-card>button:disabled{opacity:.45;cursor:not-allowed}
      `}</style>
    </section>
  );
}
