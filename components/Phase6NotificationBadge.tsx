"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Phase6NotificationBadge() {
  const [userId, setUserId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async (activeUserId?: string | null) => {
    const supabase = createClient();
    const resolvedUserId = activeUserId ?? (await supabase.auth.getSession()).data.session?.user.id ?? null;
    setUserId(resolvedUserId);
    if (!resolvedUserId) {
      setUnread(0);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        void loadUnread(userId);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, loadUnread]);

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

  return null;
}
