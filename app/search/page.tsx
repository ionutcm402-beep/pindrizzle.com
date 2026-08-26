"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Radius = 0.5 | 1 | 3 | 5;
type CategoryKey = "all" | "alert" | "traffic" | "lost_found" | "free" | "help" | "local";
type SortKey = "best" | "newest" | "closest" | "confirmed";
type Coordinates = { lat: number; lng: number };
type LocationState = "idle" | "requesting" | "granted" | "denied" | "unavailable";

type SearchRow = {
  id: string;
  user_id: string;
  category: Exclude<CategoryKey, "all">;
  title: string;
  body: string;
  place_label: string | null;
  confirmation_count: number;
  comment_count: number;
  created_at: string;
  expires_at: string;
  distance_meters: number;
  search_rank: number;
};

type SearchItem = SearchRow & { mediaUrl?: string };
type PingMediaRow = { ping_id: string; storage_path: string };

const categories: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "✦" },
  { key: "alert", label: "Alerts", emoji: "🚨" },
  { key: "traffic", label: "Traffic", emoji: "🚧" },
  { key: "lost_found", label: "Lost & Found", emoji: "🐕" },
  { key: "free", label: "Free", emoji: "🎁" },
  { key: "help", label: "Help", emoji: "🙋" },
  { key: "local", label: "Local", emoji: "📍" },
];

const categoryLabel = Object.fromEntries(categories.map((item) => [item.key, item])) as Record<CategoryKey, { key: CategoryKey; label: string; emoji: string }>;

function ageLabel(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

async function addSignedMediaUrls(rows: SearchRow[]) {
  if (!rows.length) return rows as SearchItem[];
  const supabase = createClient();
  const media = await supabase.from("ping_media").select("ping_id,storage_path").in("ping_id", rows.map((row) => row.id));
  if (media.error || !media.data?.length) return rows as SearchItem[];
  const mediaRows = media.data as PingMediaRow[];
  const signed = await supabase.storage.from("ping-media").createSignedUrls(mediaRows.map((row) => row.storage_path), 900);
  if (signed.error || !signed.data) return rows as SearchItem[];
  const urls = new Map<string, string>();
  mediaRows.forEach((row, index) => {
    const url = signed.data?.[index]?.signedUrl;
    if (url) urls.set(row.ping_id, url);
  });
  return rows.map((row) => ({ ...row, mediaUrl: urls.get(row.id) }));
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [radius, setRadius] = useState<Radius>(1);
  const [sort, setSort] = useState<SortKey>("best");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("ping-radius"));
      if ([0.5, 1, 3, 5].includes(saved)) setRadius(saved as Radius);
    } catch {}
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 260);
    return () => window.clearTimeout(timer);
  }, [query]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      return;
    }
    setLocationState("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationState("granted");
      },
      (geoError) => setLocationState(geoError.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    void navigator.permissions.query({ name: "geolocation" }).then((permission) => {
      if (permission.state === "granted") requestLocation();
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!coordinates) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: rpcError } = await createClient().rpc("search_nearby_pings", {
          viewer_lat: coordinates.lat,
          viewer_lng: coordinates.lng,
          search_query: debouncedQuery,
          category_filter: category === "all" ? null : category,
          radius_meters: Math.round(radius * 1609.344),
          result_limit: 60,
        });
        if (rpcError) throw rpcError;
        const withMedia = await addSignedMediaUrls((data || []) as SearchRow[]);
        if (!cancelled) setItems(withMedia);
      } catch (loadError) {
        console.error("Search failed", loadError);
        if (!cancelled) {
          setItems([]);
          setError("Nearby search is temporarily unavailable.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [coordinates, debouncedQuery, category, radius, refreshNonce]);

  useEffect(() => {
    if (!coordinates) return;
    const supabase = createClient();
    const channel = supabase
      .channel("phase14-search-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pings" }, () => setRefreshNonce((value) => value + 1))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [coordinates]);

  const sorted = useMemo(() => {
    const next = [...items];
    if (sort === "newest") next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sort === "closest") next.sort((a, b) => a.distance_meters - b.distance_meters);
    if (sort === "confirmed") next.sort((a, b) => b.confirmation_count - a.confirmation_count || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sort === "best" && debouncedQuery) next.sort((a, b) => b.search_rank - a.search_rank || b.confirmation_count - a.confirmation_count);
    return next;
  }, [items, sort, debouncedQuery]);

  const setAndStoreRadius = (next: Radius) => {
    setRadius(next);
    try { localStorage.setItem("ping-radius", String(next)); } catch {}
  };

  const openPing = (item: SearchItem) => {
    const meta = categoryLabel[item.category];
    window.dispatchEvent(new CustomEvent("ping:open-detail", {
      detail: {
        id: item.id,
        title: item.title,
        body: item.body,
        category: meta.label,
        emoji: meta.emoji,
        place: item.place_label || "Nearby",
        distanceMiles: item.distance_meters / 1609.344,
        confirmations: item.confirmation_count,
        live: true,
      },
    }));
  };

  const discoverMode = !debouncedQuery;

  return (
    <div className="search14-page">
      <div className="search14-shell">
        <header className="search14-head">
          <button className="search14-back" type="button" onClick={() => window.location.assign("/")} aria-label="Back to Feed">←</button>
          <div><div className="brand small">ping<span>.</span></div><p>Search & discover</p></div>
          <button className="search14-map" type="button" onClick={() => window.location.assign("/map")} aria-label="Open Map">⌖</button>
        </header>

        <section className="search14-intro">
          <h1>{discoverMode ? "What’s happening nearby?" : "Search your area"}</h1>
          <p>{discoverMode ? "Browse real, active Pings around you. No sample posts and no global feed." : `Showing active matches inside ${radius} ${radius === 1 ? "mile" : "miles"}.`}</p>
        </section>

        <div className="search14-searchbox">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “road closed”, “lost dog”, “free”…" maxLength={120} aria-label="Search nearby Pings" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button>}
        </div>

        <div className="search14-chips" aria-label="Search categories">
          {categories.map((item) => (
            <button key={item.key} type="button" className={category === item.key ? "active" : ""} onClick={() => setCategory(item.key)}>{item.emoji} {item.label}</button>
          ))}
        </div>

        <div className="search14-controls">
          <label><span>Radius</span><select value={radius} onChange={(event) => setAndStoreRadius(Number(event.target.value) as Radius)}><option value={0.5}>0.5 mi</option><option value={1}>1 mi</option><option value={3}>3 mi</option><option value={5}>5 mi</option></select></label>
          <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="best">{debouncedQuery ? "Best match" : "Recommended"}</option><option value="newest">Newest</option><option value="closest">Closest</option><option value="confirmed">Most confirmed</option></select></label>
        </div>

        {locationState !== "granted" && (
          <section className="search14-location">
            <span>📍</span>
            <div><strong>{locationState === "denied" ? "Location is blocked" : "Search starts with your location"}</strong><p>{locationState === "denied" ? "Enable location in your browser settings to search nearby Pings." : "Your exact coordinates are not shown publicly. Search uses the same privacy rules as Feed and Map."}</p></div>
            <button type="button" onClick={requestLocation} disabled={locationState === "requesting"}>{locationState === "requesting" ? "Checking…" : "Use location"}</button>
          </section>
        )}

        {locationState === "granted" && (
          <div className="search14-status"><span>●</span><strong>{loading ? "Searching nearby…" : `${sorted.length} active ${sorted.length === 1 ? "Ping" : "Pings"}`}</strong><small>{debouncedQuery ? `matching “${debouncedQuery}”` : "available to discover"}</small></div>
        )}

        <main className="search14-results">
          {error && <div className="search14-empty"><div>↻</div><h2>Search couldn’t load</h2><p>{error}</p></div>}
          {!error && coordinates && !loading && sorted.length === 0 && <div className="search14-empty"><div>⌕</div><h2>{debouncedQuery ? "No nearby matches" : "Quiet around here"}</h2><p>{debouncedQuery ? "Try fewer words, another category, or a wider radius." : "There are no active Pings in this area right now."}</p></div>}
          {!error && sorted.map((item) => {
            const meta = categoryLabel[item.category];
            return (
              <article key={item.id} className="search14-card" onClick={() => openPing(item)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") openPing(item); }}>
                <div className="search14-cardtop"><span>{meta.emoji} {meta.label}</span><b>{ageLabel(item.created_at)}</b></div>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
                {item.mediaUrl && <img src={item.mediaUrl} alt={`Photo attached to ${item.title}`} loading="lazy" />}
                <div className="search14-meta"><span>📍 {(item.distance_meters / 1609.344).toFixed(1)} mi away</span><span>✓ {item.confirmation_count} confirmed</span><span>💬 {item.comment_count}</span></div>
              </article>
            );
          })}
        </main>
      </div>
      <style jsx global>{`
        .search14-page{min-height:100vh;background:#eceee8;display:flex;justify-content:center;padding:24px}.search14-shell{width:min(100%,430px);min-height:calc(100vh - 48px);background:#f8f8f3;border:1px solid rgba(21,24,21,.08);border-radius:34px;overflow:hidden;box-shadow:0 24px 70px rgba(26,35,27,.14);padding-bottom:28px}.search14-head{display:grid;grid-template-columns:46px 1fr 46px;gap:10px;align-items:center;padding:22px 18px 12px}.search14-head>div{text-align:center}.search14-head p{margin:7px 0 0;color:#7a837b;font-size:10px;font-weight:800}.search14-back,.search14-map{width:42px;height:42px;border:0;border-radius:15px;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-weight:900;font-size:20px;color:#354238}.search14-intro{padding:13px 20px 9px}.search14-intro h1{font-size:29px;line-height:1.05;letter-spacing:-1px;margin:0 0 8px}.search14-intro p{margin:0;color:#69736b;font-size:12px;line-height:1.5}.search14-searchbox{margin:13px 16px 11px;background:#fff;border:1px solid #dde4da;border-radius:18px;height:54px;display:grid;grid-template-columns:38px 1fr 38px;align-items:center;padding:0 8px;box-shadow:0 7px 20px rgba(28,36,29,.05)}.search14-searchbox>span{font-size:21px;color:#607064;text-align:center}.search14-searchbox input{border:0;outline:0;background:transparent;width:100%;font-size:14px;color:#172019}.search14-searchbox button{border:0;background:#eef2eb;border-radius:50%;width:28px;height:28px;font-size:18px;color:#687269}.search14-chips{display:flex;gap:7px;overflow:auto;padding:0 16px 12px;scrollbar-width:none}.search14-chips::-webkit-scrollbar{display:none}.search14-chips button{flex:0 0 auto;border:1px solid #dfe5dc;background:#fff;border-radius:999px;padding:9px 12px;color:#5c665e;font-size:10px;font-weight:850}.search14-chips button.active{background:#1b2a1e;color:#fff;border-color:#1b2a1e}.search14-controls{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:0 16px 13px}.search14-controls label{background:#edf2e9;border-radius:15px;padding:9px 10px;display:grid;grid-template-columns:1fr auto;align-items:center}.search14-controls span{font-size:9px;color:#728075;font-weight:900;text-transform:uppercase;letter-spacing:.5px}.search14-controls select{border:0;background:transparent;color:#263b2b;font-size:10px;font-weight:850;outline:0}.search14-location{margin:0 16px 13px;padding:14px;border-radius:19px;background:#fff8e8;border:1px solid #f0dfb3;display:grid;grid-template-columns:auto 1fr;gap:10px}.search14-location>span{font-size:23px}.search14-location strong{font-size:12px}.search14-location p{margin:4px 0 10px;color:#73796f;font-size:10px;line-height:1.45}.search14-location button{grid-column:2;border:0;background:#1c2a1e;color:#fff;border-radius:11px;padding:9px 12px;font-size:10px;font-weight:850;justify-self:start}.search14-status{margin:0 16px 12px;padding:10px 12px;border-radius:14px;background:#eef8eb;display:flex;align-items:center;gap:7px;color:#37623b}.search14-status>span{color:#55d84d}.search14-status strong{font-size:11px}.search14-status small{font-size:9px;color:#708072;margin-left:auto;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.search14-results{display:grid;gap:11px;padding:0 14px}.search14-card{background:#fff;border:1px solid #e4e9e1;border-radius:22px;padding:16px;box-shadow:0 8px 22px rgba(28,36,29,.055);cursor:pointer}.search14-cardtop{display:flex;justify-content:space-between;align-items:center}.search14-cardtop span{background:#f2f5ef;border-radius:999px;padding:7px 9px;font-size:9px;font-weight:900;color:#4d5a50}.search14-cardtop b{color:#8a928b;font-size:9px}.search14-card h2{font-size:18px;line-height:1.2;margin:12px 0 7px;letter-spacing:-.35px}.search14-card>p{font-size:12px;line-height:1.5;color:#626c64;margin:0 0 11px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.search14-card>img{width:100%;max-height:220px;object-fit:cover;border-radius:15px;margin:1px 0 11px;background:#edf0ea}.search14-meta{display:flex;flex-wrap:wrap;gap:8px 12px;padding-top:10px;border-top:1px solid #edf0ea;color:#78827a;font-size:9px;font-weight:750}.search14-empty{text-align:center;background:#fff;border:1px dashed #dce4d9;border-radius:22px;padding:30px 24px}.search14-empty>div{font-size:28px}.search14-empty h2{font-size:17px;margin:8px 0 5px}.search14-empty p{font-size:11px;color:#747e76;line-height:1.5;margin:0}@media(max-width:520px){.search14-page{padding:0}.search14-shell{width:100%;min-height:100vh;border:0;border-radius:0}.search14-intro h1{font-size:27px}}
      `}</style>
    </div>
  );
}
