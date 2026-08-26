"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

  const supported = useCallback(() => {
    return typeof window !== "undefined"
      && window.isSecureContext
      && "serviceWorker" in navigator
      && "PushManager" in window
      && "Notification" in window;
  }, []);

  const refresh = useCallback(async () => {
    if (!supported()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    if (!userId) {
      setState("off");
      setDeviceCount(0);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      const stateResult = await createClient().rpc("my_push_state");
      const row = Array.isArray(stateResult.data) ? stateResult.data[0] : stateResult.data;
      setDeviceCount(Number(row?.active_subscriptions || 0));

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
  }, [supported, userId]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const enable = async () => {
    if (!userId) {
      window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to enable push notifications on this device." } }));
      return;
    }
    if (!supported()) {
      setState("unsupported");
      return;
    }

    setState("working");
    setMessage("");
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

      setMessage("Push is enabled on this device.");
      await refresh();
    } catch (error) {
      console.error("Enable push failed", error);
      setState("off");
      setMessage("Push could not be enabled on this device yet.");
    }
  };

  const disable = async () => {
    if (!supported()) return;
    setState("working");
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (subscription && userId) {
        await createClient().rpc("disable_push_subscription", { subscription_endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("Push is off on this device.");
      await refresh();
    } catch (error) {
      console.error("Disable push failed", error);
      setMessage("Push settings could not be changed right now.");
      await refresh();
    }
  };

  const statusCopy = state === "on"
    ? "Enabled on this device"
    : state === "blocked"
      ? "Blocked by browser settings"
      : state === "unsupported"
        ? "Not available on this browser/device"
        : state === "working" || state === "checking"
          ? "Checking this device…"
          : "Off on this device";

  return (
    <section className="phase16-push-card" aria-label="Push notification settings">
      <div className="phase16-push-icon">🔔</div>
      <div className="phase16-push-copy">
        <div className="phase16-push-title"><strong>Push notifications</strong><span className={state === "on" ? "on" : ""}>{statusCopy}</span></div>
        <p>Get real Ping activity even when the app is closed. Push follows the Reply, Confirmation and Helpful choices below.</p>
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
        .phase16-push-card{margin:0 0 13px;padding:15px;border:1px solid #dce8d8;background:linear-gradient(135deg,#f4fbf1,#fff);border-radius:20px;display:grid;grid-template-columns:42px 1fr;gap:11px;align-items:start}.phase16-push-icon{width:42px;height:42px;border-radius:14px;background:#e7f7e3;display:grid;place-items:center;font-size:18px}.phase16-push-copy{min-width:0}.phase16-push-title{display:flex;align-items:center;justify-content:space-between;gap:8px}.phase16-push-title strong{font-size:12px}.phase16-push-title span{font-size:8px;font-weight:900;color:#7a847b;background:#edf0eb;border-radius:999px;padding:5px 7px;white-space:nowrap}.phase16-push-title span.on{color:#2d6a32;background:#e6f7e3}.phase16-push-copy p{margin:6px 0 0;color:#657168;font-size:10px;line-height:1.45}.phase16-push-copy small{display:block;margin-top:6px;color:#778279;font-size:8px;font-weight:800}.phase16-push-message{margin-top:7px;color:#3d6d41;font-size:9px;font-weight:850}.phase16-push-card>button{grid-column:2;justify-self:start;border:0;border-radius:11px;background:#1d2a1f;color:#fff;padding:9px 12px;font-size:9px;font-weight:900}.phase16-push-card>button:disabled{opacity:.45;cursor:not-allowed}
      `}</style>
    </section>
  );
}
