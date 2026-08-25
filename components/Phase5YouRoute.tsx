"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type Radius = 0.5 | 1 | 3 | 5;
type StatsRow = { helpful_pings: number; confirmations: number };

const RADII: Radius[] = [0.5, 1, 3, 5];

function readRadius(): Radius {
  try {
    const value = Number(localStorage.getItem("ping-radius") || 1);
    if (RADII.includes(value as Radius)) return value as Radius;
  } catch {}
  return 1;
}

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null;
  if (value && typeof value === "object") return value as T;
  return null;
}

export default function Phase5YouRoute() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsRow>({ helpful_pings: 0, confirmations: 0 });
  const [radius, setRadius] = useState<Radius>(1);
  const [locationState, setLocationState] = useState<"idle" | "requesting" | "granted" | "denied">("idle");

  useEffect(() => {
    const findHost = () => setHost(document.querySelector<HTMLElement>(".app-shell"));
    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const loadAccount = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      setEmail(session?.user.email || null);
      if (!session?.user) {
        setStats({ helpful_pings: 0, confirmations: 0 });
        return;
      }
      const { data: statData, error } = await supabase.rpc("my_community_stats");
      if (error) throw error;
      setStats(firstRow<StatsRow>(statData) || { helpful_pings: 0, confirmations: 0 });
    } catch {
      setStats({ helpful_pings: 0, confirmations: 0 });
    }
  }, []);

  useEffect(() => {
    const handleNav = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>(".bottom-nav button");
      if (!button) return;
      const buttons = Array.from(button.parentElement?.querySelectorAll<HTMLButtonElement>(":scope > button") || []);
      const index = buttons.indexOf(button);
      if (index === 4) {
        setOpen(true);
        setRadius(readRadius());
        void loadAccount();
      } else {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleNav, true);
    return () => document.removeEventListener("click", handleNav, true);
  }, [loadAccount]);

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email || null);
      setTimeout(() => { void loadAccount(); }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadAccount]);

  useEffect(() => {
    const changed = () => { if (open) void loadAccount(); };
    window.addEventListener("ping:community-changed", changed);
    return () => window.removeEventListener("ping:community-changed", changed);
  }, [open, loadAccount]);

  const chooseRadius = (next: Radius) => {
    setRadius(next);
    try { localStorage.setItem("ping-radius", String(next)); } catch {}
    window.dispatchEvent(new CustomEvent("ping:radius-changed", { detail: { radius: next } }));
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState("denied");
      return;
    }
    setLocationState("requesting");
    navigator.geolocation.getCurrentPosition(
      () => setLocationState("granted"),
      () => setLocationState("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const signIn = () => {
    window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in or create your Ping account." } }));
  };

  const signOut = async () => {
    try {
      await createClient().auth.signOut();
      setEmail(null);
      setStats({ helpful_pings: 0, confirmations: 0 });
    } catch {}
  };

  if (!host || !open) return null;

  return createPortal(
    <section className="phase5-you-route" aria-label="Your Ping profile">
      <header className="phase5-you-header">
        <div className="phase5-you-brand">ping<span>.</span></div>
        <h1>You</h1>
      </header>

      <div className="phase5-you-profile">
        <div className="phase5-you-avatar">{email ? email.slice(0, 2).toUpperCase() : "YOU"}</div>
        <div>
          <h2>{email ? "Your Ping account" : "Join your local community"}</h2>
          <p>{email || "Sign in or sign up to post, reply and confirm Pings."}</p>
        </div>
      </div>

      <div className="phase5-you-stats">
        <div><strong>{email ? stats.helpful_pings : "—"}</strong><span>Helpful Pings</span></div>
        <div><strong>{email ? stats.confirmations : "—"}</strong><span>Confirmations</span></div>
        <div><strong>{radius} mi</strong><span>Your radius</span></div>
      </div>

      <div className="settings-list phase5-you-settings">
        {!email && (
          <button type="button" onClick={signIn}>
            <span>👤</span><div><strong>Sign in / Sign up</strong><small>Email + password</small></div><b>›</b>
          </button>
        )}
        <button type="button" onClick={requestLocation}>
          <span>📍</span><div><strong>Location</strong><small>{locationState === "granted" ? "Location permission active" : locationState === "requesting" ? "Checking location…" : locationState === "denied" ? "Location unavailable or blocked" : "Tap to enable location"}</small></div><b>›</b>
        </button>
        <div className="radius-setting">
          <span>↔</span><div><strong>Nearby radius</strong><small>Control how local your feed feels</small></div>
          <select value={radius} onChange={(event) => chooseRadius(Number(event.target.value) as Radius)} aria-label="Nearby radius">
            <option value={0.5}>0.5 mi</option><option value={1}>1 mi</option><option value={3}>3 mi</option><option value={5}>5 mi</option>
          </select>
        </div>
        <button type="button"><span>🔔</span><div><strong>Notifications</strong><small>Important nearby activity only</small></div><b>›</b></button>
        <button type="button"><span>🛡️</span><div><strong>Privacy & safety</strong><small>Blocked users, reports, location privacy</small></div><b>›</b></button>
        {email && (
          <button type="button" onClick={signOut}><span>↪</span><div><strong>Sign out</strong><small>Leave this account on this device</small></div><b>›</b></button>
        )}
      </div>

      <style jsx global>{`
        .phase5-you-route{position:absolute;inset:0 0 82px 0;z-index:15;overflow:auto;background:#f8f8f3;color:#151815;padding-bottom:22px}.phase5-you-header{padding:24px 22px 14px}.phase5-you-brand{font-size:30px;line-height:.9;font-weight:950;letter-spacing:-1.5px}.phase5-you-brand span{color:#55d84d}.phase5-you-header h1{font-size:32px;letter-spacing:-1px;margin:18px 0 0}.phase5-you-profile{margin:0 15px 14px;background:#fff;border-radius:22px;padding:18px;display:flex;gap:13px;align-items:center;border:1px solid #e6e9e3}.phase5-you-avatar{width:52px;height:52px;border-radius:18px;background:linear-gradient(145deg,#5ce253,#3cab42);display:grid;place-items:center;color:#fff;font-weight:950}.phase5-you-profile h2{font-size:17px;margin:0 0 4px}.phase5-you-profile p{font-size:12px;color:#758076;margin:0;word-break:break-word}.phase5-you-stats{margin:0 15px 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.phase5-you-stats div{background:#eef4eb;border-radius:18px;padding:14px 8px;text-align:center}.phase5-you-stats strong{display:block;font-size:18px}.phase5-you-stats span{font-size:9px;color:#68736a}.phase5-you-settings{margin-bottom:8px}@media(max-width:520px){.phase5-you-route{inset:0 0 82px 0}}
      `}</style>
    </section>,
    host,
  );
}
