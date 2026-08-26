"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import LivePingMap, { type MapPing } from "@/components/LivePingMap";
import { createClient } from "@/lib/supabase/client";

type MapRow = {
  id: string;
  category: "alert" | "traffic" | "lost_found" | "free" | "help" | "local";
  title: string;
  confirmation_count: number;
  distance_meters: number;
  map_lat: number;
  map_lng: number;
};

const meta: Record<MapRow["category"], { label: string; emoji: string }> = {
  alert: { label: "Alert", emoji: "🚨" },
  traffic: { label: "Traffic", emoji: "🚧" },
  lost_found: { label: "Lost & Found", emoji: "🐕" },
  free: { label: "Free", emoji: "🎁" },
  help: { label: "Help", emoji: "🙋" },
  local: { label: "Local", emoji: "📍" },
};

export default function Phase4MapEnhancer() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(1);
  const [pings, setPings] = useState<MapPing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState("Finding your location…");

  useEffect(() => {
    const findTarget = () => {
      const next = document.querySelector<HTMLElement>(".map-canvas");
      setTarget((current) => current === next ? current : next);
    };
    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!target) return;
    const mapView = target.closest(".map-view");
    mapView?.classList.add("phase4-live");
    try {
      const stored = Number(localStorage.getItem("ping-radius") || 1);
      if ([0.5, 1, 3, 5].includes(stored)) setRadius(stored);
    } catch {}

    if (!navigator.geolocation) {
      setStatus("Location is unavailable on this device.");
      return () => mapView?.classList.remove("phase4-live");
    }

    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus("Loading live Pings near you…");
      },
      () => setStatus("Enable location to see the real nearby map."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );

    return () => mapView?.classList.remove("phase4-live");
  }, [target]);

  useEffect(() => {
    if (!target || !center) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await createClient().rpc("nearby_map_pings", {
          viewer_lat: center.lat,
          viewer_lng: center.lng,
          radius_meters: Math.round(radius * 1609.344),
          result_limit: 100,
        });
        if (error) throw error;
        if (cancelled) return;
        const mapped = ((data || []) as MapRow[]).map((row) => ({
          id: row.id,
          lat: row.map_lat,
          lng: row.map_lng,
          emoji: meta[row.category].emoji,
          title: row.title,
          category: meta[row.category].label,
          distanceMiles: row.distance_meters / 1609.344,
          confirmations: row.confirmation_count,
        }));
        setPings(mapped);
        setSelectedId(mapped[0]?.id || null);
        setStatus(mapped.length ? `${mapped.length} live Ping${mapped.length === 1 ? "" : "s"} inside ${radius} mi` : `No live Pings inside ${radius} mi yet`);
      } catch {
        if (!cancelled) setStatus("Live map data is temporarily unavailable.");
      }
    };
    load();
    return () => { cancelled = true; };
  }, [target, center, radius]);

  const selected = useMemo(() => pings.find((ping) => ping.id === selectedId) || pings[0], [pings, selectedId]);

  if (!target) return null;

  return createPortal(
    <div className="phase4-map-layer">
      {center ? (
        <LivePingMap center={center} radiusMiles={radius} pings={pings} selectedId={selectedId} onSelect={setSelectedId} />
      ) : (
        <div className="phase4-map-loading"><span>📍</span><strong>{status}</strong></div>
      )}
      <div className="phase4-map-status">● {status}</div>
      {selected && (
        <div className="phase4-map-card">
          <div className="phase4-map-card-top"><span>{selected.emoji} {selected.category}</span><b>{selected.distanceMiles.toFixed(1)} mi away</b></div>
          <h2>{selected.title}</h2>
          <p>✓ {selected.confirmations} confirmed</p>
        </div>
      )}
      <style jsx global>{`
        .map-view.phase4-live .map-bottom-card { display:none !important; }
        .phase4-map-layer { position:absolute; inset:0; z-index:20; overflow:hidden; border-radius:28px; }
        .phase4-map-loading { position:absolute; inset:0; display:grid; place-content:center; gap:10px; text-align:center; background:#e9efe8; color:#183924; }
        .phase4-map-loading span { font-size:32px; }
        .phase4-map-status { position:absolute; z-index:25; top:16px; left:16px; max-width:70%; padding:9px 12px; border-radius:999px; background:rgba(255,255,255,.94); color:#173723; font-size:12px; font-weight:800; box-shadow:0 8px 24px rgba(16,48,26,.12); }
        .phase4-map-card { position:absolute; z-index:25; left:16px; right:16px; bottom:18px; padding:16px 18px; border-radius:22px; background:rgba(255,255,255,.96); box-shadow:0 18px 45px rgba(16,48,26,.2); color:#17251c; }
        .phase4-map-card-top { display:flex; justify-content:space-between; gap:12px; align-items:center; font-size:12px; }
        .phase4-map-card-top span { font-weight:800; }
        .phase4-map-card-top b { color:#607066; font-weight:700; }
        .phase4-map-card h2 { margin:8px 0 4px; font-size:19px; line-height:1.15; }
        .phase4-map-card p { margin:0; color:#617068; font-size:12px; font-weight:700; }
        .phase4-map-layer .live-ping-map { z-index:20; }
      `}</style>
    </div>,
    target,
  );
}
