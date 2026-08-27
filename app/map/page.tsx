"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LivePingMap, { type MapPing, type MapPingCategory } from "@/components/LivePingMap";
import PingIcon, { type PingIconName } from "@/components/PingIcon";
import { createClient } from "@/lib/supabase/client";
import { getPingLocationSilently, requestPingLocation, type PingCoordinates, type PingLocationState } from "@/lib/ping-location";

type Radius = 0.5 | 1 | 3 | 5;
type MapRow = {
  id: string;
  category: MapPingCategory;
  title: string;
  confirmation_count: number;
  distance_meters: number;
  map_lat: number;
  map_lng: number;
};

type Filter = "all" | MapPingCategory;

const RADII: Radius[] = [0.5, 1, 3, 5];
const categories: Array<{ value: Filter; label: string; icon?: PingIconName }> = [
  { value: "all", label: "All" },
  { value: "alert", label: "Alert", icon: "alert" },
  { value: "traffic", label: "Traffic", icon: "traffic" },
  { value: "lost_found", label: "Lost & Found", icon: "lostFound" },
  { value: "free", label: "Free", icon: "free" },
  { value: "help", label: "Help", icon: "help" },
  { value: "local", label: "Local", icon: "local" },
];

const categoryMeta: Record<MapPingCategory, { label: string; icon: PingIconName }> = {
  alert: { label: "Alert", icon: "alert" },
  traffic: { label: "Traffic", icon: "traffic" },
  lost_found: { label: "Lost & Found", icon: "lostFound" },
  free: { label: "Free", icon: "free" },
  help: { label: "Help", icon: "help" },
  local: { label: "Local", icon: "local" },
};

function readRadius(): Radius {
  try {
    const value = Number(localStorage.getItem("ping-radius") || 1);
    if (RADII.includes(value as Radius)) return value as Radius;
  } catch {}
  return 1;
}

export default function MapPage() {
  const [center, setCenter] = useState<PingCoordinates | null>(null);
  const [locationState, setLocationState] = useState<PingLocationState>("checking");
  const [radius, setRadius] = useState<Radius>(1);
  const [allPings, setAllPings] = useState<MapPing[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState("Checking location…");
  const [dataBusy, setDataBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setRadius(readRadius());
    let cancelled = false;
    void getPingLocationSilently().then((result) => {
      if (cancelled) return;
      setLocationState(result.state);
      if (result.coordinates) setCenter(result.coordinates);
      else setStatus(result.state === "denied" ? "Location is blocked for Ping." : "Turn on location once to use Feed and Map.");
    });
    const handleLocation = (event: Event) => {
      const detail = (event as CustomEvent<PingCoordinates>).detail;
      if (!detail) return;
      setCenter(detail);
      setLocationState("granted");
      setRefreshKey((value) => value + 1);
    };
    window.addEventListener("ping:location-changed", handleLocation);
    return () => { cancelled = true; window.removeEventListener("ping:location-changed", handleLocation); };
  }, []);

  const requestLocation = useCallback(async () => {
    setLocationState("requesting");
    setStatus("Finding your location…");
    const result = await requestPingLocation();
    setLocationState(result.state);
    if (result.coordinates) {
      setCenter(result.coordinates);
      setRefreshKey((value) => value + 1);
    } else if (result.state === "denied") {
      setStatus("Location is blocked. Allow it for Ping in your browser settings, then try again.");
    } else {
      setStatus("We could not get your location right now.");
    }
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
      setStatus("Checking nearby Pings…");
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
          title: row.title,
          categoryKey: row.category,
          category: categoryMeta[row.category].label,
          distanceMiles: row.distance_meters / 1609.344,
          confirmations: row.confirmation_count,
        }));
        setAllPings(mapped);
        setStatus(mapped.length ? `${mapped.length} live nearby` : `Quiet within ${radius} mi`);
      } catch (error) {
        console.error("Ping map query failed", error);
        if (!cancelled) {
          setAllPings([]);
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
    const channel = supabase.channel("ping-map-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pings" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setRefreshKey((value) => value + 1), 300);
      })
      .subscribe();
    return () => { if (timer) clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [center]);

  const pings = useMemo(() => filter === "all" ? allPings : allPings.filter((ping) => ping.categoryKey === filter), [allPings, filter]);

  useEffect(() => {
    setSelectedId((current) => current && pings.some((ping) => ping.id === current) ? current : pings[0]?.id || null);
  }, [pings]);

  const selectedIndex = useMemo(() => Math.max(0, pings.findIndex((ping) => ping.id === selectedId)), [pings, selectedId]);
  const selected = pings[selectedIndex] || null;
  const selectedMeta = selected ? categoryMeta[selected.categoryKey] : null;

  const stepSelected = (direction: -1 | 1) => {
    if (!pings.length) return;
    const next = (selectedIndex + direction + pings.length) % pings.length;
    setSelectedId(pings[next].id);
  };

  const openSelected = () => {
    if (!selected) return;
    window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { ...selected, live: true } }));
  };

  const needsLocation = !center && locationState !== "checking" && locationState !== "requesting";

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="map-v2-screen launch-map-screen">
          {center ? (
            <LivePingMap center={center} radiusMiles={radius} pings={pings} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <section className="map-v2-location">
              <span><PingIcon name="location" size={27} /></span>
              <h1>Your local map</h1>
              <p>{status}</p>
              <small>One location permission powers both Feed and Map. Ping never publishes your exact browser coordinates.</small>
              {needsLocation && <button type="button" onClick={() => void requestLocation()}>Enable location</button>}
              {(locationState === "checking" || locationState === "requesting") && <div className="map-v2-checking">Checking location…</div>}
            </section>
          )}

          <header className="map-v2-topbar">
            <a href="/" aria-label="Back to Feed"><PingIcon name="chevron" size={18} className="map-v2-back-icon" /></a>
            <div><div className="brand small">ping<span>.</span></div><strong>Map</strong></div>
            <div className="map-v2-top-actions">
              {center && <button type="button" onClick={() => void requestLocation()} aria-label="Recenter on my location"><PingIcon name="location" size={17} /></button>}
              {center && <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={dataBusy} aria-label="Refresh nearby Pings">↻</button>}
            </div>
          </header>

          {center && (
            <section className="map-v2-controls">
              <div className="map-v2-status"><span className={dataBusy ? "busy" : ""} /><strong>{status}</strong><b>{radius} mi</b></div>
              <div className="map-v2-radii" aria-label="Nearby radius">{RADII.map((option) => <button type="button" key={option} className={radius === option ? "active" : ""} onClick={() => chooseRadius(option)}>{option}</button>)}</div>
              <div className="map-v2-categories" aria-label="Map categories">{categories.map((item) => <button type="button" key={item.value} className={filter === item.value ? "active" : ""} onClick={() => setFilter(item.value)}>{item.icon && <PingIcon name={item.icon} size={13} />}{item.label}</button>)}</div>
            </section>
          )}

          {center && !dataBusy && pings.length === 0 && (
            <section className="map-v2-quiet"><strong>Nothing active here.</strong><span>No {filter === "all" ? "live Pings" : categoryMeta[filter].label + " Pings"} inside {radius} mi right now.</span><button type="button" onClick={() => setFilter("all")}>Show all categories</button></section>
          )}

          {selected && selectedMeta && (
            <section className="map-v2-card" aria-label="Selected Ping">
              <button type="button" className="map-v2-card-main" onClick={openSelected}>
                <div className="map-v2-card-top"><span><i><PingIcon name={selectedMeta.icon} size={16} /></i>{selected.category}</span><b>{selected.distanceMiles.toFixed(1)} mi away</b></div>
                <h2>{selected.title}</h2>
                <footer><span><PingIcon name="confirmations" size={14} />{selected.confirmations} confirmed</span><strong>Open Ping →</strong></footer>
              </button>
              {pings.length > 1 && <div className="map-v2-card-pager"><button type="button" onClick={() => stepSelected(-1)} aria-label="Previous nearby Ping">‹</button><span>{selectedIndex + 1} of {pings.length}</span><button type="button" onClick={() => stepSelected(1)} aria-label="Next nearby Ping">›</button></div>}
            </section>
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
        .map-v2-screen{position:absolute;inset:0 0 82px;overflow:hidden;background:#e8ece6}.map-v2-screen .live-ping-map{position:absolute;inset:0}.map-v2-location{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;padding:34px;text-align:center;color:var(--ping-ink)}.map-v2-location>span{width:58px;height:58px;display:grid;place-items:center;border-radius:19px;background:#fff;color:var(--ping-blue);border:1px solid var(--ping-line)}.map-v2-location h1{margin:15px 0 6px;font-size:25px;letter-spacing:-.8px}.map-v2-location p{margin:0;color:var(--ping-ink-2);font-size:12px}.map-v2-location small{max-width:320px;margin-top:8px;color:var(--ping-muted);font-size:10px;line-height:1.5}.map-v2-location button{margin-top:17px;min-height:40px;border:0;border-radius:12px;background:var(--ping-ink);color:#fff;padding:0 16px;font-size:10px;font-weight:780}.map-v2-checking{margin-top:15px;color:var(--ping-muted);font-size:10px;font-weight:700}
        .map-v2-topbar{position:absolute;z-index:8;top:14px;left:14px;right:14px;display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;pointer-events:none}.map-v2-topbar>a,.map-v2-topbar>div{pointer-events:auto}.map-v2-topbar>a{width:40px;height:40px;display:grid;place-items:center;border:1px solid var(--ping-line);border-radius:14px;background:rgba(255,255,255,.95);color:var(--ping-ink);text-decoration:none;box-shadow:0 8px 22px rgba(16,25,18,.08)}.map-v2-back-icon{transform:rotate(180deg)}.map-v2-topbar>div:nth-child(2){display:flex;align-items:baseline;gap:8px;padding:7px 10px;border:1px solid var(--ping-line);border-radius:14px;background:rgba(255,255,255,.95);width:max-content;box-shadow:0 8px 22px rgba(16,25,18,.08)}.map-v2-topbar>div:nth-child(2)>strong{font-size:10px;color:var(--ping-muted)}.map-v2-top-actions{display:flex;gap:7px}.map-v2-top-actions button{width:40px;height:40px;display:grid;place-items:center;border:1px solid var(--ping-line);border-radius:14px;background:rgba(255,255,255,.95);color:var(--ping-ink-2);font-size:17px;box-shadow:0 8px 22px rgba(16,25,18,.08)}
        .map-v2-controls{position:absolute;z-index:7;top:70px;left:14px;right:14px;padding:10px;border:1px solid rgba(16,19,17,.08);border-radius:18px;background:rgba(255,255,255,.94);box-shadow:0 9px 26px rgba(16,25,18,.08);backdrop-filter:blur(14px)}.map-v2-status{display:flex;align-items:center;gap:7px;color:var(--ping-ink-2);font-size:9px}.map-v2-status>span{width:7px;height:7px;border-radius:50%;background:var(--ping-accent)}.map-v2-status>span.busy{animation:mapV2Pulse 1s infinite}.map-v2-status strong{flex:1}.map-v2-status b{color:var(--ping-muted);font-weight:700}.map-v2-radii{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:8px}.map-v2-radii button{height:30px;border:0;border-radius:9px;background:var(--ping-surface-soft);color:var(--ping-muted);font-size:9px;font-weight:750}.map-v2-radii button.active{background:var(--ping-ink);color:#fff}.map-v2-categories{display:flex;gap:6px;margin-top:8px;overflow-x:auto;scrollbar-width:none}.map-v2-categories::-webkit-scrollbar{display:none}.map-v2-categories button{height:30px;display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;padding:0 9px;border:1px solid var(--ping-line);border-radius:999px;background:#fff;color:var(--ping-muted);font-size:8.5px;font-weight:700}.map-v2-categories button.active{border-color:var(--ping-ink);background:var(--ping-ink);color:#fff}
        .map-v2-quiet{position:absolute;z-index:6;left:14px;right:14px;bottom:78px;padding:13px 14px;border:1px solid var(--ping-line);border-radius:17px;background:rgba(255,255,255,.96);box-shadow:0 10px 26px rgba(16,25,18,.09);display:grid;gap:4px}.map-v2-quiet strong{font-size:12px}.map-v2-quiet span{color:var(--ping-muted);font-size:9px}.map-v2-quiet button{justify-self:start;margin-top:5px;border:0;background:transparent;color:var(--ping-accent-ink);padding:0;font-size:9px;font-weight:760}
        .map-v2-card{position:absolute;z-index:7;left:14px;right:14px;bottom:78px;border:1px solid var(--ping-line);border-radius:19px;background:rgba(255,255,255,.97);box-shadow:0 13px 34px rgba(16,25,18,.12);overflow:hidden}.map-v2-card-main{width:100%;padding:13px 14px;border:0;background:transparent;color:var(--ping-ink);text-align:left}.map-v2-card-top,.map-v2-card-main footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.map-v2-card-top>span{display:inline-flex;align-items:center;gap:7px;color:var(--ping-ink-2);font-size:9px;font-weight:750}.map-v2-card-top i{width:28px;height:28px;display:grid;place-items:center;border-radius:9px;background:var(--ping-surface-soft);font-style:normal}.map-v2-card-top>b{color:var(--ping-muted);font-size:8.5px}.map-v2-card h2{margin:9px 0 10px;font-size:16px;line-height:1.2;letter-spacing:-.35px}.map-v2-card-main footer{color:var(--ping-muted);font-size:8.5px}.map-v2-card-main footer>span{display:inline-flex;align-items:center;gap:5px}.map-v2-card-main footer strong{color:var(--ping-accent-ink);font-size:9px}.map-v2-card-pager{height:34px;display:grid;grid-template-columns:34px 1fr 34px;align-items:center;border-top:1px solid var(--ping-line);background:var(--ping-surface-soft)}.map-v2-card-pager button{height:34px;border:0;background:transparent;color:var(--ping-ink-2);font-size:20px}.map-v2-card-pager span{text-align:center;color:var(--ping-muted);font-size:8px;font-weight:720}@keyframes mapV2Pulse{50%{opacity:.3}}
        @media(max-width:350px){.map-v2-controls{left:10px;right:10px}.map-v2-card{left:10px;right:10px}.map-v2-card h2{font-size:15px}}
      `}</style>
    </div>
  );
}
