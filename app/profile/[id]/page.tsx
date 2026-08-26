"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (!uuidPattern.test(id)) {
      setState("missing");
      return;
    }

    let cancelled = false;
    const load = async () => {
      const { data, error } = await createClient().rpc("public_profile", { target_profile_id: id });
      if (cancelled) return;
      if (error) {
        setState("missing");
        return;
      }
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

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="phase12-public-screen">
          <header className="phase12-public-header">
            <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/")} aria-label="Go back">‹</button>
            <div className="brand small">ping<span>.</span></div>
            <span />
          </header>

          {state === "loading" && <section className="phase12-public-state"><strong>Loading profile…</strong></section>}
          {state === "missing" && (
            <section className="phase12-public-state">
              <div>○</div>
              <h1>Profile unavailable</h1>
              <p>This neighbour profile could not be found.</p>
              <a href="/">Back to Feed</a>
            </section>
          )}

          {state === "ready" && profile && (
            <>
              <section className="phase12-public-hero">
                <div className="phase12-public-avatar">{initials}</div>
                <span>LOCAL PROFILE</span>
                <h1>{profile.display_name}</h1>
                <p>{memberLabel(profile.member_since)}</p>
                <div className="phase12-public-level">✓ {profile.reputation_level}</div>
              </section>

              <section className="phase12-public-signals" aria-label="Community reputation signals">
                <div><strong>{profile.helpful_pings}</strong><span>Helpful earned</span></div>
                <div><strong>{profile.confirmations}</strong><span>Confirms earned</span></div>
                <div><strong>{profile.reputation_points}</strong><span>Reputation pts</span></div>
              </section>

              <section className="phase12-public-reputation">
                <div><strong>How reputation works</strong><span>{profile.reputation_level}</span></div>
                <p>Ping uses visible community signals rather than a hidden trust score. Helpful earned counts for 3 points and confirmations earned count for 1 point.</p>
                <div className="phase12-public-progress"><span style={{ width: `${progress}%` }} /></div>
                <small>{profile.next_level_points ? `${profile.next_level_points - profile.reputation_points} points to the next level` : "Highest current reputation level"}</small>
              </section>

              <section className="phase12-public-privacy">
                <span>🛡️</span>
                <div><strong>Privacy by design</strong><p>Public profiles do not show email, exact location or a home address. Reputation is community activity, not identity verification.</p></div>
              </section>
            </>
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

      <style jsx global>{`
        .phase12-public-screen{min-height:100%;padding-bottom:104px}.phase12-public-header{display:grid;grid-template-columns:42px 1fr 42px;align-items:center;padding:20px 20px 12px}.phase12-public-header>.brand{text-align:center}.phase12-public-header>button{width:40px;height:40px;border:0;border-radius:50%;background:#fff;color:#233329;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:29px;line-height:1}.phase12-public-hero{text-align:center;padding:20px 22px 18px}.phase12-public-avatar{width:82px;height:82px;margin:0 auto 14px;border-radius:26px;background:linear-gradient(145deg,#5ce253,#3cab42);display:grid;place-items:center;color:#fff;font-size:24px;font-weight:950;box-shadow:0 13px 28px rgba(67,177,67,.22)}.phase12-public-hero>span{font-size:8px;font-weight:950;letter-spacing:.9px;color:#839085}.phase12-public-hero h1{margin:7px 0 4px;font-size:27px;letter-spacing:-.8px}.phase12-public-hero p{margin:0;color:#7b857d;font-size:10px}.phase12-public-level{display:inline-flex;margin-top:12px;padding:8px 11px;border-radius:999px;background:#edf8e9;color:#2e6832;font-size:10px;font-weight:900}.phase12-public-signals{margin:0 15px 14px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.phase12-public-signals div{padding:15px 8px;border:1px solid #e2e7df;border-radius:18px;background:#fff;text-align:center}.phase12-public-signals strong{display:block;font-size:19px}.phase12-public-signals span{display:block;margin-top:3px;color:#737e75;font-size:8px;line-height:1.25}.phase12-public-reputation{margin:0 15px 14px;padding:17px;border-radius:21px;background:#1c291e;color:#fff}.phase12-public-reputation>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:10px}.phase12-public-reputation>div:first-child strong{font-size:13px}.phase12-public-reputation>div:first-child span{padding:6px 8px;border-radius:999px;background:rgba(255,255,255,.1);color:#cfe0d1;font-size:8px;font-weight:850}.phase12-public-reputation p{margin:10px 0;color:#c8d3ca;font-size:10px;line-height:1.5}.phase12-public-progress{height:7px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}.phase12-public-progress span{display:block;height:100%;border-radius:inherit;background:#62e45a}.phase12-public-reputation small{display:block;margin-top:7px;color:#aebcaf;font-size:8px}.phase12-public-privacy{margin:0 15px;padding:15px;display:flex;gap:11px;border:1px solid #dfe5dc;border-radius:19px;background:#f3f6f0}.phase12-public-privacy>span{font-size:20px}.phase12-public-privacy strong{font-size:11px}.phase12-public-privacy p{margin:4px 0 0;color:#737d74;font-size:9px;line-height:1.45}.phase12-public-state{margin:32px 15px;padding:34px 22px;border:1px solid #e2e7df;border-radius:24px;background:#fff;text-align:center}.phase12-public-state>div{font-size:34px}.phase12-public-state h1{margin:9px 0 5px}.phase12-public-state p{margin:0 0 15px;color:#758077;font-size:12px}.phase12-public-state a{display:inline-block;padding:11px 14px;border-radius:13px;background:#59d951;color:#173618;text-decoration:none;font-size:11px;font-weight:900}.bottom-nav a{height:100%;border:0;background:transparent;color:#8a928b;font-size:10px;font-weight:800;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;position:relative;text-decoration:none}.bottom-nav a>span{font-size:22px;line-height:1}.bottom-nav a.active{color:#1f5420}.bottom-nav a.compose-nav{color:#1f5420}
      `}</style>
    </div>
  );
}
