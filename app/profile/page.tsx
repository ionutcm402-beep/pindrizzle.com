"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PingIcon from "@/components/PingIcon";

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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null;
  if (value && typeof value === "object") return value as T;
  return null;
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

export default function PublicProfileStaticPage() {
  const [id, setId] = useState("");
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get("id") || "";
    setId(target);
    if (!uuidPattern.test(target)) setState("missing");
  }, []);

  useEffect(() => {
    if (!uuidPattern.test(id)) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await createClient().rpc("public_profile", { target_profile_id: id });
      if (cancelled) return;
      if (error) { setState("missing"); return; }
      const row = firstRow<ProfileSummary>(data);
      setProfile(row);
      setState(row ? "ready" : "missing");
    };
    void load();
    return () => { cancelled = true; };
  }, [id]);

  const initials = useMemo(() => (profile?.display_name || "Neighbour").slice(0, 2).toUpperCase(), [profile?.display_name]);
  const progress = useMemo(() => {
    if (!profile) return 0;
    if (!profile.next_level_points) return 100;
    const floor = levelFloor(profile.reputation_level);
    const span = profile.next_level_points - floor;
    return span <= 0 ? 100 : Math.max(0, Math.min(100, ((profile.reputation_points - floor) / span) * 100));
  }, [profile]);

  return <div className="page-shell"><div className="app-shell"><main className="phase12-public-screen public-profile-v3">
    <header className="phase12-public-header"><a href="/" className="phase12-public-back" aria-label="Back to Feed">‹</a><div className="brand small">pindrizzle</div><span /></header>
    {state === "loading" && <section className="phase12-public-state pd-moment"><strong>Loading profile…</strong></section>}
    {state === "missing" && <section className="phase12-public-state pd-moment"><div><PingIcon name="user" size={30}/></div><h1>Profile unavailable</h1><p>This neighbour profile could not be found.</p><a href="/">Back to Feed</a></section>}
    {state === "ready" && profile && <>
      <section className="phase12-public-hero"><div className="phase12-public-avatar" data-user-content>{initials}</div><span>LOCAL PROFILE</span><h1 data-user-content>{profile.display_name}</h1><p>{memberLabel(profile.member_since)}</p><div className="phase12-public-level"><PingIcon name="check" size={14}/>{profile.reputation_level}</div></section>
      <section className="phase12-public-signals" aria-label="Community reputation signals"><div><strong>{profile.helpful_pings}</strong><span>Helpful earned</span></div><div><strong>{profile.confirmations}</strong><span>Confirms earned</span></div><div><strong>{profile.reputation_points}</strong><span>Reputation pts</span></div></section>
      <section className="phase12-public-reputation"><div><strong>How reputation works</strong><span>{profile.reputation_level}</span></div><p>Pindrizzle uses visible community signals rather than a hidden trust score. Helpful earned counts for 3 points and confirmations earned count for 1 point.</p><div className="phase12-public-progress"><span style={{ width: `${progress}%` }} /></div><small>{profile.next_level_points ? `${profile.next_level_points - profile.reputation_points} points to the next level` : "Highest current reputation level"}</small></section>
      <section className="phase12-public-privacy"><span><PingIcon name="shield" size={20}/></span><div><strong>Privacy by design</strong><p>Public profiles do not show email, exact location or a home address. Reputation is community activity, not identity verification.</p></div></section>
    </>}
  </main></div>
  <style jsx global>{`
    .phase12-public-screen{min-height:100%;padding-bottom:120px}.phase12-public-header{display:grid;grid-template-columns:42px 1fr 42px;align-items:center;padding:24px 20px 12px}.phase12-public-header>.brand{align-items:center!important;text-align:center}.phase12-public-back{width:40px;height:40px;border:1px solid rgba(20,78,107,.07);border-radius:50%;display:grid;place-items:center;text-decoration:none;background:rgba(255,255,255,.9);color:var(--pd-navy-deep);box-shadow:0 8px 24px rgba(8,47,74,.08);font-size:29px;line-height:1}.phase12-public-hero{text-align:center;padding:22px 22px 20px}.phase12-public-avatar{width:82px;height:82px;margin:0 auto 15px;border-radius:26px;background:linear-gradient(145deg,var(--pd-aqua),var(--pd-blue));display:grid;place-items:center;color:#fff;font-size:24px;font-weight:850;box-shadow:0 13px 30px rgba(45,150,208,.2),inset 0 1px 0 rgba(255,255,255,.35)}.phase12-public-hero>span{font-size:8px;font-weight:850;letter-spacing:.12em;color:#7c98a7}.phase12-public-hero h1{margin:8px 0 4px;color:var(--pd-navy-deep);font-size:28px;font-weight:780;letter-spacing:-.04em}.phase12-public-hero p{margin:0;color:#7d94a1;font-size:10px}.phase12-public-level{display:inline-flex;align-items:center;gap:5px;margin-top:13px;padding:8px 11px;border-radius:999px;background:#e8f7fb;color:#0b7198;font-size:10px;font-weight:800}.phase12-public-signals{margin:0 15px 14px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.phase12-public-signals div{padding:15px 8px;border:1px solid rgba(20,78,107,.07);border-radius:18px;background:rgba(255,255,255,.92);text-align:center;box-shadow:var(--pd-elevation-1)}.phase12-public-signals strong{display:block;color:var(--pd-navy-deep);font-size:19px}.phase12-public-signals span{display:block;margin-top:3px;color:#738b98;font-size:8px;line-height:1.25}.phase12-public-reputation{margin:0 15px 14px;padding:18px;border-radius:22px;background:linear-gradient(155deg,#0d4567,var(--pd-navy-deep));color:#fff;box-shadow:var(--pd-elevation-2)}.phase12-public-reputation>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:10px}.phase12-public-reputation>div:first-child strong{font-size:13px}.phase12-public-reputation>div:first-child span{padding:6px 8px;border-radius:999px;background:rgba(255,255,255,.1);color:#d6edf5;font-size:8px;font-weight:800}.phase12-public-reputation p{margin:10px 0;color:#d0e2ea;font-size:10px;line-height:1.55}.phase12-public-progress{height:7px;border-radius:999px;background:rgba(255,255,255,.11);overflow:hidden}.phase12-public-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--pd-rain),var(--pd-aqua))}.phase12-public-reputation small{display:block;margin-top:7px;color:#aac4d1;font-size:8px}.phase12-public-privacy{margin:0 15px;padding:15px;display:flex;gap:11px;border:1px solid rgba(20,78,107,.07);border-radius:19px;background:linear-gradient(145deg,#f8fcfd,#eaf7fb);box-shadow:var(--pd-elevation-1)}.phase12-public-privacy>span{width:36px;height:36px;display:grid;place-items:center;border-radius:12px;background:var(--ping-accent-soft);color:var(--ping-accent-ink)}.phase12-public-privacy strong{color:var(--pd-navy-deep);font-size:11px}.phase12-public-privacy p{margin:4px 0 0;color:#6f8794;font-size:9px;line-height:1.45}.phase12-public-state{margin:32px 15px;padding:34px 22px;border:1px solid rgba(20,78,107,.07);border-radius:24px;background:rgba(255,255,255,.94);text-align:center;box-shadow:var(--pd-elevation-1)}.phase12-public-state>div{width:52px;height:52px;display:grid;place-items:center;margin:0 auto;color:var(--ping-accent-ink);background:var(--ping-accent-soft);border-radius:16px}.phase12-public-state h1{margin:9px 0 5px;color:var(--pd-navy-deep)}.phase12-public-state p{margin:0 0 15px;color:#758c98;font-size:12px}.phase12-public-state a{display:inline-flex;min-height:44px;align-items:center;padding:0 16px;border-radius:999px;background:var(--pd-navy);color:#fff;text-decoration:none;font-size:11px;font-weight:800}
  `}</style></div>;
}
