"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import LivePingMap, { type MapPing } from "@/components/LivePingMap";
import { createClient } from "@/lib/supabase/client";

type Radius = 0.5 | 1 | 3 | 5;
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

function readRadius(): Radius {
  try {
    const value = Number(localStorage.getItem("ping-radius") || 1);
    if ([0.5, 1, 3, 5].includes(value)) return value as Radius;
  } catch {}
  return 1;
}

export default function Phase4MapRoute() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState<Radius>(1);
  const [pings, setPings] = useState<MapPing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState("Open Map to see what is nearby.");

  useEffect(() => {
    const findHost = () => setHost(document.querySelector<HTMLElement>(".app-shell"));
    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleNav = (event: MouseEvent) => {
      const element = event.target as HTMLElement | null;
      const button = element?.closest<HTMLButtonElement>(".bottom-nav button");
      if (!button) return;
      const buttons = Array.from(button.parentElement?.querySelectorAll<HTMLButtonElement>(":scope > button") || []);
      const index = buttons.indexOf(button);
      if (index === 1) {
        setOpen(true);
        setRadius(readRadius());
      } else {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleNav, true);
    return () => document.removeEventListener("click", handleNav, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setRadius(readRadius());

    if (!navigator.geolocation) {
      setStatus("Location is unavailable on this device.");
      return;
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
  }, [open]);

  useEffect(() => {
    if (!open || !center) return;
    let cancelled = false;

    const load = async () => {
      setStatus("Loading live Pings near you…");
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
      } catch (error) {
        console.error("Ping live map query failed", error);
        if (!cancelled) setStatus("Live Ping data could not load. The map itself should still work.");
      }
    };

    load();
    return () => { cancelled = true; };
  }, [open, center, radius]);

  const selected = useMemo(() => pings.find((ping) => ping.id === selectedId) || pings[0], [pings, selectedId]);

  if (!host || !open) return null;

  return createPortal(
    <section className="phase4-map-route" aria-label="Live nearby map">
      {center ? (
        <LivePingMap center={center} radiusMiles={radius} pings={pings} selectedId={selectedId} onSelect={setSelectedId} />
      ) : (
        <div className="phase4-route-loading">
          <span>📍</span>
          <strong>{status}</strong>
          <small>Map is public. Sign-in is only needed to post or confirm.</small>
        </div>
      )}

      <div className="phase4-route-header">
        <div>
          <div className="phase4-route-brand">ping<span>.</span></div>
          <div className="phase4-route-status">● {status}</div>
        </div>
        <div className="phase4-radius-pill">{radius} mi</div>
      </div>

      {selected && (
        <div className="phase4-route-card">
          <div className="phase4-route-card-top">
            <span>{selected.emoji} {selected.category}</span>
            <b>{selected.distanceMiles.toFixed(1)} mi away</b>
          </div>
          <h2>{selected.title}</h2>
          <p>✓ {selected.confirmations} confirmed</p>
        </div>
      )}

      <style jsx global>{`
        .phase4-map-route {
          position:absolute;
          inset:0 0 82px 0;
          z-index:15;
          overflow:hidden;
          background:#e9efe8;
          border-radius:34px 34px 0 0;
        }
        .phase4-map-route .live-ping-map { z-index:1; }
        .phase4-route-loading {
          position:absolute;
          inset:0;
          z-index:1;
          display:grid;
          place-content:center;
          gap:10px;
          padding:28px;
          text-align:center;
          color:#183924;
          background:#e9efe8;
        }
        .phase4-route-loading span { font-size:38px; }
        .phase4-route-loading small { color:#647168; max-width:280px; line-height:1.45; }
        .phase4-route-header {
          position:absolute;
          z-index:4;
          top:18px;
          left:18px;
          right:18px;
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          pointer-events:none;
        }
        .phase4-route-brand {
          display:inline-block;
          padding:9px 12px;
          border-radius:14px;
          background:rgba(255,255,255,.95);
          color:#17251c;
          font-size:27px;
          line-height:1;
          font-weight:900;
          letter-spacing:-1.3px;
          box-shadow:0 8px 24px rgba(16,48,26,.12);
        }
        .phase4-route-brand span { color:#55d84d; }
        .phase4-route-status {
          margin-top:8px;
          padding:8px 11px;
          border-radius:999px;
          background:rgba(255,255,255,.94);
          color:#173723;
          font-size:11px;
          font-weight:800;
          box-shadow:0 8px 24px rgba(16,48,26,.10);
        }
        .phase4-radius-pill {
          padding:9px 12px;
          border-radius:999px;
          background:#173723;
          color:#fff;
          font-size:12px;
          font-weight:900;
        }
        .phase4-route-card {
          position:absolute;
          z-index:4;
          left:16px;
          right:16px;
          bottom:16px;
          padding:16px 18px;
          border-radius:22px;
          background:rgba(255,255,255,.97);
          box-shadow:0 18px 45px rgba(16,48,26,.20);
          color:#17251c;
        }
        .phase4-route-card-top { display:flex; justify-content:space-between; gap:12px; font-size:12px; }
        .phase4-route-card-top span { font-weight:900; }
        .phase4-route-card-top b { color:#607066; }
        .phase4-route-card h2 { margin:8px 0 4px; font-size:19px; line-height:1.15; }
        .phase4-route-card p { margin:0; color:#617068; font-size:12px; font-weight:700; }
        @media(max-width:520px) {
          .phase4-map-route { border-radius:0; }
        }
      `}</style>
    </section>,
    host,
  );
}
