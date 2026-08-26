"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const RADII: Radius[] = [0.5, 1, 3, 5];
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
    if (RADII.includes(value as Radius)) return value as Radius;
  } catch {}
  return 1;
}

export default function MapPage() {
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState<Radius>(1);
  const [pings, setPings] = useState<MapPing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState("Enable location to see real nearby Pings.");
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => setRadius(readRadius()), []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationBlocked(true);
      setStatus("Location is unavailable on this device.");
      return;
    }

    setLocationBusy(true);
    setLocationBlocked(false);
    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationBusy(false);
        setRefreshKey((value) => value + 1);
      },
      (error) => {
        setLocationBusy(false);
        if (error.code === 1) {
          setLocationBlocked(true);
          setStatus("Location is blocked for Ping in this browser.");
        } else if (error.code === 3) {
          setStatus("Location request timed out. Please try again.");
        } else {
          setStatus("We could not get your location. Please try again.");
        }
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  }, []);

  const chooseRadius = (next: Radius) => {
    setRadius(next);
    setSelectedId(null);
    try { localStorage.setItem("ping-radius", String(next)); } catch {}
  };

  useEffect(() => {
    if (!center) return;
    let cancelled = false;

    const load = async () => {
      setDataBusy(true);
      setStatus("Checking what is happening nearby…");
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
        setSelectedId((current) => current && mapped.some((ping) => ping.id === current) ? current : mapped[0]?.id || null);
        setStatus(mapped.length
          ? `${mapped.length} live Ping${mapped.length === 1 ? "" : "s"} within ${radius} mi`
          : `Quiet within ${radius} mi right now`);
      } catch (error) {
        console.error("Ping map query failed", error);
        if (!cancelled) {
          setPings([]);
          setSelectedId(null);
          setStatus("Live Ping data could not load right now.");
        }
      } finally {
        if (!cancelled) setDataBusy(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [center, radius, refreshKey]);

  useEffect(() => {
    if (!center) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("ping-map-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pings" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setRefreshKey((value) => value + 1), 300);
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [center]);

  const selected = useMemo(() => pings.find((ping) => ping.id === selectedId) || pings[0], [pings, selectedId]);

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="launch-map-screen">
          {center ? (
            <LivePingMap center={center} radiusMiles={radius} pings={pings} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <section className="launch-map-location">
              <div className="launch-map-location-icon">📍</div>
              <h1>See what’s happening around you.</h1>
              <p>{status}</p>
              <small>Your location is used to find nearby Pings. It is not shown as your exact public position.</small>
              <button type="button" onClick={requestLocation} disabled={locationBusy}>
                {locationBusy ? "Finding location…" : locationBlocked ? "Try again" : "Enable location"}
              </button>
            </section>
          )}

          <header className="launch-map-topbar">
            <a href="/" className="launch-map-back" aria-label="Back to Feed">‹</a>
            <div className="launch-map-brand">ping<span>.</span></div>
            <div className="launch-map-actions">
              {center && <button type="button" onClick={requestLocation} disabled={locationBusy} aria-label="Recenter on my location">◎</button>}
              {center && <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={dataBusy} aria-label="Refresh nearby Pings">↻</button>}
            </div>
          </header>

          {center && (
            <section className="launch-map-panel">
              <div><span className={dataBusy ? "busy" : ""} /> <strong>{status}</strong></div>
              <div className="launch-map-radius" aria-label="Nearby radius">
                {RADII.map((option) => <button type="button" key={option} className={radius === option ? "active" : ""} onClick={() => chooseRadius(option)}>{option} mi</button>)}
              </div>
            </section>
          )}

          {center && !dataBusy && pings.length === 0 && (
            <section className="launch-map-quiet">
              <strong>Nothing active nearby.</strong>
              <span>No live Pings inside {radius} mi right now.</span>
              <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Check again</button>
            </section>
          )}

          {selected && (
            <button type="button" className="launch-map-card" onClick={() => window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { ...selected, live: true } }))}>
              <div><span>{selected.emoji} {selected.category}</span><b>{selected.distanceMiles.toFixed(1)} mi away</b></div>
              <h2>{selected.title}</h2>
              <footer><span>✓ {selected.confirmations} confirmed</span><b>View Ping →</b></footer>
            </button>
          )}
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          <a href="/"><span>⌂</span>Feed</a>
          <a href="/map" className="active"><span>⌖</span>Map</a>
          <a href="/#ping" className="compose-nav"><span>+</span>Ping</a>
          <a href="/alerts"><span>♢</span>Alerts</a>
          <a href="/you"><span>○</span>You</a>
        </nav>
      </div>

      <style jsx global>{`
        .launch-map-screen{position:absolute;inset:0 0 82px;overflow:hidden;background:#e9efe8}.launch-map-screen .live-ping-map{position:absolute;inset:0}.launch-map-location{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;text-align:center;padding:30px;color:#183924}.launch-map-location-icon{font-size:40px}.launch-map-location h1{font-size:25px;letter-spacing:-.7px;margin:12px 0 8px}.launch-map-location p{margin:0;color:#53645a}.launch-map-location small{max-width:310px;margin-top:8px;color:#748079;line-height:1.45}.launch-map-location button{margin-top:18px;border:0;border-radius:15px;background:#55d84d;color:#102817;padding:13px 20px;font-weight:900}.launch-map-topbar{position:absolute;z-index:6;top:16px;left:16px;right:16px;display:grid;grid-template-columns:44px 1fr auto;gap:10px;align-items:center;pointer-events:none}.launch-map-back,.launch-map-brand,.launch-map-actions{pointer-events:auto}.launch-map-back{width:42px;height:42px;border-radius:15px;background:rgba(255,255,255,.96);display:grid;place-items:center;text-decoration:none;color:#183924;font-size:28px;box-shadow:0 8px 24px rgba(16,48,26,.14)}.launch-map-brand{justify-self:start;padding:9px 12px;border-radius:15px;background:rgba(255,255,255,.96);font-size:26px;font-weight:950;letter-spacing:-1.2px;box-shadow:0 8px 24px rgba(16,48,26,.14)}.launch-map-brand span{color:#55d84d}.launch-map-actions{display:flex;gap:8px}.launch-map-actions button{width:42px;height:42px;border:0;border-radius:15px;background:rgba(255,255,255,.96);color:#183924;font-size:20px;font-weight:900;box-shadow:0 8px 24px rgba(16,48,26,.14)}.launch-map-panel{position:absolute;z-index:5;top:74px;left:16px;right:16px;background:rgba(255,255,255,.96);border-radius:18px;padding:12px;box-shadow:0 10px 28px rgba(16,48,26,.12)}.launch-map-panel>div:first-child{display:flex;align-items:center;gap:7px;font-size:10px;color:#46614d}.launch-map-panel>div:first-child>span{width:8px;height:8px;border-radius:50%;background:#55d84d}.launch-map-panel>div:first-child>span.busy{animation:pulse 1s infinite}.launch-map-radius{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}.launch-map-radius button{border:0;border-radius:11px;background:#eef3ec;padding:9px 4px;font-size:10px;font-weight:850;color:#617066}.launch-map-radius button.active{background:#dff6da;color:#245229}.launch-map-quiet{position:absolute;z-index:5;left:16px;right:16px;bottom:18px;background:rgba(255,255,255,.96);border-radius:18px;padding:14px;display:grid;gap:4px;box-shadow:0 10px 28px rgba(16,48,26,.12)}.launch-map-quiet strong{font-size:13px}.launch-map-quiet span{font-size:10px;color:#6d796f}.launch-map-quiet button{justify-self:start;margin-top:6px;border:0;background:#eaf4e7;color:#315c36;border-radius:10px;padding:8px 10px;font-weight:850}.launch-map-card{position:absolute;z-index:5;left:16px;right:16px;bottom:18px;border:0;border-radius:20px;background:rgba(255,255,255,.97);padding:15px;text-align:left;color:#172019;box-shadow:0 14px 36px rgba(16,48,26,.18)}.launch-map-card>div,.launch-map-card footer{display:flex;justify-content:space-between;gap:10px;font-size:10px;color:#607066}.launch-map-card h2{font-size:17px;letter-spacing:-.4px;margin:10px 0}.launch-map-card footer b{color:#315c36}.bottom-nav a{height:100%;border:0;background:transparent;color:#8a928b;font-size:10px;font-weight:800;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;position:relative;text-decoration:none}.bottom-nav a>span{font-size:22px;line-height:1}.bottom-nav a.active{color:#1f5420}.bottom-nav a.compose-nav{color:#1f5420}@keyframes pulse{50%{opacity:.35}}
      `}</style>
    </div>
  );
}
