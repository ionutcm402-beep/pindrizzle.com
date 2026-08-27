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
        setToast({ id:String(row.id || ""), title:String(row.title || "New Ping activity"), body:String(row.body || ""), pingId:row.ping_id ? String(row.ping_id) : null, kind });
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
    const selected = toast; setToast(null);
    try { await createClient().from("notifications").update({ read_at:new Date().toISOString() }).eq("id", selected.id); void loadUnread(userId); } catch {}
    if (selected.pingId) window.dispatchEvent(new CustomEvent("ping:open-detail", { detail:{ id:selected.pingId, live:true } }));
    else window.location.assign("/alerts");
  };

  return <>{toast && <button type="button" className="phase6-live-toast" onClick={() => void openToast()}><span className="phase6-live-toast-icon"><PingIcon name={toastIcon[toast.kind]} size={19} /></span><span className="phase6-live-toast-copy"><strong>{toast.title}</strong>{toast.body && <small>{toast.body}</small>}</span><span className="phase6-live-toast-arrow">›</span></button>}
    <style jsx global>{`.phase6-live-toast{position:fixed;z-index:170;left:50%;bottom:max(146px,calc(134px + env(safe-area-inset-bottom)));transform:translateX(-50%);width:min(calc(100% - 28px),410px);border:1px solid var(--ping-line);border-radius:16px;background:rgba(255,255,255,.98);box-shadow:0 18px 45px rgba(20,39,23,.18);backdrop-filter:blur(12px);padding:12px 13px;display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;text-align:left;color:var(--ping-ink)}.phase6-live-toast-icon{width:40px;height:40px;border-radius:12px;background:var(--ping-surface-soft);display:grid;place-items:center;color:var(--ping-ink-2)}.phase6-live-toast-copy{min-width:0}.phase6-live-toast-copy strong{display:block;font-size:12px}.phase6-live-toast-copy small{display:block;margin-top:3px;color:var(--ping-muted);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.phase6-live-toast-arrow{font-size:24px;color:var(--ping-muted)}`}</style></>;
}
