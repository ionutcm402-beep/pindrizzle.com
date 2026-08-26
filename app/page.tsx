"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = "Alert" | "Traffic" | "Lost & Found" | "Free" | "Help" | "Local";
type Radius = 0.5 | 1 | 3 | 5;
type LocationState = "idle" | "requesting" | "granted" | "denied" | "unavailable";
type Coordinates = { lat: number; lng: number };
type DataMode = "idle" | "loading" | "live" | "quiet" | "offline";

type PingItem = {
  id: string;
  category: Category;
  emoji: string;
  title: string;
  body: string;
  distanceMiles: number;
  ageMinutes: number;
  confirmations: number;
  place: string;
  tone: "urgent" | "warm" | "neutral" | "helpful";
  createdByMe?: boolean;
  live: true;
};

type NearbyRow = {
  id: string;
  user_id: string;
  category: "alert" | "traffic" | "lost_found" | "free" | "help" | "local";
  title: string;
  body: string;
  place_label: string | null;
  confirmation_count: number;
  created_at: string;
  distance_meters: number;
};

const categoryMeta: Record<Category, { emoji: string; tone: PingItem["tone"] }> = {
  Alert: { emoji: "🚨", tone: "urgent" },
  Traffic: { emoji: "🚧", tone: "urgent" },
  "Lost & Found": { emoji: "🐕", tone: "warm" },
  Free: { emoji: "🎁", tone: "helpful" },
  Help: { emoji: "🙋", tone: "helpful" },
  Local: { emoji: "📍", tone: "neutral" },
};

const databaseCategory: Record<NearbyRow["category"], Category> = {
  alert: "Alert",
  traffic: "Traffic",
  lost_found: "Lost & Found",
  free: "Free",
  help: "Help",
  local: "Local",
};

const toDatabaseCategory: Record<Category, NearbyRow["category"]> = {
  Alert: "alert",
  Traffic: "traffic",
  "Lost & Found": "lost_found",
  Free: "free",
  Help: "help",
  Local: "local",
};

const filters = ["All", "Alerts", "Traffic", "Lost & Found", "Free", "Help"] as const;

function ageLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h`;
}

function minutesSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
}

function mapNearbyRow(row: NearbyRow, currentUserId: string | null): PingItem {
  const category = databaseCategory[row.category];
  const meta = categoryMeta[category];
  return {
    id: row.id,
    category,
    emoji: meta.emoji,
    title: row.title,
    body: row.body,
    distanceMiles: row.distance_meters / 1609.344,
    ageMinutes: minutesSince(row.created_at),
    confirmations: row.confirmation_count,
    place: row.place_label || "Nearby",
    tone: meta.tone,
    createdByMe: currentUserId === row.user_id,
    live: true,
  };
}

function FeedCard({ ping, onConfirm, onOpen }: { ping: PingItem; onConfirm: (id: string) => void; onOpen: (ping: PingItem) => void }) {
  const sharePing = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const url = `${window.location.origin}/#ping=${encodeURIComponent(ping.id)}`;
    const text = `${ping.title} — ${ping.distanceMiles.toFixed(1)} mi away`;
    try {
      if (navigator.share) await navigator.share({ title: ping.title, text, url });
      else await navigator.clipboard.writeText(`${text}\n${url}`);
    } catch {}
  };

  return (
    <article
      className={`ping-card tone-${ping.tone}`}
      data-ping-id={ping.id}
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer" }}
      onClick={() => onOpen(ping)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(ping);
        }
      }}
    >
      <div className="ping-card-topline">
        <div className="category-badge"><span>{ping.emoji}</span>{ping.category}</div>
        <span className="mine-badge">{ping.createdByMe ? "Your Ping" : "Live"}</span>
      </div>
      <h2>{ping.title}</h2>
      <p className="ping-body">{ping.body}</p>
      <div className="ping-place">📍 {ping.place}</div>
      <div className="ping-meta">
        <span><strong>{ping.distanceMiles.toFixed(1)} mi</strong> away</span>
        <span>{ageLabel(ping.ageMinutes)} ago</span>
      </div>
      <div className="ping-actions">
        <button onClick={(event) => { event.stopPropagation(); onConfirm(ping.id); }}>✓ {ping.confirmations} confirmed</button>
        <button onClick={(event) => { event.stopPropagation(); onOpen(ping); }}>💬 Reply</button>
        <button onClick={sharePing}>↗ Share</button>
      </div>
    </article>
  );
}

function RadiusSelect({ radius, onRadius }: { radius: Radius; onRadius: (radius: Radius) => void }) {
  return (
    <select value={radius} onChange={(event) => onRadius(Number(event.target.value) as Radius)} aria-label="Nearby radius">
      <option value={0.5}>0.5 mi</option>
      <option value={1}>1 mi</option>
      <option value={3}>3 mi</option>
      <option value={5}>5 mi</option>
    </select>
  );
}

function LocationBanner({ state, radius, dataMode, onRequest, onRadius }: { state: LocationState; radius: Radius; dataMode: DataMode; onRequest: () => void; onRadius: (radius: Radius) => void }) {
  if (state === "granted") {
    const detail = dataMode === "loading"
      ? "Checking your area…"
      : dataMode === "live"
        ? "Connected to live community data."
        : dataMode === "quiet"
          ? "No active Pings inside your radius right now."
          : dataMode === "offline"
            ? "Live data is temporarily unavailable."
            : "Location is ready.";
    return (
      <div className="location-status good">
        <span>●</span>
        <div><strong>Location active</strong><small>{detail}</small></div>
        <RadiusSelect radius={radius} onRadius={onRadius} />
      </div>
    );
  }

  return (
    <div className="location-status">
      <span>📍</span>
      <div>
        <strong>{state === "denied" ? "Location blocked" : "Use your real location"}</strong>
        <small>{state === "denied" ? "Enable location in your browser to see nearby Pings." : "Ping uses your location to show real activity around you."}</small>
      </div>
      <button onClick={onRequest} disabled={state === "requesting"}>{state === "requesting" ? "Checking…" : "Enable"}</button>
      <RadiusSelect radius={radius} onRadius={onRadius} />
    </div>
  );
}

function FeedView({ pings, radius, locationState, dataMode, onRequestLocation, onRadius, onConfirm, onOpen }: { pings: PingItem[]; radius: Radius; locationState: LocationState; dataMode: DataMode; onRequestLocation: () => void; onRadius: (radius: Radius) => void; onConfirm: (id: string) => void; onOpen: (ping: PingItem) => void }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const visible = useMemo(() => pings.filter((ping) => {
    if (ping.distanceMiles > radius) return false;
    if (filter === "All") return true;
    if (filter === "Alerts") return ping.category === "Alert" || ping.category === "Traffic";
    return ping.category === filter;
  }), [filter, pings, radius]);

  const emptyTitle = locationState !== "granted"
    ? "Enable location to see your real local feed."
    : dataMode === "offline"
      ? "We couldn’t load nearby Pings."
      : "Quiet around here.";
  const emptyCopy = locationState !== "granted"
    ? "Ping does not show sample activity. Once location is enabled, this feed contains only real nearby Pings."
    : dataMode === "offline"
      ? "Your location is active, but live community data is temporarily unavailable."
      : "Nothing active has been reported in this category inside your current radius.";

  return (
    <>
      <header className="app-header">
        <div>
          <div className="brand">ping<span>.</span></div>
          <div className="location-pill">● Your mile</div>
        </div>
      </header>
      <section className="hero-strip"><div><span className="live-dot" /><strong>{visible.length} active nearby</strong></div><p>What matters around you, right now.</p></section>
      <LocationBanner state={locationState} radius={radius} dataMode={dataMode} onRequest={onRequestLocation} onRadius={onRadius} />
      <div className="filter-row" aria-label="Feed filters">{filters.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <main className="feed-list">
        {visible.length
          ? visible.map((ping) => <FeedCard key={ping.id} ping={ping} onConfirm={onConfirm} onOpen={onOpen} />)
          : <div className="quiet-card"><div className="quiet-icon">{locationState === "granted" ? "✓" : "📍"}</div><h2>{emptyTitle}</h2><p>{emptyCopy}</p></div>}
      </main>
    </>
  );
}

function Composer({ onClose, onPublish }: { onClose: () => void; onPublish: (draft: { category: Category; title: string; body: string }) => void | Promise<void> }) {
  const [category, setCategory] = useState<Category>("Alert");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const canPublish = title.trim().length >= 4 && body.trim().length >= 6;

  return (
    <div className="composer-backdrop" role="dialog" aria-modal="true" aria-label="Create a Ping">
      <div className="composer-sheet">
        <div className="sheet-handle" />
        <div className="composer-header"><button onClick={onClose}>Cancel</button><strong>New Ping</strong><span /></div>
        <h2>What’s happening?</h2>
        <div className="category-grid">{(Object.keys(categoryMeta) as Category[]).map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{categoryMeta[item].emoji} {item}</button>)}</div>
        <label className="composer-label">Short headline</label>
        <input className="composer-input" placeholder="What should neighbours know?" maxLength={70} value={title} onChange={(event) => setTitle(event.target.value)} />
        <label className="composer-label">Useful detail</label>
        <textarea placeholder="Keep it clear and useful…" maxLength={280} value={body} onChange={(event) => setBody(event.target.value)} />
        <div className="expiry-note">📍 Posted near your current location · exact coordinates are not shown publicly.</div>
        <div className="expiry-note">⏱ This Ping will disappear automatically after 24 hours.</div>
        <button className="publish-button" disabled={!canPublish} onClick={() => canPublish && onPublish({ category, title: title.trim(), body: body.trim() })}>Ping it</button>
      </div>
    </div>
  );
}

function requestAuth(message: string) {
  window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message } }));
}

export default function Home() {
  const [composerOpen, setComposerOpen] = useState(false);
  const [pendingCompose, setPendingCompose] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [pings, setPings] = useState<PingItem[]>([]);
  const [radius, setRadius] = useState<Radius>(1);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [dataMode, setDataMode] = useState<DataMode>("idle");
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    try {
      const storedRadius = localStorage.getItem("ping-radius");
      if (storedRadius && [0.5, 1, 3, 5].includes(Number(storedRadius))) setRadius(Number(storedRadius) as Radius);
    } catch {}
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id || null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id || null);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!coordinates) return;
    let cancelled = false;
    const loadNearby = async () => {
      setDataMode("loading");
      try {
        const { data, error } = await createClient().rpc("nearby_pings", {
          viewer_lat: coordinates.lat,
          viewer_lng: coordinates.lng,
          radius_meters: Math.round(radius * 1609.344),
          result_limit: 50,
        });
        if (cancelled) return;
        if (error) throw error;
        const live = ((data || []) as NearbyRow[]).map((row) => mapNearbyRow(row, userId));
        setPings(live);
        setDataMode(live.length ? "live" : "quiet");
      } catch {
        if (!cancelled) {
          setPings([]);
          setDataMode("offline");
        }
      }
    };
    void loadNearby();
    return () => { cancelled = true; };
  }, [coordinates, radius, refreshNonce, userId]);

  useEffect(() => {
    if (!coordinates) return;
    const supabase = createClient();
    const channel = supabase
      .channel("ping-feed-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pings" }, () => setRefreshNonce((value) => value + 1))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [coordinates]);

  const setAndStoreRadius = (next: Radius) => {
    setRadius(next);
    try { localStorage.setItem("ping-radius", String(next)); } catch {}
  };

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
      (error) => setLocationState(error.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const beginCompose = () => {
    setPendingCompose(true);
    if (!authReady) return;
    if (!userId) {
      requestAuth("Sign in once to post Pings that your neighbours can see.");
      return;
    }
    if (locationState !== "granted" || !coordinates) requestLocation();
  };

  useEffect(() => {
    if (!authReady || window.location.hash !== "#ping") return;
    window.history.replaceState({}, "", "/");
    beginCompose();
  }, [authReady]);

  useEffect(() => {
    if (!pendingCompose || !userId) return;
    if (locationState === "idle" || locationState === "unavailable") {
      requestLocation();
      return;
    }
    if (locationState === "granted" && coordinates) {
      setComposerOpen(true);
      setPendingCompose(false);
    }
  }, [pendingCompose, userId, locationState, coordinates]);

  const confirmPing = async (id: string) => {
    if (!userId) {
      requestAuth("Sign in to confirm real Pings near you.");
      return;
    }
    try {
      const { data, error } = await createClient().rpc("confirm_ping", { target_ping_id: id });
      if (error) throw error;
      setPings((current) => current.map((ping) => ping.id === id ? { ...ping, confirmations: Number(data) } : ping));
    } catch {}
  };

  const publishPing = async (draft: { category: Category; title: string; body: string }) => {
    if (!userId) {
      setComposerOpen(false);
      requestAuth("Sign in to publish this Ping.");
      return;
    }
    if (!coordinates) {
      setComposerOpen(false);
      setPendingCompose(true);
      requestLocation();
      return;
    }
    try {
      const { error } = await createClient().rpc("create_ping", {
        ping_category: toDatabaseCategory[draft.category],
        ping_title: draft.title,
        ping_body: draft.body,
        ping_lat: coordinates.lat,
        ping_lng: coordinates.lng,
        ping_place_label: "Near your current location",
        ping_precision: "approximate",
      });
      if (error) throw error;
      setComposerOpen(false);
      setRefreshNonce((value) => value + 1);
    } catch {
      window.alert("Ping couldn’t publish yet. Please try again.");
    }
  };

  const openPingDetail = (ping: PingItem) => {
    window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: ping }));
  };

  return (
    <div className="page-shell">
      <div className="app-shell">
        <div className="screen-content">
          <FeedView pings={pings} radius={radius} locationState={locationState} dataMode={dataMode} onRequestLocation={requestLocation} onRadius={setAndStoreRadius} onConfirm={confirmPing} onOpen={openPingDetail} />
        </div>
        <nav className="bottom-nav" aria-label="Primary navigation">
          <button className="active"><span>⌂</span>Feed</button>
          <button onClick={() => window.location.assign("/map")}><span>⌖</span>Map</button>
          <button className="compose-nav" onClick={beginCompose} aria-label="Create a Ping"><span>+</span>Ping</button>
          <button onClick={() => window.location.assign("/alerts")}><span>♢</span>Alerts</button>
          <button onClick={() => window.location.assign("/you")}><span>○</span>You</button>
        </nav>
      </div>
      {composerOpen && <Composer onClose={() => { setComposerOpen(false); setPendingCompose(false); }} onPublish={publishPing} />}
    </div>
  );
}
