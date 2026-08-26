"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import PingIcon, { type PingIconName } from "@/components/PingIcon";
import styles from "./you.module.css";

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

function SettingButton({ icon, title, detail, onClick, tone }: {
  icon: PingIconName;
  title: string;
  detail: string;
  onClick: () => void;
  tone?: "location" | "danger";
}) {
  return (
    <button type="button" onClick={onClick}>
      <span className={tone === "location" ? styles.locationIcon : tone === "danger" ? styles.dangerIcon : undefined}><PingIcon name={icon} /></span>
      <div><strong>{title}</strong><small>{detail}</small></div>
      <b aria-hidden="true"><PingIcon name="chevron" size={16} /></b>
    </button>
  );
}

function SettingSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`${styles.settingSection}${className ? ` ${className}` : ""}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
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
    } catch (error) {
      console.error("You account failed", error);
      setProfile(null);
      setModerator(false);
      setFollowedCount(0);
    }
  }, [editingName]);

  useEffect(() => {
    setRadius(readRadius());
    void loadAccount();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => window.setTimeout(() => void loadAccount(), 0));
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

  const openAuth = () => window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in or create your Ping account." } }));

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

  const locationDetail = locationState === "granted" ? "Location permission active" : locationState === "requesting" ? "Checking location…" : locationState === "denied" ? "Location unavailable or blocked" : "Tap to enable location";

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className={styles.screen}>
          <header className={styles.header}>
            <a href="/" className={styles.back} aria-label="Back to Feed">‹</a>
            <div><div className="brand small">ping<span>.</span></div><h1>You</h1></div>
          </header>

          <section className={styles.profileCard}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.profileCopy}>
              <h2>{profile?.display_name || (email ? "Your Ping account" : "Join your local community")}</h2>
              <p>{email || "Browse freely. Sign in when you want to participate."}</p>
              {profile && <small>{memberLabel(profile.member_since)}</small>}
            </div>
            {profile && !editingName && <button type="button" className={styles.editButton} onClick={startEditingName}>Edit</button>}
          </section>

          {editingName && (
            <section className={styles.nameEditor} aria-label="Edit display name">
              <label htmlFor="display-name">Display name</label>
              <div><input id="display-name" value={nameDraft} maxLength={32} onChange={(event) => setNameDraft(event.target.value)} autoComplete="nickname" /><button type="button" onClick={saveDisplayName} disabled={nameSaving}>{nameSaving ? "Saving…" : "Save"}</button></div>
              <small>This is the name neighbours see on your public Ping profile.</small>
              <button type="button" className={styles.cancelButton} onClick={() => { setEditingName(false); setNameMessage(""); }}>Cancel</button>
            </section>
          )}
          {nameMessage && <div className={styles.nameMessage} role="status">{nameMessage}</div>}

          {profile && (
            <section className={styles.reputationCard}>
              <div className={styles.reputationTop}><div><span>REPUTATION</span><h2>{profile.reputation_level}</h2></div><strong>{profile.reputation_points} pts</strong></div>
              <p>Community signals you earn: <b>+3</b> per Helpful and <b>+1</b> per confirmation.</p>
              <div className={styles.progress}><span style={{ width: `${progress}%` }} /></div>
              <small>{profile.next_level_points ? `${profile.next_level_points - profile.reputation_points} points to the next level` : "Highest current reputation level"}</small>
              <em>Reputation reflects activity, not identity verification.</em>
            </section>
          )}

          <section className={styles.stats} aria-label="Your Ping stats">
            <div><strong>{profile ? profile.helpful_pings : email ? 0 : "—"}</strong><span>Helpful earned</span></div>
            <div><strong>{profile ? profile.confirmations : email ? 0 : "—"}</strong><span>Confirms earned</span></div>
            <div><strong>{radius} mi</strong><span>Nearby radius</span></div>
          </section>

          <div className={styles.settingsStack}>
            <SettingSection title="YOUR ACTIVITY">
              <div className={styles.settingsGroup} id="you-activity-settings">
                {email && <SettingButton icon="activity" title="My Pings" detail="Active, resolved, expired and removed" onClick={() => window.location.assign("/my-pings")} />}
                {email && <SettingButton icon="following" title="Followed Pings" detail={followedCount ? `${followedCount} ${followedCount === 1 ? "Ping" : "Pings"} you’re following` : "Keep track of useful local outcomes"} onClick={() => window.location.assign("/following")} />}
                <SettingButton icon="bell" title="Notifications" detail="Replies, confirmations and Helpful" onClick={() => window.location.assign("/notifications")} />
              </div>
            </SettingSection>

            <SettingSection title="LOCAL">
              <div className={styles.settingsGroup} id="you-local-settings">
                <SettingButton icon="location" title="Location" detail={locationDetail} onClick={requestLocation} tone="location" />
                <div className={styles.row}>
                  <span><PingIcon name="radius" /></span>
                  <div><strong>Nearby radius</strong><small>Control how local your Feed feels</small></div>
                  <select value={radius} onChange={(event) => chooseRadius(Number(event.target.value) as Radius)} aria-label="Nearby radius">
                    <option value={0.5}>0.5 mi</option><option value={1}>1 mi</option><option value={3}>3 mi</option><option value={5}>5 mi</option>
                  </select>
                </div>
              </div>
            </SettingSection>

            <SettingSection title="ACCOUNT">
              <div className={styles.settingsGroup} id="you-account-settings">
                {!email && <SettingButton icon="user" title="Sign in / Sign up" detail="Participate when you’re ready" onClick={openAuth} />}
                {profile && userId && <SettingButton icon="profile" title="View public profile" detail="See what other neighbours can see" onClick={() => window.location.assign(`/profile/${userId}`)} />}
                {profile && <SettingButton icon="edit" title="Edit profile" detail="Change your public display name" onClick={startEditingName} />}
              </div>
            </SettingSection>

            <SettingSection title="PRIVACY & SAFETY">
              <div className={styles.settingsGroup} id="you-privacy-settings">
                <SettingButton icon="shield" title="Privacy & safety" detail="Blocked users, reports and location privacy" onClick={() => window.dispatchEvent(new CustomEvent("ping:open-privacy"))} />
              </div>
            </SettingSection>

            {email && (
              <SettingSection title="BUSINESS">
                <div className={styles.settingsGroup} id="you-business-settings">
                  <SettingButton icon="promote" title="Promote a Ping" detail="Paid local reach for one of your live Pings" onClick={() => window.location.assign("/promote")} />
                </div>
              </SettingSection>
            )}

            <SettingSection title="BETA / ADMIN" className={styles.adminSection}>
              <div className={styles.settingsGroup} id="you-admin-settings">
                {moderator && <SettingButton icon="moderation" title="Moderation" detail="Review reported Pings" onClick={() => window.location.assign("/moderation")} />}
                {moderator && <SettingButton icon="review" title="Promotion review" detail="Approve or reject local promotion requests" onClick={() => window.location.assign("/moderation/promotions")} />}
              </div>
            </SettingSection>

            {email && (
              <SettingSection title="ACCOUNT ACTION">
                <div className={`${styles.settingsGroup} ${styles.actionGroup}`}>
                  <SettingButton icon="signout" title="Sign out" detail="Leave this account on this device" onClick={() => void signOut()} tone="danger" />
                </div>
              </SettingSection>
            )}
          </div>
        </main>

        <nav className={styles.bottomNav} aria-label="Primary navigation">
          <a href="/"><PingIcon name="feed" />Feed</a>
          <a href="/map"><PingIcon name="map" />Map</a>
          <a href="/#ping" className={styles.compose}><span><PingIcon name="plus" /></span>Ping</a>
          <a href="/alerts"><PingIcon name="alerts" />Alerts</a>
          <a href="/you" className={styles.active}><PingIcon name="user" />You</a>
        </nav>
      </div>
    </div>
  );
}
