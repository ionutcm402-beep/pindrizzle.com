"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Radius = 0.5 | 1 | 3 | 5;
type LocationState = "idle" | "requesting" | "granted" | "denied";
type ProfileSummary = {
  profile_id: string;
  display_name: string;
  helpful_pings: number;
  confirmations: number;
  member_since: string;
  reputation_points: number;
  reputation_level: string;
  next_level_points: number | null;
};

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

function memberLabel(value: string) {
  const joined = new Date(value).getTime();
  const days = Math.max(0, Math.floor((Date.now() - joined) / 86400000));
  if (days < 1) return "Joined today";
  if (days < 30) return `Member for ${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Member for ${months}mo`;
  return `Member for ${Math.floor(months / 12)}y`;
}

function levelFloor(level: string) {
  if (level === "Community regular") return 60;
  if (level === "Local contributor") return 20;
  if (level === "Active neighbour") return 5;
  return 0;
}

export default function YouPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [radius, setRadius] = useState<Radius>(1);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [moderator, setModerator] = useState(false);
  const [followedCount, setFollowedCount] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState("");

  const loadAccount = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    setEmail(session?.user.email || null);
    setUserId(session?.user.id || null);

    if (!session?.user) {
      setProfile(null);
      setModerator(false);
      setFollowedCount(0);
      setEditingName(false);
      setNameDraft("");
      return;
    }

    try {
      const [profileResult, moderatorResult, followResult] = await Promise.all([
        supabase.rpc("public_profile", { target_profile_id: session.user.id }),
        supabase.rpc("is_moderator"),
        supabase.from("ping_follows").select("ping_id", { count: "exact", head: true }).eq("user_id", session.user.id),
      ]);

      if (profileResult.error) throw profileResult.error;
      const nextProfile = firstRow<ProfileSummary>(profileResult.data);
      setProfile(nextProfile);
      if (nextProfile && !editingName) setNameDraft(nextProfile.display_name);
      setModerator(!moderatorResult.error && Boolean(moderatorResult.data));
      setFollowedCount(followResult.error ? 0 : Number(followResult.count || 0));
    } catch {
      setProfile(null);
      setModerator(false);
      setFollowedCount(0);
    }
  }, [editingName]);

  useEffect(() => {
    setRadius(readRadius());
    void loadAccount();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email || null);
      setUserId(session?.user.id || null);
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
    setUserId(null);
    setProfile(null);
    setModerator(false);
    setFollowedCount(0);
  };

  const startEditingName = () => {
    setNameDraft(profile?.display_name || "");
    setNameMessage("");
    setEditingName(true);
  };

  const saveDisplayName = async () => {
    const trimmed = nameDraft.trim();
    if (trimmed.length < 2 || trimmed.length > 32) {
      setNameMessage("Use 2–32 characters.");
      return;
    }

    setNameSaving(true);
    setNameMessage("");
    try {
      const { data, error } = await createClient().rpc("update_my_display_name", { requested_display_name: trimmed });
      if (error) throw error;
      setNameDraft(String(data || trimmed));
      setEditingName(false);
      await loadAccount();
      setNameMessage("Display name updated.");
    } catch {
      setNameMessage("That name can’t be used. Avoid links and reserved Ping roles.");
    } finally {
      setNameSaving(false);
    }
  };

  const initials = useMemo(() => {
    const source = profile?.display_name?.trim() || email || "You";
    return source.slice(0, 2).toUpperCase();
  }, [profile?.display_name, email]);

  const progress = useMemo(() => {
    if (!profile) return 0;
    if (!profile.next_level_points) return 100;
    const floor = levelFloor(profile.reputation_level);
    const span = profile.next_level_points - floor;
    if (span <= 0) return 100;
    return Math.max(0, Math.min(100, ((profile.reputation_points - floor) / span) * 100));
  }, [profile]);

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

          <section className="profile-card phase12-profile-card">
            <div className="avatar">{initials}</div>
            <div className="phase12-profile-copy">
              <h2>{profile?.display_name || (email ? "Your Ping account" : "Join your local community")}</h2>
              <p>{email || "Sign in or sign up to post, reply and confirm Pings."}</p>
              {profile && <small>{memberLabel(profile.member_since)}</small>}
            </div>
            {profile && !editingName && <button type="button" className="phase12-edit-name" onClick={startEditingName}>Edit</button>}
          </section>

          {editingName && (
            <section className="phase12-name-editor" aria-label="Edit display name">
              <label htmlFor="display-name">Display name</label>
              <div>
                <input id="display-name" value={nameDraft} maxLength={32} onChange={(event) => setNameDraft(event.target.value)} autoComplete="nickname" />
                <button type="button" onClick={saveDisplayName} disabled={nameSaving}>{nameSaving ? "Saving…" : "Save"}</button>
              </div>
              <small>This is the name neighbours see on your public Ping profile.</small>
              <button type="button" className="phase12-cancel-name" onClick={() => { setEditingName(false); setNameMessage(""); }}>Cancel</button>
            </section>
          )}
          {nameMessage && <div className="phase12-name-message" role="status">{nameMessage}</div>}

          {profile ? (
            <section className="phase12-reputation-card">
              <div className="phase12-reputation-top">
                <div>
                  <span>REPUTATION</span>
                  <h2>{profile.reputation_level}</h2>
                </div>
                <strong>{profile.reputation_points} pts</strong>
              </div>
              <p>Built from community signals you earn: <b>+3</b> per Helpful and <b>+1</b> per confirmation.</p>
              <div className="phase12-progress"><span style={{ width: `${progress}%` }} /></div>
              <small>{profile.next_level_points ? `${profile.next_level_points - profile.reputation_points} points to the next level` : "Highest current reputation level"}</small>
              <em>Reputation reflects activity, not identity verification.</em>
            </section>
          ) : null}

          <section className="trust-row">
            <div><strong>{profile ? profile.helpful_pings : email ? 0 : "—"}</strong><span>Helpful earned</span></div>
            <div><strong>{profile ? profile.confirmations : email ? 0 : "—"}</strong><span>Confirms earned</span></div>
            <div><strong>{radius} mi</strong><span>Your radius</span></div>
          </section>

          <section className="settings-list">
            {!email && (
              <button type="button" onClick={openAuth}>
                <span>👤</span><div><strong>Sign in / Sign up</strong><small>Email + password</small></div><b>›</b>
              </button>
            )}
            {profile && userId && <button type="button" onClick={() => window.location.assign(`/profile/${userId}`)}><span>○</span><div><strong>View public profile</strong><small>See what other neighbours can see</small></div><b>›</b></button>}
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
            {email && <button type="button" onClick={() => window.location.assign("/promote")}><span>↗</span><div><strong>Promote a Ping</strong><small>Paid local reach for one of your live Pings</small></div><b>›</b></button>}
            <button type="button" onClick={() => window.location.assign("/notifications")}><span>🔔</span><div><strong>Notifications</strong><small>Replies, confirmations and Helpful</small></div><b>›</b></button>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("ping:open-privacy"))}><span>🛡️</span><div><strong>Privacy & safety</strong><small>Blocked users, reports, location privacy</small></div><b>›</b></button>
            {moderator && <button type="button" onClick={() => window.location.assign("/moderation")}><span>🧭</span><div><strong>Moderation</strong><small>Review reported Pings</small></div><b>›</b></button>}
            {moderator && <button type="button" onClick={() => window.location.assign("/moderation/promotions")}><span>↗</span><div><strong>Promotion review</strong><small>Approve or reject paid local placement requests</small></div><b>›</b></button>}
            {email && <button type="button" onClick={signOut}><span>↪</span><div><strong>Sign out</strong><small>Leave this account on this device</small></div><b>›</b></button>}
          </section>
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          <a href="/"><span>⌂</span>Feed</a>
          <a href="/map"><span>⌖</span>Map</a>
          <a href="/#ping" className="compose-nav"><span>+</span>Ping</a>
          <a href="/alerts"><span>♢</span>Alerts</a>
          <a href="/you" className="active"><span>○</span>You</a>
        </nav>
      </div>

      <style jsx global>{`
        .you-page-screen{padding-bottom:104px;min-height:100%}.you-page-header{display:flex;gap:14px;align-items:flex-start;padding:24px 22px 18px}.you-page-header h1{font-size:31px;letter-spacing:-1px;margin:17px 0 0}.you-page-back{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;text-decoration:none;color:#233329;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:29px;line-height:1}.bottom-nav a{height:100%;border:0;background:transparent;color:#8a928b;font-size:10px;font-weight:800;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;position:relative;text-decoration:none}.bottom-nav a>span{font-size:22px;line-height:1}.bottom-nav a.active{color:#1f5420}.bottom-nav a.compose-nav{color:#1f5420}.phase12-profile-card{position:relative}.phase12-profile-copy{min-width:0;flex:1}.phase12-profile-copy h2,.phase12-profile-copy p{overflow:hidden;text-overflow:ellipsis}.phase12-profile-copy small{display:block;margin-top:5px;color:#899188;font-size:9px;font-weight:750}.phase12-edit-name{border:0;background:#eef7ea;color:#2d6631;border-radius:10px;padding:8px 10px;font-size:10px;font-weight:900}.phase12-name-editor{margin:0 15px 12px;padding:15px;border:1px solid #dfe7dc;border-radius:19px;background:#fff}.phase12-name-editor label{display:block;margin-bottom:8px;font-size:10px;font-weight:900;color:#4f5b51}.phase12-name-editor>div{display:grid;grid-template-columns:1fr auto;gap:8px}.phase12-name-editor input{min-width:0;border:1px solid #d9e0d7;border-radius:12px;padding:11px 12px;outline:none}.phase12-name-editor input:focus{border-color:#65d75d;box-shadow:0 0 0 3px rgba(101,215,93,.12)}.phase12-name-editor>div button{border:0;border-radius:12px;padding:0 13px;background:#59d951;color:#153416;font-weight:900;font-size:11px}.phase12-name-editor small{display:block;margin-top:8px;color:#7c857d;font-size:9px;line-height:1.4}.phase12-cancel-name{margin-top:8px;border:0;background:transparent;color:#717a72;font-size:10px;font-weight:850;padding:3px 0}.phase12-name-message{margin:0 15px 12px;padding:10px 12px;border-radius:13px;background:#f2f5ef;color:#536056;font-size:10px;font-weight:750}.phase12-reputation-card{margin:0 15px 14px;padding:17px;border-radius:22px;background:linear-gradient(145deg,#19261b,#2c3d2e);color:#fff;box-shadow:0 13px 30px rgba(28,43,30,.17)}.phase12-reputation-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.phase12-reputation-top span{display:block;color:#9fafa1;font-size:8px;font-weight:950;letter-spacing:.8px}.phase12-reputation-top h2{margin:4px 0 0;font-size:20px;letter-spacing:-.35px}.phase12-reputation-top>strong{padding:7px 9px;border-radius:999px;background:rgba(255,255,255,.1);font-size:10px;white-space:nowrap}.phase12-reputation-card p{margin:11px 0 10px;color:#ced8cf;font-size:10px;line-height:1.45}.phase12-reputation-card p b{color:#70e768}.phase12-progress{height:7px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}.phase12-progress span{display:block;height:100%;border-radius:inherit;background:#62e45a}.phase12-reputation-card small{display:block;margin-top:7px;color:#bdc8bf;font-size:8px}.phase12-reputation-card em{display:block;margin-top:10px;color:#8fa092;font-size:8px;font-style:normal}.trust-row{margin-top:0}
      `}</style>
    </div>
  );
}
