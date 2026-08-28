"use client";

import { useEffect, useState } from "react";

type LiveDataFailureDetail = {
  source?: string;
};

export default function LiveDataRecovery() {
  const [visible, setVisible] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);

    const handleFailure = (_event: Event) => {
      setOnline(navigator.onLine);
      setVisible(true);
    };
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("pindrizzle:live-data-failure", handleFailure as EventListener);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("pindrizzle:live-data-failure", handleFailure as EventListener);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!visible) return null;

  const retry = () => {
    if (!navigator.onLine) {
      setOnline(false);
      return;
    }
    window.location.reload();
  };

  return (
    <aside
      className="pindrizzle-live-data-recovery"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div>
        <strong>{online ? "Live data couldn’t refresh" : "You’re offline"}</strong>
        <span>
          {online
            ? "Nearby information may be incomplete. Retry to load the latest pins."
            : "Reconnect to load live nearby information."}
        </span>
      </div>
      <button type="button" onClick={retry} disabled={!online}>Retry</button>
      <button
        type="button"
        className="dismiss"
        onClick={() => setVisible(false)}
        aria-label="Dismiss live data warning"
      >
        ×
      </button>
      <style jsx>{`
        .pindrizzle-live-data-recovery{position:fixed;z-index:420;left:max(14px,env(safe-area-inset-left));right:max(14px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));margin:0 auto;width:min(620px,calc(100% - 28px));display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:12px 12px 12px 14px;border:1px solid #d9c9a5;border-radius:14px;background:#fffaf0;color:#24323d;box-shadow:0 16px 42px rgba(16,32,47,.18)}
        .pindrizzle-live-data-recovery div{min-width:0}.pindrizzle-live-data-recovery strong,.pindrizzle-live-data-recovery span{display:block}.pindrizzle-live-data-recovery strong{font-size:13px}.pindrizzle-live-data-recovery span{margin-top:2px;color:#62717c;font-size:11px;line-height:1.4}.pindrizzle-live-data-recovery button{min-width:44px;min-height:44px;border:0;border-radius:10px;background:#082f4a;color:#fff;padding:0 13px;font-weight:700;cursor:pointer}.pindrizzle-live-data-recovery button:disabled{opacity:.45;cursor:not-allowed}.pindrizzle-live-data-recovery .dismiss{background:transparent;color:#52606d;font-size:23px;padding:0}
        @media(max-width:520px){.pindrizzle-live-data-recovery{grid-template-columns:minmax(0,1fr) auto;padding:12px}.pindrizzle-live-data-recovery .dismiss{position:absolute;top:2px;right:2px;min-width:38px;min-height:38px}.pindrizzle-live-data-recovery div{padding-right:26px}}
      `}</style>
    </aside>
  );
}
