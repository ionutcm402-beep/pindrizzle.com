"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Radius = 0.5 | 1 | 3 | 5;
type StatsRow = { helpful_pings: number; confirmations: number };
const RADII: Radius[] = [0.5, 1, 3, 5];

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null;
  if (value && typeof value === "object") return value as T;
  return null;
}

function readRadius(): Radius {
  try {
    const value = Number(localStorage.getItem("ping-radius") || 1);
    if (RADII.includes(value as Radius)) return value as Radius;
  } catch {}
  return 1;
}

export default function YouPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsRow>({ helpful_pings: 0, confirmations: 0 });
  const [radius, setRadius] = useState<Radius>(1);
  const [locationState, setLocationState] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [moderator, setModerator] = useState(false);
  const [followedCount, setFollowedCount] = useState(0);

  const loadAccount = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    setEmail(session?.user.email || null);
    if (!session?.user) {
      setStats({ helpful_pings: 0, confirmations: 0 });
      setModerator(false);
      setFollowedCount(0);
      return;
    }
    try {
      const [statResult, moderatorResult, followResult] = await Promise.all([
        supabase.rpc("my_community_stats"),
        supabase.rpc("is_moderator"),
        supabase.from("ping_follows").select("ping_id", { count: "exact", head: true }).eq("user_id", session.user.id),
      ]);
      if (statResult.error) throw statResult.error;
      setStats(firstRow<StatsRow>(statResult.data) || { helpful_pings: 0, confirmations: 0 });
      setModerator(!moderatorResult.error && Boolean(moderatorResult.data));
      setFollowedCount(followResult.error ? 0 : Number(followResult.count || 0));
    } catch {
      setStats({ helpful_pings: 0, confirmations: 0 });
      setModerator(false);
      setFollowedCount(0);
    }
  }, []);

  useEffect(() => {
    setRadius(readRadius());
    void loadAccount();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email || null);
      setTimeout(() => void loadAccount(), 0);
    });
    const handleFollowChanged = () => void loadAccount();
    window.addEventListener("ping:follow-changed", handleFollowChanged);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("ping:follow-changed", handleFollowChanged);
    };
  }, [loadAccount]);

  const chooseRadius = (next: Radius) => {
    setRadius(next);
    try { localStorage.setItem("ping-radius", String(next)); } catch {}
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

  const openAuth = () => {
    window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in or create your Ping account." } }));
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    setEmail(null);
    setStats({ helpful_pings: 0, confirmations: 0 });
    setModerator(false);
    setFollowedCount(0);
  };

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="you-page-screen">
          <header className="you-page-header">
            <a href="/" className="you-page-back" aria-label="Back to Feed">‹</a>
            <div>
              <div className="brand small">ping<span>.</span></div>
              <h1>You</h1>
            </div>
          </header>

          <section className="profile-card">
            <div className="avatar">{email ? email.slice(0, 2).toUpperCase() : "YOU"}</div>
            <div>
              <h2>{email ? "Your Ping account" : "Join your local community"}</h2>
              <p>{email || "Sign in or sign up to post, reply and confirm Pings."}</p>
            </div>
          </section>

          <section className="trust-row">
            <div><strong>{email ? stats.helpful_pings : "—"}</strong><span>Helpful Pings</span></div>
            <div><strong>{email ? stats.confirmations : "—"}</strong><span>Confirmations</span></div>
            <div><strong>{radius} mi</strong><span>Your radius</span></div>
          </section>

          <section className="settings-list">
            {!email && (
              <button type="button" onClick={openAuth}>
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
            {email && <button type="button" onClick={() => window.location.assign("/following")}><span>★</span><div><strong>Followed Pings</strong><small>{followedCount ? `${followedCount} ${followedCount === 1 ? "Ping" : "Pings"} you’re following` : "Keep track of useful local outcomes"}</small></div><b>›</b></button>}
            <button type="button" onClick={() => window.location.assign("/notifications")}><span>🔔</span><div><strong>Notifications</strong><small>Replies, confirmations and Helpful</small></div><b>›</b></button>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("ping:open-privacy"))}><span>🛡️</span><div><strong>Privacy & safety</strong><small>Blocked users, reports, location privacy</small></div><b>›</b></button>
            {moderator && <button type="button" onClick={() => window.location.assign("/moderation")}><span>🧭</span><div><strong>Moderation</strong><small>Review reported Pings</small></div><b>›</b></button>}
            {email && <button type="button" onClick={signOut}><span>↪</span><div><strong>Sign out</strong><small>Leave this account on this device</small></div><b>›</b></button>}
          </section>
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          <a href="/"><span>⌂</span>Feed</a>
          <a href="/#map"><span>⌖</span>Map</a>
          <a href="/#ping" className="compose-nav"><span>+</span>Ping</a>
          <a href="/alerts"><span>♢</span>Alerts</a>
          <a href="/you" className="active"><span>○</span>You</a>
        </nav>
      </div>

      <style jsx global>{`
        .you-page-screen{padding-bottom:104px;min-height:100%}.you-page-header{display:flex;gap:14px;align-items:flex-start;padding:24px 22px 18px}.you-page-header h1{font-size:31px;letter-spacing:-1px;margin:17px 0 0}.you-page-back{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;text-decoration:none;color:#233329;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:29px;line-height:1}.bottom-nav a{height:100%;border:0;background:transparent;color:#8a928b;font-size:10px;font-weight:800;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;position:relative;text-decoration:none}.bottom-nav a>span{font-size:22px;line-height:1}.bottom-nav a.active{color:#1f5420}.bottom-nav a.compose-nav{color:#1f5420}
      `}</style>
    </div>
  );
}
