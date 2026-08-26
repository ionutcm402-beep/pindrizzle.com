"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type Category = "alert" | "traffic" | "lost_found" | "free" | "help" | "local";
type Pulse = {
  unusually_active: boolean;
  recent_pings: number;
  baseline_pings: number;
  distinct_authors: number;
  leading_category: Category | null;
  leading_category_count: number;
  window_minutes: number;
};

const categoryLabel: Record<Category, string> = {
  alert: "Alerts",
  traffic: "Traffic",
  lost_found: "Lost & Found",
  free: "Free",
  help: "Help",
  local: "Local",
};

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null;
  if (value && typeof value === "object") return value as T;
  return null;
}

function radiusMeters() {
  const visibleSelect = document.querySelector<HTMLSelectElement>(".location-status select");
  const fromPage = Number(visibleSelect?.value || 0);
  if ([0.5, 1, 3, 5].includes(fromPage)) return Math.round(fromPage * 1609.344);
  try {
    const stored = Number(localStorage.getItem("ping-radius") || 1);
    if ([0.5, 1, 3, 5].includes(stored)) return Math.round(stored * 1609.344);
  } catch {}
  return 1609;
}

async function getCoords() {
  if (!navigator.geolocation) throw new Error("Location unavailable");
  return await new Promise<GeolocationCoordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      reject,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });
}

export default function Phase8NearbyPulse() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [pulse, setPulse] = useState<Pulse | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        setPulse(null);
        return;
      }

      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        if (permission.state !== "granted") {
          setPulse(null);
          return;
        }
      }

      const coords = await getCoords();
      const { data, error } = await supabase.rpc("retention_nearby_activity_pulse", {
        viewer_lat: coords.latitude,
        viewer_lng: coords.longitude,
        radius_meters: radiusMeters(),
      });
      if (error) throw error;
      const row = firstRow<Pulse>(data);
      setPulse(row && row.unusually_active ? row : null);
    } catch (error) {
      console.error("Nearby activity pulse failed", error);
      setPulse(null);
    }
  }, []);

  useEffect(() => {
    const attach = () => {
      if (window.location.pathname !== "/") {
        setHost(null);
        return;
      }
      const filter = document.querySelector<HTMLElement>(".filter-row");
      const parent = filter?.parentElement;
      if (!filter || !parent) return;

      let node = parent.querySelector<HTMLElement>("[data-phase8-pulse-host]");
      if (!node) {
        node = document.createElement("div");
        node.dataset.phase8PulseHost = "true";
        parent.insertBefore(node, filter);
      }
      setHost(node);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", attach);
    window.addEventListener("popstate", attach);
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", attach);
      window.removeEventListener("popstate", attach);
    };
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const channel = supabase
      .channel("phase8-nearby-pulse")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pings" }, () => setTimeout(() => void load(), 250))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pings" }, () => setTimeout(() => void load(), 250))
      .subscribe();
    const timer = window.setInterval(() => void load(), 120000);
    const handleCommunity = () => setTimeout(() => void load(), 250);
    window.addEventListener("ping:community-changed", handleCommunity);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("ping:community-changed", handleCommunity);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  if (!host || !pulse) return null;

  const leading = pulse.leading_category ? categoryLabel[pulse.leading_category] : null;
  const openActivity = () => {
    if (pulse.leading_category) {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".filter-row button"));
      const target = buttons.find((button) => button.textContent?.trim().toLowerCase().includes(categoryLabel[pulse.leading_category!].toLowerCase()));
      target?.click();
    }
    document.querySelector<HTMLElement>(".feed-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return createPortal(
    <section className="phase8-pulse-card" aria-label="Unusually active nearby area">
      <div className="phase8-pulse-icon">◉</div>
      <div className="phase8-pulse-copy">
        <span>NEARBY PULSE</span>
        <h2>Your area is busier than usual.</h2>
        <p>{pulse.recent_pings} useful Pings from {pulse.distinct_authors} people in the last {pulse.window_minutes} minutes{leading && pulse.leading_category_count >= 2 ? `, with ${leading} standing out.` : "."}</p>
      </div>
      <button type="button" onClick={openActivity}>See activity →</button>
      <style jsx>{`
        .phase8-pulse-card{margin:0 18px 13px;padding:14px;border:1px solid #d7e7d1;border-radius:19px;background:linear-gradient(145deg,#eaf7e4,#f8fbf5);display:grid;grid-template-columns:38px 1fr auto;gap:10px;align-items:center;box-shadow:0 8px 24px rgba(31,41,32,.04)}
        .phase8-pulse-icon{width:38px;height:38px;border-radius:13px;background:#d7efd0;display:grid;place-items:center;color:#34713c;font-size:17px;font-weight:950}.phase8-pulse-copy{min-width:0}.phase8-pulse-copy>span{font-size:7px;font-weight:950;letter-spacing:.11em;color:#68806c}.phase8-pulse-copy h2{margin:3px 0 3px;font-size:14px;letter-spacing:-.2px}.phase8-pulse-copy p{margin:0;color:#69766b;font-size:9px;line-height:1.4}.phase8-pulse-card>button{border:0;border-radius:11px;background:#1f3424;color:#fff;padding:9px 10px;font-size:8px;font-weight:900;white-space:nowrap;cursor:pointer}
        @media(max-width:430px){.phase8-pulse-card{grid-template-columns:34px 1fr}.phase8-pulse-icon{width:34px;height:34px}.phase8-pulse-card>button{grid-column:1/-1;width:100%}}
      `}</style>
    </section>,
    host,
  );
}
