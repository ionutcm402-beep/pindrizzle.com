"use client";

import { useEffect, useMemo, useState } from "react";
import PingIcon from "@/components/PingIcon";
import { CATEGORY_DEFINITIONS, type PingCategoryKey, type Radius } from "@/lib/ping-categories";
import { readPingRadius, writePingRadius } from "@/lib/ping-local-preferences";
import { getPingLocationSilently, requestPingLocation, type PingCoordinates, type PingLocationState } from "@/lib/ping-location";
import { createClient } from "@/lib/supabase/client";
import { resolvePlaceLabel, type PlaceLabel } from "@/lib/place";

type NearbyRow = {
  id: string;
  category: PingCategoryKey;
  title: string;
  created_at: string;
  distance_meters: number;
  confirmation_count: number;
};

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
  const [coordinates, setCoordinates] = useState<PingCoordinates | null>(null);
  const [place, setPlace] = useState<PlaceLabel>({ label: "Your area" });
  const [rows, setRows] = useState<NearbyRow[]>([]);
  const [locationState, setLocationState] = useState<PingLocationState>("checking");

  useEffect(() => {
    setRadius(readPingRadius());
    let cancelled = false;
    void getPingLocationSilently().then((result) => {
      if (cancelled) return;
      setLocationState(result.state);
      if (result.coordinates) setCoordinates(result.coordinates);
    });
    return () => { cancelled = true; };
  }, []);

  const askForLocation = async () => {
    setLocationState("requesting");
    const result = await requestPingLocation();
    setLocationState(result.state);
    if (result.coordinates) setCoordinates(result.coordinates);
  };

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
      if (!nearby.error) setRows((nearby.data || []) as NearbyRow[]);
    };
    void load();
    return () => { cancelled = true; };
  }, [coordinates, radius]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<PingCategoryKey, number>();
    rows.forEach((row) => counts.set(row.category, (counts.get(row.category) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const newest = useMemo(() => rows.reduce<NearbyRow | null>((current, row) => {
    if (!current) return row;
    return new Date(row.created_at).getTime() > new Date(current.created_at).getTime() ? row : current;
  }, null), [rows]);

  const confirmations = useMemo(() => rows.reduce((sum, row) => sum + Number(row.confirmation_count || 0), 0), [rows]);

  const changeRadius = (next: Radius) => {
    setRadius(next);
    writePingRadius(next);
  };

  const locationReady = Boolean(coordinates);

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="place15-screen">
          <header className="place15-head">
            <a href="/" aria-label="Back to Feed"><PingIcon name="back" size={18}/></a>
            <div><div className="brand small">pindrizzle</div><p>Local area</p></div>
            <a href="/map" aria-label="Open Map"><PingIcon name="map" size={18}/></a>
          </header>

          <section className="place15-hero">
            <span>Approximate area</span>
            <h1>{place.label}</h1>
            <p>Pindrizzle uses neighbourhood-scale context here. The exact device location is not published.</p>
          </section>

          {!locationReady && (
            <section className="place15-location pd-moment">
              <span className="place15-location-icon"><PingIcon name="location" size={26}/></span>
              <h2>{locationState === "denied" ? "Location is blocked" : "See what your area looks like right now"}</h2>
              <p>{locationState === "denied" ? "Enable location in your device or browser settings, then try again." : "Use your location to calculate a privacy-safe neighbourhood snapshot."}</p>
              <button type="button" className="pd-button-primary" onClick={() => void askForLocation()} disabled={locationState === "requesting" || locationState === "checking"}>{locationState === "requesting" || locationState === "checking" ? "Checking…" : "Use my location"}</button>
            </section>
          )}

          {locationReady && (
            <>
              <section className="place15-toolbar">
                <label><span>Snapshot radius</span><select value={radius} onChange={(event) => changeRadius(Number(event.target.value) as Radius)}><option value={0.5}>0.5 mi</option><option value={1}>1 mi</option><option value={3}>3 mi</option><option value={5}>5 mi</option></select></label>
              </section>

              <section className="place15-stats" aria-label="Local snapshot totals">
                <div><strong>{rows.length}</strong><span>active pins</span></div>
                <div><strong>{confirmations}</strong><span>confirmations</span></div>
                <div><strong>{categoryCounts.length}</strong><span>categories</span></div>
              </section>

              <section className="place15-card">
                <div className="place15-cardhead"><div><span>Live mix</span><h2>What is active nearby</h2></div><b>{radius} mi</b></div>
                {categoryCounts.length ? (
                  <div className="place15-mix">
                    {categoryCounts.map(([category, count]) => {
                      const item = CATEGORY_DEFINITIONS[category];
                      const width = Math.max(12, Math.round((count / rows.length) * 100));
                      return <div key={category} className="place15-mix-row"><div><span><i><PingIcon name={item.icon} size={15}/></i>{item.label}</span><strong>{count}</strong></div><em><b style={{ width: `${width}%` }} /></em></div>;
                    })}
                  </div>
                ) : <p className="place15-quiet">No active pins inside this radius right now.</p>}
              </section>

              <section className="place15-card">
                <span className="place15-eyebrow">Freshest activity</span>
                <h2>{newest?.title || "Quiet around here"}</h2>
                <p>{newest ? `${CATEGORY_DEFINITIONS[newest.category].label} · ${(newest.distance_meters / 1609.344).toFixed(1)} mi away · ${age(newest.created_at)}` : "There is no current local activity to highlight."}</p>
                <div className="place15-links"><a className="pd-button-secondary" href="/search">Explore nearby</a><a className="pd-button-primary" href="/map">Open map</a></div>
              </section>
            </>
          )}

          {place.attribution && <a className="place15-credit pd-button-tertiary" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Place names © OpenStreetMap contributors</a>}
        </main>
      </div>

      <style jsx global>{`
        .place15-screen{min-height:100%;padding:0 var(--pd-space-3) calc(96px + env(safe-area-inset-bottom));color:var(--pd-text)}
        .place15-head{display:grid;grid-template-columns:44px 1fr 44px;gap:var(--pd-space-2);align-items:center;padding:var(--pd-space-3) 0}.place15-head>div{text-align:center}.place15-head p{margin:var(--pd-space-1) 0 0;color:var(--pd-muted);font-size:9px}.place15-head>a{width:44px;height:44px;display:grid;place-items:center;border:1px solid var(--pd-line);border-radius:var(--pd-radius-pill);background:rgba(255,255,255,.82);color:var(--pd-ink-800);text-decoration:none}
        .place15-hero{padding:var(--pd-space-4) 0 var(--pd-space-3);text-align:left}.place15-hero>span,.place15-eyebrow{color:#0c7187;font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.place15-hero h1{margin:var(--pd-space-1) 0 var(--pd-space-2);color:var(--pd-ink-950);font-size:30px;line-height:1.05;letter-spacing:-.045em}.place15-hero p{max-width:360px;margin:0;color:var(--pd-text-2);font-size:11px;line-height:1.5}
        .place15-location{border:1px solid var(--pd-line);border-radius:var(--pd-radius-card);background:rgba(255,255,255,.94);box-shadow:var(--pd-elevation-1)}.place15-location-icon{width:56px;height:56px;display:grid;place-items:center;border-radius:18px;background:var(--pd-aqua-100);color:#0c7187}.place15-location h2{margin:0;color:var(--pd-ink-950);font-size:20px}.place15-location p{margin:0;max-width:320px;color:var(--pd-muted);font-size:11px;line-height:1.5}
        .place15-toolbar{margin-bottom:var(--pd-space-3);padding:var(--pd-space-2);border-radius:var(--pd-radius-card);background:var(--pd-silver-100)}.place15-toolbar label{min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:var(--pd-space-2);padding:0 var(--pd-space-2)}.place15-toolbar label>span{color:var(--pd-muted);font-size:9px;font-weight:780}.place15-toolbar select{min-height:36px;border:0!important;background:transparent!important;color:var(--pd-ink-800);font-size:10px;font-weight:760}
        .place15-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--pd-space-2);margin-bottom:var(--pd-space-3)}.place15-stats>div,.place15-card{border:1px solid var(--pd-line);border-radius:var(--pd-radius-card);background:rgba(255,255,255,.94);box-shadow:var(--pd-elevation-1)}.place15-stats>div{padding:var(--pd-space-3) var(--pd-space-2);text-align:center}.place15-stats strong{display:block;color:var(--pd-ink-950);font-size:20px}.place15-stats span{display:block;margin-top:var(--pd-space-1);color:var(--pd-muted);font-size:8px}
        .place15-card{padding:var(--pd-space-3);margin-bottom:var(--pd-space-3)}.place15-cardhead{display:flex;justify-content:space-between;gap:var(--pd-space-2);align-items:flex-start}.place15-cardhead span{color:#0c7187;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}.place15-card h2,.place15-cardhead h2{margin:var(--pd-space-1) 0 var(--pd-space-2);color:var(--pd-ink-950);font-size:17px;line-height:1.2}.place15-cardhead>b{padding:var(--pd-space-1) var(--pd-space-2);border-radius:var(--pd-radius-pill);background:var(--pd-aqua-100);color:#0c7187;font-size:8px}.place15-card>p{margin:0;color:var(--pd-muted);font-size:10px;line-height:1.5}
        .place15-mix{display:grid;gap:var(--pd-space-2);margin-top:var(--pd-space-3)}.place15-mix-row>div{display:flex;align-items:center;justify-content:space-between;gap:var(--pd-space-2)}.place15-mix-row>div>span{display:inline-flex;align-items:center;gap:var(--pd-space-2);color:var(--pd-text-2);font-size:9px;font-weight:740}.place15-mix-row i{width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:var(--pd-aqua-100);color:var(--pd-ink-800);font-style:normal}.place15-mix-row strong{font-size:9px}.place15-mix-row em{display:block;height:5px;margin-top:var(--pd-space-1);overflow:hidden;border-radius:var(--pd-radius-pill);background:var(--pd-silver-200);font-style:normal}.place15-mix-row em b{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--pd-blue-600),var(--pd-aqua-500))}.place15-quiet{color:var(--pd-muted)!important}
        .place15-links{display:flex;gap:var(--pd-space-2);margin-top:var(--pd-space-3);flex-wrap:wrap}.place15-credit{margin:0 auto var(--pd-space-3);font-size:8px!important}
      `}</style>
    </div>
  );
}
