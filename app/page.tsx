"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = "Alert" | "Traffic" | "Lost & Found" | "Free" | "Help" | "Local";
type Radius = 0.5 | 1 | 3 | 5;
type LocationState = "idle" | "requesting" | "granted" | "denied" | "unavailable";
type Coordinates = { lat: number; lng: number };
type DataMode = "idle" | "loading" | "live" | "quiet" | "offline";
type PingDraft = { category: Category; title: string; body: string; photo: File | null };

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
  mediaUrl?: string;
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

type PingMediaRow = { ping_id: string; storage_path: string; mime_type: string };

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
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 6 * 1024 * 1024;

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

async function addSignedMediaUrls(items: PingItem[]) {
  if (!items.length) return items;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ping_media")
    .select("ping_id,storage_path,mime_type")
    .in("ping_id", items.map((item) => item.id));
  if (error || !data?.length) return items;

  const mediaRows = data as PingMediaRow[];
  const paths = mediaRows.map((row) => row.storage_path);
  const signed = await supabase.storage.from("ping-media").createSignedUrls(paths, 900);
  if (signed.error || !signed.data) return items;

  const urlByPing = new Map<string, string>();
  mediaRows.forEach((row, index) => {
    const entry = signed.data?.[index];
    if (entry?.signedUrl) urlByPing.set(row.ping_id, entry.signedUrl);
  });
  return items.map((item) => ({ ...item, mediaUrl: urlByPing.get(item.id) }));
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
      {ping.mediaUrl && <img className="ping-photo" src={ping.mediaUrl} alt={`Photo attached to ${ping.title}`} loading="lazy" />}
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

function Composer({ onClose, onPublish }: { onClose: () => void; onPublish: (draft: PingDraft) => void | Promise<void> }) {
  const [category, setCategory] = useState<Category>("Alert");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const photoPreview = useMemo(() => photo ? URL.createObjectURL(photo) : "", [photo]);
  const canPublish = title.trim().length >= 4 && body.trim().length >= 6 && !publishing;

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const choosePhoto = (file: File | null) => {
    setPhotoError("");
    if (!file) {
      setPhoto(null);
      return;
    }
    if (!PHOTO_TYPES.includes(file.type)) {
      setPhoto(null);
      setPhotoError("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setPhoto(null);
      setPhotoError("Photo must be 6 MB or smaller.");
      return;
    }
    setPhoto(file);
  };

  const publish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    try {
      await onPublish({ category, title: title.trim(), body: body.trim(), photo });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="composer-backdrop" role="dialog" aria-modal="true" aria-label="Create a Ping">
      <div className="composer-sheet">
        <div className="sheet-handle" />
        <div className="composer-header"><button onClick={onClose} disabled={publishing}>Cancel</button><strong>New Ping</strong><span /></div>
        <h2>What’s happening?</h2>
        <div className="category-grid">{(Object.keys(categoryMeta) as Category[]).map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)} disabled={publishing}>{categoryMeta[item].emoji} {item}</button>)}</div>
        <label className="composer-label">Short headline</label>
        <input className="composer-input" placeholder="What should neighbours know?" maxLength={70} value={title} onChange={(event) => setTitle(event.target.value)} disabled={publishing} />
        <label className="composer-label">Useful detail</label>
        <textarea placeholder="Keep it clear and useful…" maxLength={280} value={body} onChange={(event) => setBody(event.target.value)} disabled={publishing} />

        <label className="composer-photo-picker">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0] || null)} disabled={publishing} />
          <span>📷</span>
          <div><strong>{photo ? "Change photo" : "Add a photo"}</strong><small>Optional · JPEG, PNG or WebP · max 6 MB</small></div>
          <b>{photo ? "Change" : "Add"}</b>
        </label>
        {photoPreview && (
          <div className="composer-photo-preview">
            <img src={photoPreview} alt="Selected Ping photo preview" />
            <button type="button" onClick={() => choosePhoto(null)} disabled={publishing}>Remove</button>
          </div>
        )}
        {photoError && <div className="composer-photo-error">{photoError}</div>}

        <div className="expiry-note">📍 Posted near your current location · exact coordinates are not shown publicly.</div>
        <div className="expiry-note">⏱ This Ping will disappear automatically after 24 hours.</div>
        <button className="publish-button" disabled={!canPublish} onClick={publish}>{publishing ? "Posting…" : "Ping it"}</button>
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
        const supabase = createClient();
        const { data, error } = await supabase.rpc("nearby_pings", {
          viewer_lat: coordinates.lat,
          viewer_lng: coordinates.lng,
          radius_meters: Math.round(radius * 1609.344),
          result_limit: 50,
        });
        if (cancelled) return;
        if (error) throw error;
        const base = ((data || []) as NearbyRow[]).map((row) => mapNearbyRow(row, userId));
        const live = await addSignedMediaUrls(base);
        if (cancelled) return;
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
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dirtyWhileHidden = false;

    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") {
        dirtyWhileHidden = true;
        return;
      }
      dirtyWhileHidden = false;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        setRefreshNonce((value) => value + 1);
      }, 500);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && dirtyWhileHidden) scheduleRefresh();
    };

    const channel = supabase
      .channel("ping-feed-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pings" }, scheduleRefresh)
      .subscribe();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
    };
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

  const publishPing = async (draft: PingDraft) => {
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
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_ping", {
        ping_category: toDatabaseCategory[draft.category],
        ping_title: draft.title,
        ping_body: draft.body,
        ping_lat: coordinates.lat,
        ping_lng: coordinates.lng,
        ping_place_label: "Near your current location",
        ping_precision: "approximate",
      });
      if (error) throw error;
      const createdId = String(data || "");

      if (draft.photo && createdId) {
        const storagePath = `${userId}/${createdId}/photo`;
        const upload = await supabase.storage.from("ping-media").upload(storagePath, draft.photo, {
          cacheControl: "3600",
          contentType: draft.photo.type,
          upsert: false,
        });
        if (upload.error) {
          console.error("Ping photo upload failed", upload.error);
          window.alert("Your Ping was posted, but the photo could not upload. The text Ping is still live.");
        } else {
          const attach = await supabase.rpc("attach_ping_media", {
            target_ping_id: createdId,
            object_path: storagePath,
            media_mime_type: draft.photo.type,
            media_byte_size: draft.photo.size,
          });
          if (attach.error) {
            console.error("Ping photo attach failed", attach.error);
            await supabase.storage.from("ping-media").remove([storagePath]);
            window.alert("Your Ping was posted, but the photo could not be attached. The text Ping is still live.");
          }
        }
      }

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
      <style jsx global>{`
        .ping-photo{display:block;width:100%;max-height:300px;object-fit:cover;border-radius:17px;margin:2px 0 14px;background:#eef1eb;border:1px solid #e2e7df}
        .composer-photo-picker{margin-top:14px;display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;border:1px solid #dfe5dc;border-radius:16px;padding:12px;background:#fff;cursor:pointer}.composer-photo-picker input{display:none}.composer-photo-picker>span{font-size:20px}.composer-photo-picker strong{display:block;font-size:11px;color:#354038}.composer-photo-picker small{display:block;margin-top:2px;color:#7a847c;font-size:9px}.composer-photo-picker b{font-size:10px;color:#2f6a35}.composer-photo-preview{position:relative;margin-top:10px}.composer-photo-preview img{display:block;width:100%;max-height:230px;object-fit:cover;border-radius:16px;background:#eef1eb}.composer-photo-preview button{position:absolute;right:8px;top:8px;border:0;border-radius:999px;padding:7px 10px;background:rgba(20,27,21,.82);color:#fff;font-size:9px;font-weight:850}.composer-photo-error{margin-top:8px;border-radius:12px;padding:9px 11px;background:#fff0ed;color:#9a4038;font-size:10px;font-weight:750}
      `}</style>
    </div>
  );
}
