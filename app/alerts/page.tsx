"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/async-timeout";
import PingIcon, { type PingIconName } from "@/components/PingIcon";

type NotificationKind = "reply" | "confirmation" | "helpful" | "follow_update";
type NotificationRow = { id:string; user_id:string; actor_id:string|null; ping_id:string|null; kind:NotificationKind; title:string; body:string; read_at:string|null; created_at:string; };
type LoadMode = "initial" | "refresh";

const kindMeta: Record<NotificationKind, { icon: PingIconName; label: string }> = {
  reply: { icon: "replies", label: "Reply" },
  confirmation: { icon: "confirmations", label: "Confirmation" },
  helpful: { icon: "check", label: "Helpful" },
  follow_update: { icon: "following", label: "Outcome" },
};
const LOAD_TIMEOUT_MS = 10000;

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isToday(value: string) {
  const date = new Date(value); const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export default function AlertsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const loadInFlightRef = useRef<Promise<void> | null>(null);

  const load = useCallback((mode: LoadMode = "refresh") => {
    if (loadInFlightRef.current) return loadInFlightRef.current;

    const run = (async () => {
      if (mode === "initial") setLoading(true); else setRefreshing(true);
      setLoadError("");
      if (mode === "initial") setMessage("");
      try {
        const supabase = createClient();
        const { data: authData } = await withTimeout(supabase.auth.getSession(), LOAD_TIMEOUT_MS, "Session check timed out.");
        const session = authData.session;
        setUserId(session?.user.id || null);
        if (!session?.user) { setNotifications([]); return; }
        const { data, error } = await withTimeout(
          supabase.from("notifications").select("id,user_id,actor_id,ping_id,kind,title,body,read_at,created_at").eq("user_id", session.user.id).order("created_at", { ascending:false }).limit(100),
          LOAD_TIMEOUT_MS,
          "Activity request timed out.",
        );
        if (error) throw error;
        setNotifications((data || []) as NotificationRow[]);
      } catch (error) {
        console.error("Activity failed", error);
        setLoadError("Activity is unavailable. Check your connection and try again.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    })();

    loadInFlightRef.current = run;
    void run.finally(() => {
      if (loadInFlightRef.current === run) loadInFlightRef.current = null;
    });
    return run;
  }, []);

  useEffect(() => {
    void load("initial");
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      setUserId(session?.user.id || null);
      if (!session?.user) { setNotifications([]); setLoading(false); setRefreshing(false); return; }
      setTimeout(() => void load("refresh"), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase.channel(`activity-${userId}`).on("postgres_changes", { event:"*", schema:"public", table:"notifications", filter:`user_id=eq.${userId}` }, () => void load("refresh")).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, load]);

  const unread = useMemo(() => notifications.filter((item) => !item.read_at).length, [notifications]);
  const today = useMemo(() => notifications.filter((item) => isToday(item.created_at)), [notifications]);
  const earlier = useMemo(() => notifications.filter((item) => !isToday(item.created_at)), [notifications]);

  const markRead = async (item: NotificationRow) => {
    if (item.read_at) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at:readAt } : entry));
    const { error } = await createClient().from("notifications").update({ read_at:readAt }).eq("id", item.id);
    if (error) void load("refresh");
  };

  const openNotification = async (item: NotificationRow) => {
    await markRead(item);
    if (item.kind === "follow_update") { window.location.assign("/following"); return; }
    if (item.ping_id) window.dispatchEvent(new CustomEvent("ping:open-detail", { detail:{ id:item.ping_id, live:true } }));
  };

  const markAllRead = async () => {
    if (!userId || unread === 0) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at:readAt }));
    const { error } = await createClient().from("notifications").update({ read_at:readAt }).eq("user_id", userId).is("read_at", null);
    if (error) { setMessage("Some activity could not be marked read."); void load("refresh"); }
  };

  const openAuth = () => window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail:{ message:"Sign in to see activity." } }));

  const renderGroup = (title: string, rows: NotificationRow[]) => rows.length ? (
    <section className="activity-group" aria-label={title}><h2>{title}</h2><div className="activity-list">{rows.map((item) => { const meta = kindMeta[item.kind] || { icon:"bell" as PingIconName, label:"Update" }; return (
      <button key={item.id} type="button" className={`activity-card ${item.read_at ? "read" : "unread"}`} onClick={() => void openNotification(item)}>
        <span className="activity-icon"><PingIcon name={meta.icon} size={19} /></span>
        <span className="activity-copy"><span className="activity-top"><b>{meta.label}</b><time>{relativeTime(item.created_at)}</time></span><strong>{item.title}</strong>{item.body && <small>{item.body}</small>}</span>
        {!item.read_at && <i className="activity-unread" aria-label="Unread" />}
      </button>
    ); })}</div></section>
  ) : null;

  const errorState = Boolean(loadError) && !loading && notifications.length === 0;

  return (
    <div className="page-shell"><div className="app-shell"><main className="activity-screen">
      <header className="activity-header"><div><div className="brand small">Pindrizzle</div><div className="activity-title"><h1>Activity</h1>{unread > 0 && <span>{unread} new</span>}</div><p>Replies, confirmations and outcomes from your pins.</p></div>{userId && unread > 0 && <button type="button" onClick={() => void markAllRead()}>Read all</button>}</header>

      {errorState ? <section className="activity-empty"><span><PingIcon name="alert" size={26} /></span><h2>Activity is unavailable</h2><p>{loadError}</p><button type="button" onClick={() => void load("initial")}>Retry</button></section>
      : !userId && !loading ? <section className="activity-empty"><span><PingIcon name="alerts" size={26} /></span><h2>Sign in to see activity</h2><p>See replies, confirmations, Helpful marks and followed outcomes.</p><button type="button" onClick={openAuth}>Sign in / Sign up</button></section>
      : loading ? <section className="activity-empty"><h2>Loading activity…</h2></section>
      : notifications.length ? <>{renderGroup("TODAY", today)}{renderGroup("EARLIER", earlier)}</>
      : <section className="activity-empty"><span><PingIcon name="check" size={26} /></span><h2>No new activity</h2><p>Replies, confirmations and followed outcomes will appear here.</p></section>}

      {refreshing && notifications.length > 0 && <div className="activity-message" role="status">Refreshing…</div>}
      {loadError && notifications.length > 0 && <div className="activity-message" role="status">{loadError} <button type="button" onClick={() => void load("refresh")}>Retry</button></div>}
      {message && <div className="activity-message" role="status">{message}</div>}
      <section className="activity-rule"><strong>Only relevant activity.</strong><p>Activity is reserved for real actions and outcomes. No engagement reminders.</p></section>
    </main></div>
    <style jsx global>{`
      .activity-screen{min-height:100%;padding:0 18px 120px}.activity-header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:25px 2px 18px}.activity-title{display:flex;align-items:center;gap:9px;margin-top:12px}.activity-title h1{margin:0;font-size:31px;letter-spacing:-1px}.activity-title span{background:var(--ping-accent-soft);color:var(--ping-accent-ink);border-radius:999px;padding:5px 8px;font-size:9px;font-weight:800}.activity-header p{margin:6px 0 0;color:var(--ping-muted);font-size:10px}.activity-header>button{border:0;background:transparent;color:var(--ping-accent-ink);font-size:10px;font-weight:800;padding:10px 0}.activity-group{margin-top:14px}.activity-group>h2{margin:0 0 8px 3px;color:var(--ping-muted-2);font-size:8px;letter-spacing:.1em}.activity-list{border:1px solid var(--ping-line);border-radius:16px;background:#fff;overflow:hidden}.activity-card{width:100%;border:0;border-bottom:1px solid var(--ping-line);background:#fff;padding:13px;display:grid;grid-template-columns:40px 1fr auto;gap:10px;text-align:left;color:var(--ping-ink)}.activity-card:last-child{border-bottom:0}.activity-card.read{opacity:.72}.activity-card.unread{background:#fbfef9}.activity-icon{width:40px;height:40px;border-radius:12px;background:var(--ping-surface-soft);display:grid;place-items:center;color:var(--ping-ink-2)}.activity-copy{min-width:0}.activity-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.activity-top b{font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:var(--ping-muted)}.activity-top time{font-size:8px;color:var(--ping-muted-2)}.activity-copy>strong{display:block;margin-top:4px;font-size:12px;line-height:1.3}.activity-copy>small{display:-webkit-box;margin-top:4px;color:var(--ping-muted);font-size:10px;line-height:1.4;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.activity-unread{width:8px;height:8px;border-radius:50%;background:var(--ping-accent);margin-top:5px}.activity-empty{margin-top:22px;padding:36px 22px;border:1px solid var(--ping-line);border-radius:18px;background:#fff;text-align:center}.activity-empty>span{width:52px;height:52px;display:grid;place-items:center;margin:0 auto 13px;border-radius:15px;background:var(--ping-surface-soft)}.activity-empty h2{font-size:20px;margin:0 0 7px}.activity-empty p{margin:0 auto;color:var(--ping-muted);font-size:12px;line-height:1.55;max-width:310px}.activity-empty button{margin-top:17px;border:0;border-radius:12px;background:var(--ping-ink);color:#fff;padding:13px 18px;font-weight:800}.activity-message{margin:12px 3px 0;color:#7a4b45;font-size:9px;text-align:center}.activity-message button{margin-left:6px;border:0;background:transparent;color:var(--ping-accent-ink);font-weight:800}.activity-rule{margin-top:16px;padding:15px 3px;border-top:1px solid var(--ping-line)}.activity-rule strong{font-size:11px}.activity-rule p{margin:5px 0 0;color:var(--ping-muted);font-size:10px;line-height:1.5}
    `}</style></div>
  );
}
