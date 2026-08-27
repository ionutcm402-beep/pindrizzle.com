"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PingIcon, { type PingIconName } from "@/components/PingIcon";

type ToastNotification = { id:string; title:string; body:string; pingId:string|null; kind:"reply"|"confirmation"|"helpful"|"follow_update"; };
const toastIcon: Record<ToastNotification["kind"], PingIconName> = { reply:"replies", confirmation:"confirmations", helpful:"check", follow_update:"following" };

export default function Phase6NotificationBadge() {
  const [userId, setUserId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<ToastNotification | null>(null);

  const loadUnread = useCallback(async (activeUserId?: string | null) => {
    const supabase = createClient();
    const resolved = activeUserId ?? (await supabase.auth.getSession()).data.session?.user.id ?? null;
    setUserId(resolved);
    if (!resolved) { setUnread(0); setToast(null); return; }
    const { count, error } = await supabase.from("notifications").select("id", { count:"exact", head:true }).eq("user_id", resolved).is("read_at", null);
    if (!error) setUnread(count || 0);
  }, []);

  useEffect(() => {
    void loadUnread();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => void loadUnread(session?.user.id || null));
    return () => data.subscription.unsubscribe();
  }, [loadUnread]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase.channel(`activity-badge-${userId}`).on("postgres_changes", { event:"*", schema:"public", table:"notifications", filter:`user_id=eq.${userId}` }, (payload) => {
      if (payload.eventType === "INSERT" && window.location.pathname !== "/alerts") {
        const row = payload.new as Record<string, unknown>;
        const rawKind = String(row.kind || "reply") as ToastNotification["kind"];
        const kind: ToastNotification["kind"] = rawKind in toastIcon ? rawKind : "reply";
        setToast({ id:String(row.id || ""), title:String(row.title || "New pin activity"), body:String(row.body || ""), pingId:row.ping_id ? String(row.ping_id) : null, kind });
      }
      void loadUnread(userId);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, loadUnread]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const apply = () => {
      const activity = document.querySelector<HTMLElement>('[data-ping-nav-role="activity"]');
      if (!activity) return;
      let badge = activity.querySelector<HTMLElement>(".ping-global-unread");
      if (unread <= 0) { badge?.remove(); return; }
      if (!badge) { badge = document.createElement("i"); badge.className = "ping-global-unread"; activity.appendChild(badge); }
      badge.textContent = unread > 99 ? "99+" : String(unread);
      badge.setAttribute("aria-label", `${unread} unread activity ${unread === 1 ? "item" : "items"}`);
    };
    apply();
    const observer = new MutationObserver(() => window.requestAnimationFrame(apply));
    observer.observe(document.body, { childList:true, subtree:true });
    return () => observer.disconnect();
  }, [unread]);

  const openToast = async () => {
    if (!toast) return;
    const selected = toast;
    setToast(null);
    try {
      await createClient().from("notifications").update({ read_at:new Date().toISOString() }).eq("id", selected.id);
      void loadUnread(userId);
    } catch {}
    if (selected.pingId) window.dispatchEvent(new CustomEvent("ping:open-detail", { detail:{ id:selected.pingId, live:true } }));
    else window.location.assign("/alerts");
  };

  return <>{toast && <button type="button" className="phase6-live-toast" onClick={() => void openToast()} aria-label={`Open activity: ${toast.title}`}>
    <span className="phase6-live-toast-icon"><PingIcon name={toastIcon[toast.kind]} size={19} /></span>
    <span className="phase6-live-toast-copy"><strong>{toast.title}</strong>{toast.body && <small>{toast.body}</small>}</span>
    <span className="phase6-live-toast-arrow">›</span>
  </button>}
    <style jsx global>{`
      .phase6-live-toast{position:fixed;z-index:170;left:50%;bottom:max(108px,calc(96px + env(safe-area-inset-bottom)));transform:translateX(-50%);width:min(calc(100% - 28px),410px);border:1px solid rgba(255,255,255,.76);border-radius:20px;background:rgba(247,252,254,.91);box-shadow:0 18px 46px rgba(7,43,68,.18),inset 0 0 0 1px rgba(20,78,107,.055);backdrop-filter:blur(28px) saturate(155%);-webkit-backdrop-filter:blur(28px) saturate(155%);padding:12px 13px;display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;text-align:left;color:var(--ping-ink);cursor:pointer}
      .phase6-live-toast:active{transform:translateX(-50%) scale(.985)}
      .phase6-live-toast-icon{width:40px;height:40px;border-radius:13px;background:linear-gradient(145deg,#edf9fc,#dff4f9);display:grid;place-items:center;color:#0a7399;box-shadow:inset 0 0 0 1px rgba(20,78,107,.06)}
      .phase6-live-toast-copy{min-width:0}.phase6-live-toast-copy strong{display:block;color:#082f4a;font-size:12px;font-weight:780;letter-spacing:-.015em}.phase6-live-toast-copy small{display:block;margin-top:3px;color:#708896;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.phase6-live-toast-arrow{font-size:24px;color:#2d96d0}
      @media(prefers-reduced-motion:reduce){.phase6-live-toast:active{transform:translateX(-50%)}}
    `}</style></>;
}
