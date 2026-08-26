"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Phase4RealtimeBridge() {
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refreshMapIfOpen = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const refreshButton = document.querySelector<HTMLButtonElement>(
          'button[aria-label="Refresh nearby Pings"]',
        );
        refreshButton?.click();
      }, 300);
    };

    const channel = supabase
      .channel("phase4-live-pings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pings" },
        refreshMapIfOpen,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
