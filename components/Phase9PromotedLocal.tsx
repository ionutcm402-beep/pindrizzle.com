"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type Category = "alert" | "traffic" | "lost_found" | "free" | "help" | "local";
type PromotedPing = {
  promotion_id: string;
  ping_id: string;
  user_id: string;
  category: Category;
  title: string;
  body: string;
  place_label: string | null;
  confirmation_count: number;
  comment_count: number;
  created_at: string;
  expires_at: string;
  distance_meters: number;
  sponsor_name: string;
  promoted_until: string;
};

const categoryMeta: Record<Category, { label: string; icon: string }> = {
  alert: { label: "Alert", icon: "🚨" },
  traffic: { label: "Traffic", icon: "🚧" },
  lost_found: { label: "Lost & Found", icon: "🐕" },
  free: { label: "Free", icon: "🎁" },
  help: { label: "Help", icon: "🙋" },
  local: { label: "Local", icon: "📍" },
};

function firstRow(value: unknown): PromotedPing | null {
  if (Array.isArray(value)) return (value[0] as PromotedPing | undefined) || null;
  if (value && typeof value === "object") return value as PromotedPing;
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

export default function Phase9PromotedLocal() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [item, setItem] = useState<PromotedPing | null>(null);

  const load = useCallback(async () => {
    try {
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        if (permission.state !== "granted") {
          setItem(null);
          return;
        }
      }
      const coords = await getCoords();
      const { data, error } = await createClient().rpc("nearby_promoted_pings", {
        viewer_lat: coords.latitude,
        viewer_lng: coords.longitude,
        radius_meters: radiusMeters(),
        result_limit: 1,
      });
      if (error) throw error;
      setItem(firstRow(data));
    } catch (error) {
      console.error("Promoted local Ping failed", error);
      setItem(null);
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

      let node = parent.querySelector<HTMLElement>("[data-phase9-promo-host]");
      if (!node) {
        node = document.createElement("div");
        node.dataset.phase9PromoHost = "true";
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
    const timer = window.setInterval(() => void load(), 120000);
    const onChange = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches?.(".location-status select")) setTimeout(() => void load(), 50);
    };
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => setTimeout(() => void load(), 0));
    document.addEventListener("change", onChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("change", onChange);
      data.subscription.unsubscribe();
    };
  }, [load]);

  if (!host || !item) return null;

  const meta = categoryMeta[item.category];
  const distanceMiles = item.distance_meters / 1609.344;
  const openPing = () => window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { id: item.ping_id, live: true } }));

  return createPortal(
    <section className="phase9-promoted-card" aria-label={`Promoted local Ping from ${item.sponsor_name}`}>
      <button type="button" className="phase9-promoted-main" onClick={openPing}>
        <div className="phase9-promoted-top">
          <div className="phase9-disclosure"><strong>Promoted</strong><span>Paid local placement</span></div>
          <span className="phase9-category">{meta.icon} {meta.label}</span>
        </div>
        <div className="phase9-sponsor">From {item.sponsor_name}</div>
        <h2>{item.title}</h2>
        <p>{item.body}</p>
        <div className="phase9-promoted-meta">
          <span>📍 {item.place_label || "Nearby"}</span>
          <span><b>{distanceMiles.toFixed(1)} mi</b> away</span>
          <span>{item.confirmation_count} confirmed</span>
        </div>
        <div className="phase9-promoted-foot"><span>Normal Report & Block controls still apply.</span><b>View Ping →</b></div>
      </button>
      <style jsx>{`
        .phase9-promoted-card{margin:0 18px 13px;border:1px solid #d8ddcf;border-radius:20px;background:#fffdf5;box-shadow:0 9px 28px rgba(45,43,28,.055);overflow:hidden}.phase9-promoted-main{width:100%;border:0;background:transparent;padding:14px 15px;text-align:left;color:#20251f;cursor:pointer}.phase9-promoted-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.phase9-disclosure{display:flex;align-items:center;gap:7px}.phase9-disclosure strong{border-radius:999px;background:#2f352c;color:#fff;padding:5px 8px;font-size:8px;letter-spacing:.02em}.phase9-disclosure span{font-size:8px;color:#7b806f;font-weight:750}.phase9-category{font-size:9px;font-weight:850;color:#62695f}.phase9-sponsor{margin-top:12px;font-size:9px;font-weight:850;color:#697061}.phase9-promoted-main h2{margin:5px 0 5px;font-size:18px;letter-spacing:-.35px}.phase9-promoted-main>p{margin:0;color:#697168;font-size:10px;line-height:1.45}.phase9-promoted-meta{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:10px;color:#7b8279;font-size:8px}.phase9-promoted-meta b{color:#4e594f}.phase9-promoted-foot{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid #ebeadd}.phase9-promoted-foot span{font-size:7px;color:#929486}.phase9-promoted-foot b{font-size:9px;color:#344236;white-space:nowrap}
      `}</style>
    </section>,
    host,
  );
}
