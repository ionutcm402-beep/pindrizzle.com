"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ToastNotification = {
  id: string;
  title: string;
  body: string;
  pingId: string | null;
  kind: "reply" | "confirmation" | "helpful";
};

const toastIcon: Record<ToastNotification["kind"], string> = {
  reply: "💬",
  confirmation: "✓",
  helpful: "★",
};

export default function Phase6NotificationBadge() {
  const [userId, setUserId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<ToastNotification | null>(null);

  const loadUnread = useCallback(async (activeUserId?: string | null) => {
    const supabase = createClient();
    const resolvedUserId = activeUserId ?? (await supabase.auth.getSession()).data.session?.user.id ?? null;
    setUserId(resolvedUserId);
    if (!resolvedUserId) {
      setUnread(0);
      setToast(null);
      return;
    }
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", resolvedUserId)
      .is("read_at", null);
    if (error) {
      console.error("Unread notifications failed", error);
      return;
    }
    setUnread(count || 0);
  }, []);

  useEffect(() => {
    void loadUnread();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadUnread(session?.user.id || null);
    });
    return () => data.subscription.unsubscribe();
  }, [loadUnread]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`phase6-notification-badge-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === "INSERT" && window.location.pathname !== "/alerts") {
          const row = payload.new as Record<string, unknown>;
          const kind = String(row.kind || "reply") as ToastNotification["kind"];
          setToast({
            id: String(row.id || ""),
            title: String(row.title || "New Ping activity"),
            body: String(row.body || ""),
            pingId: row.ping_id ? String(row.ping_id) : null,
            kind: kind in toastIcon ? kind : "reply",
          });
        }
        void loadUnread(userId);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, loadUnread]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const apply = () => {
      const navs = Array.from(document.querySelectorAll<HTMLElement>(".bottom-nav"));
      for (const nav of navs) {
        const controls = Array.from(nav.querySelectorAll<HTMLElement>("button,a"));
        const alerts = controls.find((control) => control.textContent?.replace(/\d+/g, "").trim().endsWith("Alerts"));
        if (!alerts) continue;
        let badge = alerts.querySelector<HTMLElement>("i");
        if (unread <= 0) {
          badge?.remove();
          continue;
        }
        if (!badge) {
          badge = document.createElement("i");
          alerts.appendChild(badge);
        }
        badge.textContent = unread > 99 ? "99+" : String(unread);
        badge.setAttribute("aria-label", `${unread} unread alerts`);
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [unread]);

  const openToast = async () => {
    if (!toast) return;
    const selected = toast;
    setToast(null);
    try {
      await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", selected.id);
      void loadUnread(userId);
    } catch {}
    if (selected.pingId) {
      window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { id: selected.pingId, live: true } }));
    } else {
      window.location.assign("/alerts");
    }
  };

  return (
    <>
      {toast && (
        <button type="button" className="phase6-live-toast" onClick={openToast}>
          <span className="phase6-live-toast-icon">{toastIcon[toast.kind]}</span>
          <span className="phase6-live-toast-copy"><strong>{toast.title}</strong>{toast.body && <small>{toast.body}</small>}</span>
          <span className="phase6-live-toast-arrow">›</span>
        </button>
      )}
      <style jsx global>{`
        .phase6-live-toast{position:fixed;z-index:88;left:50%;bottom:88px;transform:translateX(-50%);width:min(calc(100% - 28px),410px);border:1px solid #dfe8dc;border-radius:18px;background:rgba(251,255,249,.97);box-shadow:0 18px 45px rgba(20,39,23,.2);backdrop-filter:blur(12px);padding:12px 13px;display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;text-align:left;color:#172019}.phase6-live-toast-icon{width:40px;height:40px;border-radius:13px;background:#eaf6e6;display:grid;place-items:center;font-size:17px;font-weight:900}.phase6-live-toast-copy{min-width:0}.phase6-live-toast-copy strong{display:block;font-size:12px}.phase6-live-toast-copy small{display:block;margin-top:3px;color:#68756b;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.phase6-live-toast-arrow{font-size:24px;color:#718078}
      `}</style>
    </>
  );
}
