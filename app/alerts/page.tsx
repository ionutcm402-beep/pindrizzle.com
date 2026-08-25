"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NotificationKind = "reply" | "confirmation" | "helpful";
type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  ping_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

const kindMeta: Record<NotificationKind, { icon: string; label: string }> = {
  reply: { icon: "💬", label: "Reply" },
  confirmation: { icon: "✓", label: "Confirmation" },
  helpful: { icon: "★", label: "Helpful" },
};

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AlertsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      const session = authData.session;
      setUserId(session?.user.id || null);
      setEmail(session?.user.email || null);
      if (!session?.user) {
        setNotifications([]);
        return;
      }
      const { data, error } = await supabase
        .from("notifications")
        .select("id,user_id,actor_id,ping_id,kind,title,body,read_at,created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setNotifications((data || []) as NotificationRow[]);
    } catch (error) {
      console.error("Notifications failed", error);
      setMessage("Alerts could not load right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id || null);
      setEmail(session?.user.email || null);
      setTimeout(() => void load(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`phase6-alerts-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        void load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, load]);

  const unread = useMemo(() => notifications.filter((item) => !item.read_at).length, [notifications]);

  const markRead = async (item: NotificationRow) => {
    if (item.read_at) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
    const { error } = await createClient().from("notifications").update({ read_at: readAt }).eq("id", item.id);
    if (error) {
      console.error("Mark notification read failed", error);
      void load();
    }
  };

  const openNotification = async (item: NotificationRow) => {
    await markRead(item);
    if (item.ping_id) {
      window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { id: item.ping_id, live: true } }));
    }
  };

  const markAllRead = async () => {
    if (!userId || unread === 0) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    const { error } = await createClient()
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) {
      console.error("Mark all notifications read failed", error);
      setMessage("Some alerts could not be marked read.");
      void load();
    }
  };

  const openAuth = () => {
    window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to see replies, confirmations and Helpful activity." } }));
  };

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="phase6-alerts-screen">
          <header className="phase6-alerts-header">
            <a href="/" className="phase6-alerts-back" aria-label="Back to Feed">‹</a>
            <div className="phase6-alerts-heading">
              <div className="brand small">ping<span>.</span></div>
              <div className="phase6-title-row"><h1>Alerts</h1>{unread > 0 && <span>{unread} new</span>}</div>
            </div>
            {userId && unread > 0 ? <button type="button" onClick={markAllRead}>Read all</button> : <span />}
          </header>

          {!userId && !loading ? (
            <section className="phase6-empty-card">
              <div className="phase6-empty-icon">🔔</div>
              <h2>Your useful activity lives here.</h2>
              <p>Sign in to see replies, confirmations and Helpful marks on the Pings you care about.</p>
              <button type="button" onClick={openAuth}>Sign in / Sign up</button>
            </section>
          ) : loading ? (
            <section className="phase6-empty-card"><div className="phase6-empty-icon">…</div><h2>Checking your alerts.</h2><p>Getting the latest useful activity.</p></section>
          ) : notifications.length ? (
            <section className="phase6-alert-list" aria-label="Notifications">
              {notifications.map((item) => {
                const meta = kindMeta[item.kind];
                return (
                  <button key={item.id} type="button" className={`phase6-alert-card ${item.read_at ? "read" : "unread"}`} onClick={() => openNotification(item)}>
                    <div className="phase6-alert-icon">{meta.icon}</div>
                    <div className="phase6-alert-copy">
                      <div className="phase6-alert-top"><span>{meta.label}</span><time>{relativeTime(item.created_at)}</time></div>
                      <strong>{item.title}</strong>
                      {item.body && <p>{item.body}</p>}
                    </div>
                    {!item.read_at && <span className="phase6-unread-dot" aria-label="Unread" />}
                  </button>
                );
              })}
            </section>
          ) : (
            <section className="phase6-empty-card">
              <div className="phase6-empty-icon">✓</div>
              <h2>You’re all caught up.</h2>
              <p>When someone replies to, confirms or marks one of your Pings Helpful, it will appear here.</p>
            </section>
          )}

          {email && <div className="phase6-account-note">Alerts for <strong>{email}</strong></div>}
          {message && <div className="phase6-message">{message}</div>}
          <section className="phase6-rule-card"><strong>Useful notifications only.</strong><p>No “we miss you” messages. Ping alerts are reserved for real activity that matters.</p></section>
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          <a href="/"><span>⌂</span>Feed</a>
          <a href="/#map"><span>⌖</span>Map</a>
          <a href="/" className="compose-nav"><span>+</span>Ping</a>
          <a href="/alerts" className="active"><span>♢</span>Alerts{unread > 0 && <i>{unread > 99 ? "99+" : unread}</i>}</a>
          <a href="/you"><span>○</span>You</a>
        </nav>
      </div>

      <style jsx global>{`
        .phase6-alerts-screen{min-height:100%;padding:0 18px 110px}.phase6-alerts-header{display:grid;grid-template-columns:42px 1fr auto;gap:12px;align-items:start;padding:24px 4px 20px}.phase6-alerts-back{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;text-decoration:none;color:#233329;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:29px;line-height:1}.phase6-alerts-heading .brand{margin-top:2px}.phase6-title-row{display:flex;align-items:center;gap:9px;margin-top:14px}.phase6-title-row h1{margin:0;font-size:31px;letter-spacing:-1px}.phase6-title-row span{background:#e9f7e5;color:#2f6a34;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:900}.phase6-alerts-header>button{border:0;background:transparent;color:#37633b;font-size:10px;font-weight:900;padding:11px 0}.phase6-alert-list{display:grid;gap:10px}.phase6-alert-card{width:100%;border:1px solid #e2e8df;background:#fff;border-radius:20px;padding:14px;display:grid;grid-template-columns:44px 1fr auto;gap:11px;text-align:left;color:#172019;box-shadow:0 8px 22px rgba(25,40,28,.04)}.phase6-alert-card.unread{border-color:#cfe9ca;background:#fbfff9}.phase6-alert-card.read{opacity:.72}.phase6-alert-icon{width:44px;height:44px;border-radius:15px;background:#eef5eb;display:grid;place-items:center;font-size:18px}.phase6-alert-copy{min-width:0}.phase6-alert-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}.phase6-alert-top span{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.3px;color:#4e6a54}.phase6-alert-top time{font-size:9px;color:#8a938b}.phase6-alert-copy>strong{display:block;font-size:13px;line-height:1.3}.phase6-alert-copy p{margin:5px 0 0;color:#667168;font-size:11px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.phase6-unread-dot{width:9px;height:9px;border-radius:50%;background:#57d950;margin-top:6px}.phase6-empty-card{margin-top:18px;padding:32px 22px;border-radius:24px;background:#fff;border:1px solid #e4e9e1;text-align:center}.phase6-empty-icon{width:54px;height:54px;border-radius:18px;background:#eef5eb;display:grid;place-items:center;margin:0 auto 13px;font-size:24px}.phase6-empty-card h2{font-size:20px;margin:0 0 7px}.phase6-empty-card p{margin:0 auto;color:#6a756c;font-size:12px;line-height:1.55;max-width:310px}.phase6-empty-card button{margin-top:17px;border:0;border-radius:14px;background:#59d951;color:#163819;padding:13px 18px;font-weight:950}.phase6-account-note,.phase6-message{margin:12px 3px 0;color:#7c867d;font-size:9px;text-align:center}.phase6-message{color:#7a4b45}.phase6-rule-card{margin-top:15px;padding:16px;border-radius:18px;background:#eef4ec}.phase6-rule-card strong{font-size:11px}.phase6-rule-card p{margin:5px 0 0;color:#6a756c;font-size:10px;line-height:1.5}.bottom-nav a{height:100%;border:0;background:transparent;color:#8a928b;font-size:10px;font-weight:800;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;position:relative;text-decoration:none}.bottom-nav a>span{font-size:22px;line-height:1}.bottom-nav a.active{color:#1f5420}.bottom-nav a.compose-nav{color:#1f5420}
      `}</style>
    </div>
  );
}
