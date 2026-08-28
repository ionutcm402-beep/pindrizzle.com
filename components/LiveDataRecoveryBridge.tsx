"use client";

import { useEffect, useState } from "react";

type FailureDetail = {
  reason?: "offline" | "timeout" | "network" | "server";
  status?: number;
};

type PindrizzleWindow = Window & {
  __pindrizzleLiveDataFailure?: FailureDetail | null;
};

function currentFailure() {
  return (window as PindrizzleWindow).__pindrizzleLiveDataFailure || null;
}

export default function LiveDataRecoveryBridge() {
  const [failure, setFailure] = useState<FailureDetail | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = currentFailure();
    if (stored) setFailure(stored);

    const onFailure = (event: Event) => {
      const detail = (event as CustomEvent<FailureDetail>).detail || {};
      setDismissed(false);
      setFailure(detail);
    };
    const onHealthy = () => {
      setFailure(null);
      setDismissed(false);
    };
    const onOffline = () => {
      setDismissed(false);
      setFailure({ reason: "offline" });
    };
    const onOnline = () => {
      const storedFailure = currentFailure();
      if (storedFailure) {
        setDismissed(false);
        setFailure({ ...storedFailure, reason: storedFailure.reason === "offline" ? "network" : storedFailure.reason });
      }
    };

    window.addEventListener("pindrizzle:live-data-failure", onFailure as EventListener);
    window.addEventListener("pindrizzle:live-data-healthy", onHealthy);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("pindrizzle:live-data-failure", onFailure as EventListener);
      window.removeEventListener("pindrizzle:live-data-healthy", onHealthy);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!failure || dismissed) return null;

  const offline = failure.reason === "offline" || (typeof navigator !== "undefined" && !navigator.onLine);
  const message = offline
    ? "You’re offline. Live nearby data cannot refresh until the connection returns."
    : failure.reason === "timeout"
      ? "The connection is taking too long. An empty or quiet area may not be current."
      : "Pindrizzle couldn’t refresh live data. An empty or quiet area may not be current.";

  return (
    <aside className="live-data-recovery" role="status" aria-live="polite">
      <div>
        <strong>{offline ? "Connection unavailable" : "Live data needs another try"}</strong>
        <span>{message}</span>
      </div>
      <div className="live-data-recovery-actions">
        <button type="button" onClick={() => window.location.reload()} disabled={offline}>Retry</button>
        <button type="button" className="secondary" onClick={() => setDismissed(true)} aria-label="Dismiss connection message">Dismiss</button>
      </div>
      <style jsx>{`
        .live-data-recovery{position:fixed;z-index:460;left:max(14px,env(safe-area-inset-left));right:max(14px,env(safe-area-inset-right));bottom:max(14px,calc(10px + env(safe-area-inset-bottom)));max-width:620px;margin:0 auto;padding:12px 13px;border:1px solid rgba(8,47,74,.14);border-radius:15px;background:rgba(255,255,255,.97);box-shadow:0 14px 40px rgba(8,47,74,.18);display:flex;align-items:center;justify-content:space-between;gap:14px;color:#10202f;backdrop-filter:blur(14px)}
        .live-data-recovery>div:first-child{min-width:0;display:grid;gap:3px}.live-data-recovery strong{font-size:12px}.live-data-recovery span{color:#52606d;font-size:10px;line-height:1.45}.live-data-recovery-actions{display:flex;gap:7px;flex-shrink:0}.live-data-recovery button{min-height:40px;border:0;border-radius:10px;padding:0 12px;background:#082f4a;color:#fff;font-size:10px;font-weight:800}.live-data-recovery button.secondary{background:#edf2f5;color:#294153}.live-data-recovery button:disabled{opacity:.45}
        @media(max-width:520px){.live-data-recovery{align-items:stretch;flex-direction:column}.live-data-recovery-actions{width:100%}.live-data-recovery button{flex:1;min-height:44px}}
      `}</style>
    </aside>
  );
}
