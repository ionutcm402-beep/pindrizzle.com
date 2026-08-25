"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Tab = "feed" | "map" | "alerts" | "you";
type Category = "Alert" | "Traffic" | "Lost & Found" | "Free" | "Help" | "Local";
type Radius = 0.5 | 1 | 3 | 5;
type LocationState = "idle" | "requesting" | "granted" | "denied" | "unavailable";
type Coordinates = { lat: number; lng: number };
type DataMode = "demo" | "loading" | "live" | "offline";

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
  live?: boolean;
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

const seedPings: PingItem[] = [
  { id: "seed-1", category: "Traffic", emoji: "🚧", title: "One lane blocked near the roundabout", body: "A delivery van has stopped across the left lane. Traffic is moving, but slowly.", distanceMiles: 0.2, ageMinutes: 4, confirmations: 8, place: "Three Bridges", tone: "urgent" },
  { id: "seed-2", category: "Lost & Found", emoji: "🐕", title: "Has anyone seen Milo?", body: "Small brown spaniel, red collar. Last seen near the park entrance about 20 minutes ago.", distanceMiles: 0.5, ageMinutes: 18, confirmations: 3, place: "Maidenbower Park", tone: "warm" },
  { id: "seed-3", category: "Free", emoji: "🎁", title: "Free toddler bike — collection today", body: "Still works well, just outgrown. Happy for it to go to someone nearby who can use it.", distanceMiles: 0.7, ageMinutes: 31, confirmations: 5, place: "Worth Road", tone: "helpful" },
  { id: "seed-4", category: "Local", emoji: "☕", title: "Quiet tables available right now", body: "The café by the station is unusually quiet if anyone needs somewhere to work for an hour.", distanceMiles: 0.4, ageMinutes: 42, confirmations: 2, place: "Three Bridges Station", tone: "neutral" },
  { id: "seed-5", category: "Help", emoji: "🙋", title: "Anyone got a jump lead nearby?", body: "Battery is flat outside the parade of shops. I only need a quick jump if someone is close.", distanceMiles: 0.9, ageMinutes: 11, confirmations: 1, place: "Maidenbower", tone: "helpful" },
];

const filters = ["All", "Alerts", "Traffic", "Lost & Found", "Free", "Help"] as const;

function ageLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
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

function FeedCard({ ping, onConfirm }: { ping: PingItem; onConfirm: (id: string) => void }) {
  return (
    <article className={`ping-card tone-${ping.tone}`}>
      <div className="ping-card-topline">
        <div className="category-badge"><span>{ping.emoji}</span>{ping.category}</div>
        {ping.createdByMe ? <span className="mine-badge">Your Ping</span> : ping.live ? <span className="mine-badge">Live</span> : <button className="icon-button" aria-label="More options">•••</button>}
      </div>
      <h2>{ping.title}</h2>
      <p className="ping-body">{ping.body}</p>
      <div className="ping-place">📍 {ping.place}</div>
      <div className="ping-meta">
        <span><strong>{ping.distanceMiles.toFixed(1)} mi</strong> away</span>
        <span>{ageLabel(ping.ageMinutes)} ago</span>
      </div>
      <div className="ping-actions">
        <button onClick={() => onConfirm(ping.id)}>✓ {ping.confirmations} confirmed</button>
        <button>💬 Reply</button>
        <button>↗ Share</button>
      </div>
    </article>
  );
}

function RadiusSelect({ radius, onRadius }: { radius: Radius; onRadius: (r: Radius) => void }) {
  return (
    <select value={radius} onChange={(e) => onRadius(Number(e.target.value) as Radius)} aria-label="Nearby radius">
      <option value={0.5}>0.5 mi</option>
      <option value={1}>1 mi</option>
      <option value={3}>3 mi</option>
      <option value={5}>5 mi</option>
    </select>
  );
}

function LocationBanner({ state, radius, dataMode, onRequest, onRadius }: { state: LocationState; radius: Radius; dataMode: DataMode; onRequest: () => void; onRadius: (r: Radius) => void }) {
  if (state === "granted") {
    const detail = dataMode === "loading" ? "Checking your area…" : dataMode === "live" ? "Connected to live community data." : dataMode === "offline" ? "Live data unavailable — showing safe preview data." : "No live Pings yet — showing useful preview data.";
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
      <div><strong>{state === "denied" ? "Location blocked" : "Use your real location"}</strong><small>{state === "denied" ? "Enable location in your browser to unlock true nearby results." : "Ping works best when it knows what is actually near you."}</small></div>
      <button onClick={onRequest} disabled={state === "requesting"}>{state === "requesting" ? "Checking…" : "Enable"}</button>
      <RadiusSelect radius={radius} onRadius={onRadius} />
    </div>
  );
}

function FeedView({ pings, radius, locationState, dataMode, onRequestLocation, onRadius, onConfirm }: { pings: PingItem[]; radius: Radius; locationState: LocationState; dataMode: DataMode; onRequestLocation: () => void; onRadius: (r: Radius) => void; onConfirm: (id: string) => void }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const visible = useMemo(() => pings.filter((p) => {
    if (p.distanceMiles > radius) return false;
    if (filter === "All") return true;
    if (filter === "Alerts") return p.category === "Alert" || p.category === "Traffic";
    return p.category === filter;
  }), [filter, pings, radius]);

  return (
    <>
      <header className="app-header">
        <div><div className="brand">ping<span>.</span></div><button className="location-pill">● Your mile · Three Bridges <span>⌄</span></button></div>
        <button className="round-action" aria-label="Search">⌕</button>
      </header>
      <section className="hero-strip"><div><span className="live-dot" /><strong>{visible.length} active nearby</strong></div><p>What matters around you, right now.</p></section>
      <LocationBanner state={locationState} radius={radius} dataMode={dataMode} onRequest={onRequestLocation} onRadius={onRadius} />
      <div className="filter-row" aria-label="Feed filters">{filters.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <main className="feed-list">{visible.length ? visible.map((ping) => <FeedCard key={ping.id} ping={ping} onConfirm={onConfirm} />) : <div className="quiet-card"><div className="quiet-icon">☀️</div><h2>Quiet around here.</h2><p>Nothing important has been reported in this category inside your current radius. That’s usually good news.</p></div>}</main>
    </>
  );
}

function MapView({ pings, selectedId, onSelect }: { pings: PingItem[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const selected = pings.find((p) => p.id === selectedId) ?? pings[0];
  return (
    <div className="map-view">
      <header className="floating-map-header"><div><div className="brand small">ping<span>.</span></div><div className="map-location">Your mile</div></div><button className="round-action">⌕</button></header>
      <div className="map-canvas" aria-label="Interactive map preview"><div className="road road-one" /><div className="road road-two" /><div className="road road-three" /><div className="park">PARK</div><div className="radius-ring" /><div className="you-dot"><span>YOU</span></div>
        {pings.slice(0, 5).map((p, index) => <button key={p.id} className={`map-pin pin-${index + 1} ${selected?.id === p.id ? "selected" : ""}`} onClick={() => onSelect(p.id)} aria-label={p.title}>{p.emoji}</button>)}
      </div>
      {selected && <div className="map-bottom-card"><div className="category-badge"><span>{selected.emoji}</span>{selected.category}</div><h2>{selected.title}</h2><p><strong>{selected.distanceMiles.toFixed(1)} mi</strong> away · {ageLabel(selected.ageMinutes)} ago · {selected.confirmations} confirmed</p></div>}
    </div>
  );
}

function AlertsView({ myPingCount }: { myPingCount: number }) {
  return <div className="simple-screen"><header className="simple-header"><div><div className="brand small">ping<span>.</span></div><h1>Alerts</h1></div></header><div className="notice-card important"><span>🚨</span><div><strong>Traffic nearby</strong><p>One lane blocked 0.2 miles away · 4 min ago</p></div></div>{myPingCount > 0 && <div className="notice-card"><span>📍</span><div><strong>Your Ping is live</strong><p>People inside your radius can now see it.</p></div></div>}<div className="notice-card"><span>✓</span><div><strong>Your neighbourhood helped</strong><p>A lost pet Ping you followed was marked resolved.</p></div></div><div className="notification-rule"><strong>Useful notifications only.</strong><p>Ping won’t send “we miss you” messages. Alerts are reserved for things that actually matter near you.</p></div></div>;
}

function YouView({ radius, locationState, dataMode, userEmail, onRadius, onRequestLocation, onSignIn, onSignOut }: { radius: Radius; locationState: LocationState; dataMode: DataMode; userEmail: string | null; onRadius: (r: Radius) => void; onRequestLocation: () => void; onSignIn: () => void; onSignOut: () => void }) {
  return <div className="simple-screen"><header className="simple-header"><div><div className="brand small">ping<span>.</span></div><h1>You</h1></div></header><div className="profile-card"><div className="avatar">{userEmail ? userEmail.slice(0, 2).toUpperCase() : "YOU"}</div><div><h2>{userEmail ? "Your Ping account" : "Join your local community"}</h2><p>{userEmail || (dataMode === "live" ? "Live nearby data active" : "Sign in to post and confirm Pings")}</p></div></div><div className="trust-row"><div><strong>7</strong><span>Helpful Pings</span></div><div><strong>19</strong><span>Confirmations</span></div><div><strong>{radius} mi</strong><span>Your radius</span></div></div><div className="settings-list">{!userEmail && <button onClick={onSignIn}><span>✉️</span><div><strong>Sign in</strong><small>Email magic link — no password needed</small></div><b>›</b></button>}<button onClick={onRequestLocation}><span>📍</span><div><strong>Location</strong><small>{locationState === "granted" ? "Location permission active" : "Tap to enable location"}</small></div><b>›</b></button><div className="radius-setting"><span>↔</span><div><strong>Nearby radius</strong><small>Control how local your feed feels</small></div><RadiusSelect radius={radius} onRadius={onRadius} /></div><button><span>🔔</span><div><strong>Notifications</strong><small>Important nearby activity only</small></div><b>›</b></button><button><span>🛡️</span><div><strong>Privacy & safety</strong><small>Blocked users, reports, location privacy</small></div><b>›</b></button>{userEmail && <button onClick={onSignOut}><span>↪</span><div><strong>Sign out</strong><small>Leave this account on this device</small></div><b>›</b></button>}</div></div>;
}

function Composer({ onClose, onPublish }: { onClose: () => void; onPublish: (draft: { category: Category; title: string; body: string }) => void | Promise<void> }) {
  const [category, setCategory] = useState<Category>("Alert");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const canPublish = title.trim().length >= 4 && body.trim().length >= 6;
  return <div className="composer-backdrop" role="dialog" aria-modal="true" aria-label="Create a Ping"><div className="composer-sheet"><div className="sheet-handle" /><div className="composer-header"><button onClick={onClose}>Cancel</button><strong>New Ping</strong><span /></div><h2>What’s happening?</h2><div className="category-grid">{(Object.keys(categoryMeta) as Category[]).map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{categoryMeta[item].emoji} {item}</button>)}</div><label className="composer-label">Short headline</label><input className="composer-input" placeholder="What should neighbours know?" maxLength={70} value={title} onChange={(e) => setTitle(e.target.value)} /><label className="composer-label">Useful detail</label><textarea placeholder="Keep it clear and useful…" maxLength={280} value={body} onChange={(e) => setBody(e.target.value)} /><div className="composer-options"><button>📷 Add photo</button><button>📍 Near your current location</button></div><div className="expiry-note">⏱ This Ping will disappear automatically after 24 hours.</div><button className="publish-button" disabled={!canPublish} onClick={() => canPublish && onPublish({ category, title: title.trim(), body: body.trim() })}>Ping it</button></div></div>;
}

function AuthSheet({ onClose, onSend, busy, message }: { onClose: () => void; onSend: (email: string) => void; busy: boolean; message: string }) {
  const [email, setEmail] = useState("");
  const valid = email.includes("@") && email.includes(".");
  return <div className="composer-backdrop" role="dialog" aria-modal="true" aria-label="Sign in to Ping"><div className="composer-sheet"><div className="sheet-handle" /><div className="composer-header"><button onClick={onClose}>Cancel</button><strong>Join Ping</strong><span /></div><h2>Be part of your mile.</h2><p className="ping-body">Sign in to post useful local information and confirm what other people nearby are seeing. No password needed.</p><label className="composer-label">Email address</label><input className="composer-input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /><div className="expiry-note">✉️ We’ll email you a secure sign-in link. Your email is not shown publicly.</div>{message && <div className="expiry-note">{message}</div>}<button className="publish-button" disabled={!valid || busy} onClick={() => valid && onSend(email.trim())}>{busy ? "Sending…" : "Email me a sign-in link"}</button></div></div>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("feed");
  const [composerOpen, setComposerOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [pings, setPings] = useState<PingItem[]>(seedPings);
  const [radius, setRadius] = useState<Radius>(1);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [dataMode, setDataMode] = useState<DataMode>("demo");
  const [selectedMapPing, setSelectedMapPing] = useState<string | null>(seedPings[0].id);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    try {
      const storedRadius = localStorage.getItem("ping-radius");
      if (storedRadius && [0.5, 1, 3, 5].includes(Number(storedRadius))) setRadius(Number(storedRadius) as Radius);
    } catch {}
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => {
        setUserId(data.session?.user.id || null);
        setUserEmail(data.session?.user.email || null);
      });
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUserId(session?.user.id || null);
        setUserEmail(session?.user.email || null);
        if (session?.user) setAuthOpen(false);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {}
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!coordinates) return;
    let cancelled = false;
    const loadNearby = async () => {
      setDataMode("loading");
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("nearby_pings", {
          viewer_lat: coordinates.lat,
          viewer_lng: coordinates.lng,
          radius_meters: Math.round(radius * 1609.344),
          result_limit: 50,
        });
        if (cancelled) return;
        if (error) throw error;
        const live = ((data || []) as NearbyRow[]).map((row) => mapNearbyRow(row, userId));
        if (live.length) {
          setPings(live);
          setSelectedMapPing(live[0]?.id || null);
          setDataMode("live");
        } else {
          setPings(seedPings);
          setSelectedMapPing(seedPings[0].id);
          setDataMode("demo");
        }
      } catch {
        if (!cancelled) {
          setPings(seedPings);
          setDataMode("offline");
        }
      }
    };
    loadNearby();
    return () => { cancelled = true; };
  }, [coordinates, radius, refreshNonce, userId]);

  const setAndStoreRadius = (next: Radius) => { setRadius(next); try { localStorage.setItem("ping-radius", String(next)); } catch {} };

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationState("unavailable"); return; }
    setLocationState("requesting");
    navigator.geolocation.getCurrentPosition((position) => {
      setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
      setLocationState("granted");
    }, (error) => setLocationState(error.code === 1 ? "denied" : "unavailable"), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };

  const sendMagicLink = async (email: string) => {
    setAuthBusy(true);
    setAuthMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      setAuthMessage("Check your email and tap the secure Ping sign-in link.");
    } catch {
      setAuthMessage("We couldn’t send the link yet. Please check the email and try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    try { await createClient().auth.signOut(); } catch {}
  };

  const confirmPing = async (id: string) => {
    const target = pings.find((p) => p.id === id);
    if (!target?.live) {
      setPings((current) => current.map((p) => p.id === id ? { ...p, confirmations: p.confirmations + 1 } : p));
      return;
    }
    if (!userId) { setAuthMessage("Sign in to confirm real Pings near you."); setAuthOpen(true); return; }
    try {
      const { data, error } = await createClient().rpc("confirm_ping", { target_ping_id: id });
      if (error) throw error;
      setPings((current) => current.map((p) => p.id === id ? { ...p, confirmations: Number(data) } : p));
    } catch {}
  };

  const openComposer = () => {
    if (!userId) { setAuthMessage("Sign in once to post Pings that your neighbours can see."); setAuthOpen(true); return; }
    if (locationState !== "granted" || !coordinates) { requestLocation(); return; }
    setComposerOpen(true);
  };

  const publishPing = async (draft: { category: Category; title: string; body: string }) => {
    if (!userId) { setComposerOpen(false); setAuthOpen(true); return; }
    if (!coordinates) { setComposerOpen(false); requestLocation(); return; }
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
      setTab("feed");
      setRefreshNonce((n) => n + 1);
    } catch {
      window.alert("Ping couldn’t publish yet. Please try again.");
    }
  };

  const myPingCount = pings.filter((p) => p.createdByMe).length;

  return <div className="page-shell"><div className="app-shell"><div className="screen-content">{tab === "feed" && <FeedView pings={pings} radius={radius} locationState={locationState} dataMode={dataMode} onRequestLocation={requestLocation} onRadius={setAndStoreRadius} onConfirm={confirmPing} />}{tab === "map" && <MapView pings={pings.filter((p) => p.distanceMiles <= radius)} selectedId={selectedMapPing} onSelect={setSelectedMapPing} />}{tab === "alerts" && <AlertsView myPingCount={myPingCount} />}{tab === "you" && <YouView radius={radius} locationState={locationState} dataMode={dataMode} userEmail={userEmail} onRadius={setAndStoreRadius} onRequestLocation={requestLocation} onSignIn={() => { setAuthMessage(""); setAuthOpen(true); }} onSignOut={signOut} />}</div><nav className="bottom-nav" aria-label="Primary navigation"><button className={tab === "feed" ? "active" : ""} onClick={() => setTab("feed")}><span>⌂</span>Feed</button><button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}><span>⌖</span>Map</button><button className="compose-nav" onClick={openComposer} aria-label="Create a Ping"><span>+</span>Ping</button><button className={tab === "alerts" ? "active" : ""} onClick={() => setTab("alerts")}><span>♢</span>Alerts<i>{myPingCount ? 2 : 1}</i></button><button className={tab === "you" ? "active" : ""} onClick={() => setTab("you")}><span>○</span>You</button></nav></div>{composerOpen && <Composer onClose={() => setComposerOpen(false)} onPublish={publishPing} />}{authOpen && <AuthSheet onClose={() => setAuthOpen(false)} onSend={sendMagicLink} busy={authBusy} message={authMessage} />}</div>;
}
