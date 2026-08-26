"use client";

import { useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ProductEvent =
  | "session_start"
  | "feed_view"
  | "map_view"
  | "search_view"
  | "place_view"
  | "alerts_view"
  | "you_view"
  | "promote_view"
  | "business_view"
  | "ping_open"
  | "onboarding_complete"
  | "onboarding_skip";

const SESSION_KEY = "ping-product-session-v1";
const SEEN_PREFIX = "ping-product-seen-v1:";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const routeEvents: Record<string, ProductEvent> = {
  "/": "feed_view",
  "/map": "map_view",
  "/search": "search_view",
  "/place": "place_view",
  "/alerts": "alerts_view",
  "/you": "you_view",
  "/promote": "promote_view",
  "/business": "business_view",
};

function browserSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing && uuidPattern.test(existing)) return existing;
    const created = window.crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return null;
  }
}

function seenKey(session: string, eventType: ProductEvent) {
  return `${SEEN_PREFIX}${session}:${eventType}`;
}

export default function Phase19ProductAnalytics() {
  const pathname = usePathname();

  const record = useCallback(async (eventType: ProductEvent) => {
    const session = browserSessionId();
    if (!session) return;

    const key = seenKey(session, eventType);
    try {
      if (window.sessionStorage.getItem(key) === "1") return;
    } catch {}

    try {
      const { error } = await createClient().rpc("record_product_event", {
        target_event_type: eventType,
        browser_session: session,
      });
      if (error) return;
      try { window.sessionStorage.setItem(key, "1"); } catch {}
    } catch {
      // Analytics must never interrupt the product experience.
    }
  }, []);

  useEffect(() => {
    void record("session_start");
    const routeEvent = routeEvents[pathname];
    if (routeEvent) void record(routeEvent);
  }, [pathname, record]);

  useEffect(() => {
    const onPingOpen = () => void record("ping_open");
    const onProductEvent = (event: Event) => {
      const eventType = (event as CustomEvent<{ eventType?: ProductEvent }>).detail?.eventType;
      if (eventType === "onboarding_complete" || eventType === "onboarding_skip") void record(eventType);
    };

    window.addEventListener("ping:open-detail", onPingOpen);
    window.addEventListener("ping:product-event", onProductEvent as EventListener);
    return () => {
      window.removeEventListener("ping:open-detail", onPingOpen);
      window.removeEventListener("ping:product-event", onProductEvent as EventListener);
    };
  }, [record]);

  return null;
}
