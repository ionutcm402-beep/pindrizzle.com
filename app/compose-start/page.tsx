"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { requestPingLocation, type PingLocationResult } from "@/lib/ping-location";
import PingIcon from "@/components/PingIcon";

type Stage = "checking-auth" | "waiting-auth" | "locating" | "error";

const COMPOSE_LOCATION_TIMEOUT_MS = 13500;

function requestLocationWithTimeout(): Promise<PingLocationResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: PingLocationResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => finish({ state: "error", coordinates: null }), COMPOSE_LOCATION_TIMEOUT_MS);
    void requestPingLocation().then(finish).catch(() => finish({ state: "error", coordinates: null }));
  });
}

export default function ComposeStartPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking-auth");
  const [message, setMessage] = useState("");
  const requestIdRef = useRef(0);

  const startLocation = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setStage("locating");
    setMessage("");

    const result = await requestLocationWithTimeout();
    if (requestIdRef.current !== requestId) return;

    if (result.state === "granted" && result.coordinates) {
      router.replace("/#ping");
      return;
    }

    setStage("error");
    setMessage(
      result.state === "denied"
        ? "Location permission is blocked. Allow location in your browser settings, then try again."
        : "We couldn’t get your location. Check your connection and location settings, then try again.",
    );
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.user) {
        void startLocation();
        return;
      }
      setStage("waiting-auth");
      window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in once to post useful Pings nearby." } }));
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session?.user) return;
      void startLocation();
    });

    return () => {
      active = false;
      requestIdRef.current += 1;
      data.subscription.unsubscribe();
    };
  }, [startLocation]);

  const locating = stage === "checking-auth" || stage === "locating";

  return (
    <main className="compose-start-screen" aria-live="polite">
      <section className="compose-start-card">
        <span className={`compose-start-icon${locating ? " loading" : ""}`} aria-hidden="true"><PingIcon name="location" size={24} /></span>
        <strong>{stage === "waiting-auth" ? "Sign in to continue" : stage === "error" ? "Location needed" : "Getting your location…"}</strong>
        {stage === "waiting-auth" ? <p>Complete sign in, then pin creation will continue automatically.</p> : stage === "error" ? <p>{message}</p> : <p>Preparing pin creation. This should only take a moment.</p>}
        {stage === "error" && <div className="compose-start-actions"><button type="button" className="primary" onClick={() => void startLocation()}>Try again</button><button type="button" onClick={() => router.replace("/my-pings")}>Cancel</button></div>}
        {stage === "waiting-auth" && <button type="button" className="compose-start-cancel" onClick={() => router.replace("/my-pings")}>Cancel</button>}
      </section>
      <style jsx global>{`
        .compose-start-screen{width:100%;height:100dvh;min-height:100svh;display:grid;place-items:center;padding:max(20px,var(--pd-safe-top,env(safe-area-inset-top))) 20px max(20px,var(--pd-safe-bottom,env(safe-area-inset-bottom)));background:var(--pd-canvas,var(--ping-canvas,#eef8fb));overflow:hidden}.compose-start-card{width:min(100%,430px);display:grid;justify-items:center;gap:12px;padding:24px;border:1px solid var(--pd-line,var(--ping-line));border-radius:var(--pd-radius-card,22px);background:rgba(255,255,255,.96);box-shadow:var(--pd-elevation-2,0 12px 32px rgba(8,43,73,.10));text-align:center}.compose-start-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:16px;background:var(--pd-aqua-100,var(--ping-surface-soft));color:var(--pd-ink-800,var(--ping-ink))}.compose-start-icon.loading{animation:composeStartPulse 1s ease-in-out infinite}.compose-start-card>strong{font-size:17px;color:var(--pd-ink-950,var(--ping-ink))}.compose-start-card p{max-width:330px;margin:0;color:var(--pd-muted,var(--ping-muted));font-size:12px;line-height:1.5}.compose-start-actions{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}.compose-start-actions button,.compose-start-cancel{min-height:44px;border:1px solid var(--pd-line-strong,var(--ping-line));border-radius:999px;background:#fff;color:var(--pd-ink-800,var(--ping-ink));font-weight:750}.compose-start-actions button.primary{border-color:var(--pd-ink-900,var(--ping-ink));background:var(--pd-ink-900,var(--ping-ink));color:#fff}.compose-start-cancel{padding:0 20px;background:transparent}@keyframes composeStartPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.65;transform:scale(.96)}}@media(prefers-reduced-motion:reduce){.compose-start-icon.loading{animation:none}}@media(max-height:667px){.compose-start-card{padding:18px;gap:9px}.compose-start-icon{width:46px;height:46px}}
      `}</style>
    </main>
  );
}
