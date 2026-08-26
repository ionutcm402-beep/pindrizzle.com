"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Radius = 0.5 | 1 | 3 | 5;
type LocationState = "idle" | "requesting" | "granted" | "denied";
type ReleaseStage = "closed_beta" | "public";
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
type MyPingSummary = { status: "active" | "resolved" | "expired" | "removed"; expires_at: string };

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
  const [myPingsCount, setMyPingsCount] = useState(0);
  const [livePingsCount, setLivePingsCount] = useState(0);
  const [releaseStage, setReleaseStage] = useState<ReleaseStage>("closed_beta");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState("");

  const loadAccount = useCallback(async () => {
    const supabase = createClient();
    const stageResult = await supabase.rpc("public_release_stage");
    const rawStage = Array.isArray(stageResult.data) ? stageResult.data[0] : stageResult.data;
    setReleaseStage(!stageResult.error && rawStage === "public" ? "public" : "closed_beta");

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    setEmail(session?.user.email || null);
    setUserId(session?.user.id || null);

    if (!session?.user) {
      setProfile(null);
      setModerator(false);
      setFollowedCount(0);
      setMyPingsCount(0);
      setLivePingsCount(0);
      setEditingName(false);
      setNameDraft("");
      return;
    }

    try {
      const [profileResult, moderatorResult, followResult, myPingsResult] = await Promise.all([
        supabase.rpc("public_profile", { target_profile_id: session.user.id }),
        supabase.rpc("is_moderator"),
        supabase.from("ping_follows").select("ping_id", { count: "exact", head: true }).eq("user_id", session.user.id),
        supabase.rpc("my_pings"),
      ]);

      if (profileResult.error) throw profileResult.error;
      const nextProfile = firstRow<ProfileSummary>(profileResult.data);
      setProfile(nextProfile);
      if (nextProfile && !editingName) setNameDraft(nextProfile.display_name);
      setModerator(!moderatorResult.error && Boolean(moderatorResult.data));
      setFollowedCount(followResult.error ? 0 : Number(followResult.count || 0));

      if (myPingsResult.error) {
        setMyPingsCount(0);
        setLivePingsCount(0);
      } else {
        const mine = (myPingsResult.data || []) as MyPingSummary[];
        const now = Date.now();
        setMyPingsCount(mine.length);
        setLivePingsCount(mine.filter((item) => item.status === "active" && new Date(item.expires_at).getTime() > now).length);
      }
    } catch {
      setProfile(null);
      setModerator(false);
      setFollowedCount(0);
      setMyPingsCount(0);
      setLivePingsCount(0);
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
    const handlePingChanged = () => void loadAccount();
    window.addEventListener("ping:follow-changed", handleFollowChanged);
    window.addEventListener("ping:own-pings-changed", handlePingChanged);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("ping:follow-changed", handleFollowChanged);
      window.removeEventListener("ping:own-pings-changed", handlePingChanged);
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
    setMyPingsCount(0);
    setLivePingsCount(0);
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

  const myPingsSubtitle = livePingsCount
    ? `${livePingsCount} live · ${myPingsCount} total`
    : myPingsCount
      ? `${myPingsCount} ${myPingsCount === 1 ? "Ping" : "Pings"} in your history`
      : "View and manage the Pings you create";

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

          {!email && (
            <section className="you-settings-group">
              <h2 className="you-settings-heading">Account</h2>
              <div className="settings-list">
                <button type="button" onClick={openAuth}>
                  <span className="you-row-icon account"/><div><strong>Sign in / Sign up</strong><small>Email + password</small></div><b>›</b>
                </button>
              </div>
            </section>
          )}

          {email && (
            <section className="you-settings-group">
              <h2 className="you-settings-heading">Your activity</h2>
              <div className="settings-list" id="you-activity-settings">
                <button type="button" onClick={() => window.location.assign("/my-pings")}>
                  <span className="you-row-icon my-pings"/><div><strong>My Pings</strong><small>{myPingsSubtitle}</small></div><b>›</b>
                </button>
                <button type="button" onClick={() => window.location.assign("/following")}>
                  <span className="you-row-icon following"/><div><strong>Followed Pings</strong><small>{followedCount ? `${followedCount} ${followedCount === 1 ? "Ping" : "Pings"} you’re following` : "Keep track of useful local outcomes"}</small></div><b>›</b>
                </button>
                {profile && userId && (
                  <button type="button" onClick={() => window.location.assign(`/profile/${userId}`)}>
                    <span className="you-row-icon public-profile"/><div><strong>View public profile</strong><small>See what other neighbours can see</small></div><b>›</b>
                  </button>
                )}
              </div>
            </section>
          )}

          <section className="you-settings-group">
            <h2 className="you-settings-heading">Local setup</h2>
            <div className="settings-list" id="you-local-settings">
              <button type="button" onClick={requestLocation}>
                <span className="you-row-icon location"/><div><strong>Location</strong><small>{locationState === "granted" ? "Location permission active" : locationState === "requesting" ? "Checking location…" : locationState === "denied" ? "Location unavailable or blocked" : "Tap to enable location"}</small></div><b>›</b>
              </button>
              <div className="radius-setting">
                <span className="you-row-icon radius"/><div><strong>Nearby radius</strong><small>Control how local your feed feels</small></div>
                <select value={radius} onChange={(event) => chooseRadius(Number(event.target.value) as Radius)} aria-label="Nearby radius">
                  <option value={0.5}>0.5 mi</option><option value={1}>1 mi</option><option value={3}>3 mi</option><option value={5}>5 mi</option>
                </select>
              </div>
              <button type="button" onClick={() => window.location.assign("/notifications")}>
                <span className="you-row-icon notifications"/><div><strong>Notifications</strong><small>Replies, confirmations and Helpful</small></div><b>›</b>
              </button>
            </div>
          </section>

          <section className="you-settings-group">
            <h2 className="you-settings-heading">Privacy & app</h2>
            <div className="settings-list" id="you-privacy-settings">
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("ping:open-privacy"))}>
                <span className="you-row-icon privacy"/><div><strong>Privacy & safety</strong><small>Blocked users, reports, location privacy</small></div><b>›</b>
              </button>
            </div>
          </section>

          {email && (
            <section className="you-settings-group">
              <h2 className="you-settings-heading">Promote</h2>
              <div className="settings-list" id="you-promote-settings">
                <button type="button" onClick={() => window.location.assign("/promote")}>
                  <span className="you-row-icon promote"/><div><strong>Promote a Ping</strong><small>Paid local reach for one of your live Pings</small></div><b>›</b>
                </button>
              </div>
            </section>
          )}

          {(releaseStage === "closed_beta" || moderator) && (
            <section className="you-settings-group you-internal-group">
              <h2 className="you-settings-heading">Beta & moderation</h2>
              <div className="settings-list" id="you-internal-settings">
                {moderator && (
                  <button type="button" className="you-moderation-entry" onClick={() => window.location.assign("/moderation")}>
                    <span className="you-row-icon moderation"/><div><strong>Moderation</strong><small>Review reported Pings</small></div><b>›</b>
                  </button>
                )}
                {moderator && (
                  <button type="button" className="you-promotion-review-entry" onClick={() => window.location.assign("/moderation/promotions")}>
                    <span className="you-row-icon promotion-review"/><div><strong>Promotion review</strong><small>Approve or reject paid local placement requests</small></div><b>›</b>
                  </button>
                )}
              </div>
            </section>
          )}

          {email && (
            <section className="you-settings-group you-account-actions">
              <h2 className="you-settings-heading">Account</h2>
              <div className="settings-list">
                <button type="button" onClick={signOut}>
                  <span className="you-row-icon sign-out"/><div><strong>Sign out</strong><small>Leave this account on this device</small></div><b>›</b>
                </button>
              </div>
            </section>
          )}
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          <a href="/"><span>⌂</span>Feed</a>
          <a href="/map"><span>⌖</span>Map</a>
          <a href="/#ping" className="compose-nav"><span>+</span>Ping</a>
          <a href="/alerts"><span>♢</span>Alerts</a>
          <a href="/you" className="active"><span>○</span>You</a>
        </nav>
      </div>
    </div>
  );
}
