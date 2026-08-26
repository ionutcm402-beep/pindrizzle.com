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
  try {
    const stored = Number(localStorage.getItem("ping-radius") || 1);
    if ([0.5, 1, 3, 5].includes(stored)) return Math.round(stored * 1609.344);
  } catch {}
  return 1609;
}

function locationIsActive() {
  return Boolean(document.querySelector(".location-status.good"));
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

function promotionSessionId(promotionId: string) {
  try {
    const key = `ping:promotion-session:${promotionId}`;
    const current = window.sessionStorage.getItem(key);
    if (current) return current;
    if (!window.crypto?.randomUUID) return null;
    const next = window.crypto.randomUUID();
    window.sessionStorage.setItem(key, next);
    return next;
  } catch {
    return null;
  }
}

async function recordPromotionEvent(item: PromotedPing, eventKind: "impression" | "open") {
  const browserSession = promotionSessionId(item.promotion_id);
  if (!browserSession) return;
  try {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getSession();
    if (authData.session?.user.id === item.user_id) return;
    await supabase.rpc("record_promotion_event", {
      target_promotion_id: item.promotion_id,
      event_kind: eventKind,
      browser_session: browserSession,
    });
  } catch (error) {
    console.error("Promotion analytics event failed", error);
  }
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
      } else if (!locationIsActive()) {
        setItem(null);
        return;
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
    if (window.location.pathname !== "/") return;
    let createdNode: HTMLElement | null = null;
    const frame = window.requestAnimationFrame(() => {
      const filter = document.querySelector<HTMLElement>(".filter-row");
      const parent = filter?.parentElement;
      if (!filter || !parent) return;

      let node = parent.querySelector<HTMLElement>("[data-phase9-promo-host]");
      if (!node) {
        node = document.createElement("div");
        node.dataset.phase9PromoHost = "true";
        parent.insertBefore(node, filter);
        createdNode = node;
      }
      setHost(node);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      createdNode?.remove();
      setHost(null);
    };
  }, []);

  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;
    let disposed = false;

    const syncPermission = () => {
      if (disposed) return;
      if (permissionStatus && permissionStatus.state !== "granted") {
        setItem(null);
        return;
      }
      void load();
    };

    const setupPermission = async () => {
      if (!navigator.permissions) {
        if (locationIsActive()) void load();
        return;
      }
      try {
        permissionStatus = await navigator.permissions.query({ name: "geolocation" });
        if (disposed) return;
        permissionStatus.addEventListener("change", syncPermission);
        syncPermission();
      } catch {
        if (locationIsActive()) void load();
      }
    };

    void setupPermission();

    const timer = window.setInterval(() => void load(), 120000);
    const onChange = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches?.(".location-status select")) window.setTimeout(() => void load(), 50);
    };
    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.(".location-status button")) {
        window.setTimeout(() => void load(), 500);
        window.setTimeout(() => void load(), 2000);
      }
    };
    const onPromotionUpdated = () => void load();

    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => setTimeout(() => void load(), 0));
    document.addEventListener("change", onChange);
    document.addEventListener("click", onClick, true);
    window.addEventListener("ping:promotion-updated", onPromotionUpdated);

    return () => {
      disposed = true;
      permissionStatus?.removeEventListener("change", syncPermission);
      window.clearInterval(timer);
      document.removeEventListener("change", onChange);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("ping:promotion-updated", onPromotionUpdated);
      data.subscription.unsubscribe();
    };
  }, [load]);

  useEffect(() => {
    if (!item) return;
    void recordPromotionEvent(item, "impression");
  }, [item?.promotion_id]);

  if (!host || !item) return null;

  const meta = categoryMeta[item.category];
  const distanceMiles = item.distance_meters / 1609.344;
  const openPing = () => {
    void recordPromotionEvent(item, "open");
    window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { id: item.ping_id, live: true } }));
  };

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
      <style jsx global>{`
        .feed-list [data-ping-id="${item.ping_id}"]{display:none}
        .phase9-promoted-card{margin:0 18px 13px;border:1px solid #d8ddcf;border-radius:20px;background:#fffdf5;box-shadow:0 9px 28px rgba(45,43,28,.055);overflow:hidden}.phase9-promoted-main{width:100%;border:0;background:transparent;padding:14px 15px;text-align:left;color:#20251f;cursor:pointer}.phase9-promoted-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.phase9-disclosure{display:flex;align-items:center;gap:7px}.phase9-disclosure strong{border-radius:999px;background:#2f352c;color:#fff;padding:5px 8px;font-size:8px;letter-spacing:.02em}.phase9-disclosure span{font-size:8px;color:#7b806f;font-weight:750}.phase9-category{font-size:9px;font-weight:850;color:#62695f}.phase9-sponsor{margin-top:12px;font-size:9px;font-weight:850;color:#697061}.phase9-promoted-main h2{margin:5px 0 5px;font-size:18px;letter-spacing:-.35px}.phase9-promoted-main>p{margin:0;color:#697168;font-size:10px;line-height:1.45}.phase9-promoted-meta{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:10px;color:#7b8279;font-size:8px}.phase9-promoted-meta b{color:#4e594f}.phase9-promoted-foot{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid #ebeadd}.phase9-promoted-foot span{font-size:7px;color:#929486}.phase9-promoted-foot b{font-size:9px;color:#344236;white-space:nowrap}
      `}</style>
    </section>,
    host,
  );
}
