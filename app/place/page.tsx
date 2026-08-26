"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolvePlaceLabel, type PlaceLabel } from "@/lib/place";

type Radius = 0.5 | 1 | 3 | 5;
type Coordinates = { lat: number; lng: number };
type NearbyRow = {
  id: string;
  category: "alert" | "traffic" | "lost_found" | "free" | "help" | "local";
  title: string;
  created_at: string;
  distance_meters: number;
  confirmation_count: number;
};

const meta = {
  alert: { label: "Alerts", emoji: "🚨" },
  traffic: { label: "Traffic", emoji: "🚧" },
  lost_found: { label: "Lost & Found", emoji: "🐕" },
  free: { label: "Free", emoji: "🎁" },
  help: { label: "Help", emoji: "🙋" },
  local: { label: "Local", emoji: "📍" },
} as const;

function age(value?: string) {
  if (!value) return "No recent activity";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

export default function PlacePage() {
  const [radius, setRadius] = useState<Radius>(1);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [place, setPlace] = useState<PlaceLabel>({ label: "Your area" });
  const [rows, setRows] = useState<NearbyRow[]>([]);
  const [state, setState] = useState<"idle" | "requesting" | "ready" | "denied" | "error">("idle");

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("ping-radius"));
      if ([0.5, 1, 3, 5].includes(saved)) setRadius(saved as Radius);
      const cached = localStorage.getItem("ping-place-label");
      if (cached) setPlace({ label: cached });
    } catch {}
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setState("error");
      return;
    }
    setState("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
        setState("ready");
      },
      (error) => setState(error.code === 1 ? "denied" : "error"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  useEffect(() => {
    if (navigator.permissions?.query) {
      void navigator.permissions.query({ name: "geolocation" }).then((permission) => {
        if (permission.state === "granted") requestLocation();
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!coordinates) return;
    let cancelled = false;
    const load = async () => {
      const [resolved, nearby] = await Promise.all([
        resolvePlaceLabel(coordinates.lat, coordinates.lng),
        createClient().rpc("search_nearby_pings", {
          viewer_lat: coordinates.lat,
          viewer_lng: coordinates.lng,
          search_query: "",
          category_filter: null,
          radius_meters: Math.round(radius * 1609.344),
          result_limit: 100,
        }),
      ]);
      if (cancelled) return;
      setPlace(resolved);
      try { localStorage.setItem("ping-place-label", resolved.label); } catch {}
      if (!nearby.error) setRows((nearby.data || []) as NearbyRow[]);
    };
    void load();
    return () => { cancelled = true; };
  }, [coordinates, radius]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<NearbyRow["category"], number>();
    rows.forEach((row) => counts.set(row.category, (counts.get(row.category) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const newest = useMemo(() => rows.reduce<NearbyRow | null>((current, row) => {
    if (!current) return row;
    return new Date(row.created_at).getTime() > new Date(current.created_at).getTime() ? row : current;
  }, null), [rows]);

  const confirmations = useMemo(() => rows.reduce((sum, row) => sum + Number(row.confirmation_count || 0), 0), [rows]);

  return (
    <div className="place15-page">
      <main className="place15-shell">
        <header className="place15-head">
          <button type="button" onClick={() => window.location.assign("/")} aria-label="Back to Feed">←</button>
          <div><div className="brand small">ping<span>.</span></div><p>Local area</p></div>
          <button type="button" onClick={() => window.location.assign("/map")} aria-label="Open Map">⌖</button>
        </header>

        <section className="place15-hero">
          <span>Approximate area</span>
          <h1>{place.label}</h1>
          <p>Ping uses a coarse neighbourhood-scale location for public place context. Exact coordinates are not shown.</p>
        </section>

        {state !== "ready" && !coordinates && (
          <section className="place15-location">
            <div>📍</div>
            <strong>{state === "denied" ? "Location is blocked" : "See what your area looks like right now"}</strong>
            <p>{state === "denied" ? "Enable location in your browser settings to load this local snapshot." : "Use your location to calculate a privacy-safe neighbourhood snapshot."}</p>
            <button type="button" onClick={requestLocation} disabled={state === "requesting"}>{state === "requesting" ? "Checking…" : "Use my location"}</button>
          </section>
        )}

        {coordinates && (
          <>
            <div className="place15-radius"><span>Snapshot radius</span><select value={radius} onChange={(event) => { const next = Number(event.target.value) as Radius; setRadius(next); try { localStorage.setItem("ping-radius", String(next)); } catch {} }}><option value={0.5}>0.5 mi</option><option value={1}>1 mi</option><option value={3}>3 mi</option><option value={5}>5 mi</option></select></div>

            <section className="place15-stats">
              <div><strong>{rows.length}</strong><span>active Pings</span></div>
              <div><strong>{confirmations}</strong><span>confirmations</span></div>
              <div><strong>{categoryCounts.length}</strong><span>active categories</span></div>
            </section>

            <section className="place15-card">
              <div className="place15-cardhead"><div><span>Live mix</span><h2>What neighbours are talking about</h2></div><b>{radius} mi</b></div>
              {categoryCounts.length ? (
                <div className="place15-mix">
                  {categoryCounts.map(([category, count]) => {
                    const item = meta[category];
                    const width = Math.max(12, Math.round((count / rows.length) * 100));
                    return <div key={category}><div><span>{item.emoji} {item.label}</span><strong>{count}</strong></div><i><b style={{ width: `${width}%` }} /></i></div>;
                  })}
                </div>
              ) : <p className="place15-quiet">No active Pings inside this radius right now.</p>}
            </section>

            <section className="place15-card">
              <span className="place15-eyebrow">Freshest activity</span>
              <h2>{newest?.title || "Quiet around here"}</h2>
              <p>{newest ? `${meta[newest.category].emoji} ${meta[newest.category].label} · ${(newest.distance_meters / 1609.344).toFixed(1)} mi away · ${age(newest.created_at)}` : "There is no current local activity to highlight."}</p>
              <div className="place15-links"><button type="button" onClick={() => window.location.assign("/search")}>Explore nearby</button><button type="button" onClick={() => window.location.assign("/map")}>Open map</button></div>
            </section>
          </>
        )}

        {place.attribution && <a className="place15-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Place names © OpenStreetMap contributors</a>}
      </main>
      <style jsx global>{`
        .place15-page{min-height:100vh;background:#eceee8;display:flex;justify-content:center;padding:24px}.place15-shell{width:min(100%,430px);min-height:calc(100vh - 48px);background:#f8f8f3;border:1px solid rgba(21,24,21,.08);border-radius:34px;box-shadow:0 24px 70px rgba(26,35,27,.14);padding-bottom:28px;overflow:hidden}.place15-head{display:grid;grid-template-columns:46px 1fr 46px;align-items:center;gap:10px;padding:22px 18px 12px}.place15-head>div{text-align:center}.place15-head p{margin:6px 0 0;font-size:10px;color:#778178;font-weight:800}.place15-head button{width:42px;height:42px;border:0;border-radius:15px;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:20px;font-weight:900;color:#354238}.place15-hero{margin:8px 16px 13px;padding:21px;background:linear-gradient(135deg,#17251a,#2b3e2e);border-radius:23px;color:#fff}.place15-hero>span,.place15-eyebrow{font-size:9px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;color:#8ee588}.place15-hero h1{font-size:29px;line-height:1.05;letter-spacing:-1px;margin:8px 0}.place15-hero p{font-size:11px;line-height:1.5;color:#cdd7ce;margin:0}.place15-location,.place15-card{margin:0 16px 12px;background:#fff;border:1px solid #e3e8e0;border-radius:21px;padding:17px}.place15-location>div{font-size:25px}.place15-location strong{display:block;margin:8px 0 4px}.place15-location p,.place15-card p{font-size:11px;line-height:1.5;color:#707a72}.place15-location button,.place15-links button{border:0;background:#1d2b20;color:#fff;border-radius:12px;padding:10px 12px;font-size:10px;font-weight:850}.place15-radius{margin:0 16px 12px;padding:11px 13px;border-radius:15px;background:#edf2e9;display:flex;justify-content:space-between;align-items:center}.place15-radius span{font-size:9px;text-transform:uppercase;letter-spacing:.5px;font-weight:900;color:#6d796e}.place15-radius select{border:0;background:transparent;font-size:10px;font-weight:850;color:#263b2b}.place15-stats{margin:0 16px 12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.place15-stats div{background:#eef4eb;border-radius:18px;padding:14px 8px;text-align:center}.place15-stats strong{display:block;font-size:20px}.place15-stats span{font-size:8px;color:#6d786f}.place15-cardhead{display:flex;justify-content:space-between;gap:8px}.place15-cardhead span{font-size:9px;text-transform:uppercase;color:#748078;font-weight:900}.place15-card h2{font-size:18px;line-height:1.2;margin:5px 0}.place15-cardhead>b{font-size:9px;background:#edf5ea;color:#426447;border-radius:999px;padding:7px 9px;height:max-content}.place15-mix{display:grid;gap:12px;margin-top:15px}.place15-mix>div>div{display:flex;justify-content:space-between;font-size:10px;font-weight:800}.place15-mix i{display:block;margin-top:6px;height:6px;background:#edf0ea;border-radius:999px;overflow:hidden}.place15-mix i b{display:block;height:100%;background:#5bd753;border-radius:999px}.place15-quiet{margin-bottom:0}.place15-links{display:flex;gap:8px;margin-top:12px}.place15-links button:last-child{background:#eef3eb;color:#335039}.place15-credit{display:block;text-align:center;margin:16px;color:#747d75;font-size:8px}@media(max-width:520px){.place15-page{padding:0}.place15-shell{width:100%;min-height:100vh;border:0;border-radius:0}}
      `}</style>
    </div>
  );
}
