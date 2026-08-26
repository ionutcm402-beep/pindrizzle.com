"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FollowedPing = {
  id: string;
  title: string;
  body: string;
  category: "alert" | "traffic" | "lost_found" | "free" | "help" | "local";
  status: "active" | "resolved" | "expired" | "removed";
  place_label: string | null;
  confirmation_count: number;
  comment_count: number;
  created_at: string;
  expires_at: string;
  followed_at: string;
};

const categoryMeta: Record<FollowedPing["category"], { label: string; icon: string }> = {
  alert: { label: "Alert", icon: "🚨" },
  traffic: { label: "Traffic", icon: "🚧" },
  lost_found: { label: "Lost & Found", icon: "🐕" },
  free: { label: "Free", icon: "🎁" },
  help: { label: "Help", icon: "🙋" },
  local: { label: "Local", icon: "📍" },
};

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusLabel(status: FollowedPing["status"]) {
  if (status === "resolved") return "Resolved";
  if (status === "removed") return "Removed";
  if (status === "expired") return "Expired";
  return "Live";
}

export default function FollowingPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [items, setItems] = useState<FollowedPing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session?.user) {
        setSignedIn(false);
        setItems([]);
        return;
      }
      setSignedIn(true);
      const { data, error } = await supabase.rpc("my_followed_pings");
      if (error) throw error;
      setItems((data || []) as FollowedPing[]);
    } catch (error) {
      console.error("Followed Pings failed", error);
      setMessage("Followed Pings could not load right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => setTimeout(() => void load(), 0));
    return () => data.subscription.unsubscribe();
  }, [load]);

  useEffect(() => {
    if (!signedIn) return;
    const supabase = createClient();
    const channel = supabase
      .channel("phase8-following-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "ping_follows" }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pings" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [signedIn, load]);

  const unfollow = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await createClient().rpc("toggle_follow_ping", { target_ping_id: id });
      if (error) throw error;
      if (Boolean(data)) throw new Error("Expected unfollow result");
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Unfollow failed", error);
      setMessage("That Ping could not be unfollowed right now.");
    } finally {
      setBusyId(null);
    }
  };

  const openPing = (item: FollowedPing) => {
    if (item.status !== "active") return;
    window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { id: item.id, live: true } }));
  };

  const openAuth = () => window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to see the Pings you follow." } }));

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="phase8-following-screen">
          <header className="phase8-following-header">
            <a href="/you" className="phase8-following-back" aria-label="Back to You">‹</a>
            <div><div className="brand small">ping<span>.</span></div><h1>Followed Pings</h1></div>
          </header>

          <section className="phase8-following-intro">
            <span>★</span>
            <div><strong>Follow outcomes, not people.</strong><p>Keep track of a useful local situation and know when it is resolved or removed.</p></div>
          </section>

          {!loading && signedIn === false ? (
            <section className="phase8-following-empty"><h2>Your followed Pings live here.</h2><p>Sign in, open a nearby Ping and tap Follow.</p><button onClick={openAuth}>Sign in / Sign up</button></section>
          ) : loading ? (
            <section className="phase8-following-empty"><h2>Checking followed Pings…</h2></section>
          ) : items.length ? (
            <section className="phase8-following-list">
              {items.map((item) => {
                const meta = categoryMeta[item.category];
                return (
                  <article key={item.id} className={`phase8-follow-card ${item.status}`}>
                    <button className="phase8-follow-main" type="button" onClick={() => openPing(item)} disabled={item.status !== "active"}>
                      <div className="phase8-follow-card-top"><span>{meta.icon} {meta.label}</span><b>{statusLabel(item.status)}</b></div>
                      <h2>{item.title}</h2>
                      <p>{item.body}</p>
                      <div className="phase8-follow-meta"><span>{item.place_label || "Nearby"}</span><span>{item.confirmation_count} confirmed</span><span>{item.comment_count} replies</span></div>
                      <small>Followed {relativeTime(item.followed_at)}</small>
                    </button>
                    <button className="phase8-unfollow" type="button" onClick={() => void unfollow(item.id)} disabled={busyId === item.id}>{busyId === item.id ? "…" : "Unfollow"}</button>
                  </article>
                );
              })}
            </section>
          ) : (
            <section className="phase8-following-empty"><div>☆</div><h2>Nothing followed yet.</h2><p>Open a Ping that matters to you and tap Follow. Ping will bring you back only when there is a useful outcome.</p></section>
          )}

          {message && <div className="phase8-follow-message">{message}</div>}
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
        .phase8-following-screen{min-height:100%;padding:0 18px 108px}.phase8-following-header{display:flex;gap:14px;align-items:flex-start;padding:24px 4px 18px}.phase8-following-header h1{font-size:29px;letter-spacing:-.9px;margin:14px 0 0}.phase8-following-back{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;text-decoration:none;color:#233329;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:29px}.phase8-following-intro{display:grid;grid-template-columns:40px 1fr;gap:10px;padding:14px;border-radius:18px;background:#edf6e9;margin-bottom:13px}.phase8-following-intro>span{width:40px;height:40px;border-radius:13px;background:#dcefd6;display:grid;place-items:center;color:#35653b}.phase8-following-intro strong{font-size:12px}.phase8-following-intro p{margin:4px 0 0;color:#6c786e;font-size:10px;line-height:1.45}.phase8-following-list{display:grid;gap:10px}.phase8-follow-card{position:relative;border:1px solid #e0e7de;border-radius:20px;background:#fff;overflow:hidden}.phase8-follow-card.resolved{background:#f1f8ee;border-color:#cfe6c9}.phase8-follow-card.removed,.phase8-follow-card.expired{background:#f4f4f1}.phase8-follow-main{width:100%;border:0;background:transparent;padding:15px 15px 46px;text-align:left;color:#172019}.phase8-follow-main:disabled{cursor:default}.phase8-follow-card-top{display:flex;justify-content:space-between;gap:8px}.phase8-follow-card-top span{font-size:9px;font-weight:900;color:#5f6d62}.phase8-follow-card-top b{font-size:8px;border-radius:999px;padding:5px 7px;background:#e9f4e5;color:#35643b}.phase8-follow-card.removed .phase8-follow-card-top b{background:#f2e6e3;color:#87554e}.phase8-follow-main h2{font-size:17px;margin:10px 0 5px}.phase8-follow-main p{margin:0;color:#657167;font-size:11px;line-height:1.45}.phase8-follow-meta{display:flex;flex-wrap:wrap;gap:6px 11px;margin-top:10px;color:#7c867e;font-size:8px}.phase8-follow-main small{display:block;margin-top:8px;color:#909791;font-size:8px}.phase8-unfollow{position:absolute;right:12px;bottom:11px;border:1px solid #dfe5dc;border-radius:10px;background:#fff;padding:7px 9px;color:#657168;font-size:8px;font-weight:850}.phase8-following-empty{padding:30px 20px;border:1px solid #e1e7df;border-radius:22px;background:#fff;text-align:center}.phase8-following-empty>div{font-size:28px}.phase8-following-empty h2{font-size:18px;margin:7px 0}.phase8-following-empty p{max-width:300px;margin:0 auto;color:#6c776e;font-size:11px;line-height:1.5}.phase8-following-empty button{margin-top:14px;border:0;border-radius:12px;background:#59d951;padding:11px 15px;font-weight:900}.phase8-follow-message{margin-top:10px;text-align:center;color:#79544e;font-size:9px}
        .bottom-nav a{height:100%;border:0;background:transparent;color:#8a928b;font-size:10px;font-weight:800;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;position:relative;text-decoration:none}.bottom-nav a>span{font-size:22px;line-height:1}.bottom-nav a.active{color:#1f5420}.bottom-nav a.compose-nav{color:#1f5420}
      `}</style>
    </div>
  );
}
