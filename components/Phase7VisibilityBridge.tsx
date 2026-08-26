"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Phase7VisibilityBridge() {
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const subscribe = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return;

      channel = supabase
        .channel(`phase7-visibility-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ping_hides", filter: `user_id=eq.${userId}` },
          () => {
            if (reloadTimer) clearTimeout(reloadTimer);
            reloadTimer = setTimeout(() => window.location.reload(), 450);
          },
        )
        .subscribe();
    };

    void subscribe();

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
