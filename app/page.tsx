"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PingIcon from "@/components/PingIcon";
import {
  CATEGORY_DEFINITIONS,
  CATEGORY_ORDER,
  DEAL_KIND_LABEL,
  DEAL_KINDS,
  DEAL_SOURCE_LABEL,
  expiryOptionsForCategory,
  usefulnessScore,
  type DealKind,
  type DealSource,
  type PingCategoryKey,
  type Radius,
} from "@/lib/ping-categories";
import {
  readPingCategory,
  readPingRadius,
  subscribePingLocalPreferences,
  writePingCategory,
  writePingRadius,
  type PingLocalFilter,
} from "@/lib/ping-local-preferences";
import { getPingLocationSilently, requestPingLocation, type PingCoordinates, type PingLocationState } from "@/lib/ping-location";

type DataMode = "idle" | "loading" | "live" | "quiet" | "offline";
type PingDraft = {
  category: PingCategoryKey;
  title: string;
  body: string;
  photo: File | null;
  expiryHours: number;
  dealSource: DealSource;
  dealKind: DealKind;
  merchantName: string;
};

type PingItem = {
  id: string;
  userId: string;
  category: PingCategoryKey;
  title: string;
  body: string;
  distanceMiles: number;
  ageMinutes: number;
  confirmations: number;
  place: string;
  createdByMe?: boolean;
  mediaUrl?: string;
  dealSource?: DealSource | null;
  dealKind?: DealKind | null;
  merchantName?: string | null;
  lastConfirmedAt?: string | null;
  live: true;
};

type NearbyRow = {
  id: string;
  user_id: string;
  category: PingCategoryKey;
  title: string;
  body: string;
  place_label: string | null;
  confirmation_count: number;
  created_at: string;
  distance_meters: number;
};

type PingMediaRow = { ping_id: string; storage_path: string; mime_type: string };
type PingMetaRow = {
  id: string;
  deal_source: DealSource | null;
  deal_kind: DealKind | null;
  merchant_name: string | null;
  last_confirmed_at: string | null;
};

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 6 * 1024 * 1024;
const RADII: Radius[] = [0.5, 1, 3, 5];

function ageLabel(minutes: number) {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

function minutesSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
}

function confirmationFreshness(value?: string | null) {
  if (!value) return "";
  const minutes = minutesSince(value);
  if (minutes < 1) return "confirmed just now";
  if (minutes < 60) return `last confirmed ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `last confirmed ${hours}h ago` : `last confirmed ${Math.floor(hours / 24)}d ago`;
}

function mapNearbyRow(row: NearbyRow, currentUserId: string | null): PingItem {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    title: row.title,
    body: row.body,
    distanceMiles: row.distance_meters / 1609.344,
    ageMinutes: minutesSince(row.created_at),
    confirmations: row.confirmation_count,
    place: row.place_label || "Nearby",
    createdByMe: currentUserId === row.user_id,
    live: true,
  };
}

async function enrichPings(items: PingItem[]) {
  if (!items.length) return items;
  const supabase = createClient();
  const ids = items.map((item) => item.id);
  const [metaResult, mediaResult] = await Promise.all([
    supabase.from("pings").select("id,deal_source,deal_kind,merchant_name,last_confirmed_at").in("id", ids),
    supabase.from("ping_media").select("ping_id,storage_path,mime_type").in("ping_id", ids),
  ]);

  const meta = new Map<string, PingMetaRow>();
  (metaResult.data || []).forEach((row) => meta.set(String(row.id), row as PingMetaRow));

  const urls = new Map<string, string>();
  if (!mediaResult.error && mediaResult.data?.length) {
    const mediaRows = mediaResult.data as PingMediaRow[];
    const signed = await supabase.storage.from("ping-media").createSignedUrls(mediaRows.map((row) => row.storage_path), 900);
    if (!signed.error && signed.data) {
      mediaRows.forEach((row, index) => {
        const url = signed.data?.[index]?.signedUrl;
        if (url) urls.set(row.ping_id, url);
      });
    }
  }

  return items.map((item) => {
    const extra = meta.get(item.id);
    return {
      ...item,
      mediaUrl: urls.get(item.id),
      dealSource: extra?.deal_source ?? null,
      dealKind: extra?.deal_kind ?? null,
      merchantName: extra?.merchant_name ?? null,
      lastConfirmedAt: extra?.last_confirmed_at ?? null,
    };
  });
}

function FeedCard({ ping, onConfirm, onOpen }: { ping: PingItem; onConfirm: (id: string) => void; onOpen: (ping: PingItem) => void }) {
  const definition = CATEGORY_DEFINITIONS[ping.category];
  const freshness = confirmationFreshness(ping.lastConfirmedAt);
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
      className={`ping-card tone-${definition.tone} feed-v3-card`}
      data-ping-id={ping.id}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(ping)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(ping); }
      }}
    >
      <div className="feed-v3-card-top">
        <div className="feed-v3-category"><span><PingIcon name={definition.icon} size={16} /></span>{definition.label}</div>
        <div className="feed-v3-when"><strong>{ping.distanceMiles.toFixed(1)} mi</strong><span>·</span>{ageLabel(ping.ageMinutes)}</div>
      </div>

      {ping.category === "deals" && ping.merchantName && (
        <div className="feed-v3-deal-context">
          <PingIcon name={ping.dealSource === "business" ? "business" : "deals"} size={13} />
          <strong>{ping.merchantName}</strong>
          <span>{ping.dealSource ? DEAL_SOURCE_LABEL[ping.dealSource] : "Deal"}</span>
          {ping.dealKind && <span>· {DEAL_KIND_LABEL[ping.dealKind]}</span>}
        </div>
      )}

      <div className="feed-v3-title-row"><h2>{ping.title}</h2>{ping.createdByMe && <span className="feed-v3-yours">Yours</span>}</div>
      <p className="ping-body">{ping.body}</p>
      {ping.mediaUrl && <img className="ping-photo" src={ping.mediaUrl} alt={`Photo attached to ${ping.title}`} loading="lazy" />}
      <div className="ping-place feed-v3-place"><PingIcon name="location" size={14} />{ping.place}</div>

      <div className="feed-v3-trust">
        <span><PingIcon name="confirmations" size={14} /><b>{ping.confirmations}</b> confirmed</span>
        {freshness && <span>{freshness}</span>}
      </div>

      <div className="ping-actions feed-v3-actions">
        <button onClick={(event) => { event.stopPropagation(); onConfirm(ping.id); }}><PingIcon name="check" size={15} />Confirm</button>
        <button onClick={(event) => { event.stopPropagation(); onOpen(ping); }}><PingIcon name="replies" size={15} />Open</button>
        <button onClick={sharePing}>Share</button>
      </div>
    </article>
  );
}

function LocationBanner({ state, onRequest }: { state: PingLocationState; onRequest: () => void }) {
  if (state === "granted") return null;
  const checking = state === "checking" || state === "requesting";
  const denied = state === "denied";
  return (
    <section className="feed-v3-location-card" aria-label="Location access">
      <span><PingIcon name="location" size={20} /></span>
      <div>
        <strong>{checking ? "Checking location…" : denied ? "Location is blocked" : "Turn on location once"}</strong>
        <small>{denied ? "Allow location for Ping in your browser settings, then try again." : "One permission powers Feed, Map and local posting. Your exact position is never published."}</small>
      </div>
      <button type="button" onClick={onRequest} disabled={checking}>{checking ? "Checking…" : denied ? "Try again" : "Enable"}</button>
    </section>
  );
}

function Composer({ onClose, onPublish }: { onClose: () => void; onPublish: (draft: PingDraft) => void | Promise<void> }) {
  const [category, setCategory] = useState<PingCategoryKey>("alert");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [expiryHours, setExpiryHours] = useState(CATEGORY_DEFINITIONS.alert.recommendedExpiryHours);
  const [dealSource, setDealSource] = useState<DealSource>("spotted");
  const [dealKind, setDealKind] = useState<DealKind>("offer");
  const [merchantName, setMerchantName] = useState("");
  const photoPreview = useMemo(() => photo ? URL.createObjectURL(photo) : "", [photo]);
  const dealReady = category !== "deals" || merchantName.trim().length >= 2;
  const canPublish = title.trim().length >= 4 && body.trim().length >= 6 && dealReady && !publishing;

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const chooseCategory = (next: PingCategoryKey) => {
    setCategory(next);
    setExpiryHours(CATEGORY_DEFINITIONS[next].recommendedExpiryHours);
  };

  const choosePhoto = (file: File | null) => {
    setPhotoError("");
    if (!file) { setPhoto(null); return; }
    if (!PHOTO_TYPES.includes(file.type)) { setPhoto(null); setPhotoError("Use a JPEG, PNG or WebP image."); return; }
    if (file.size > PHOTO_MAX_BYTES) { setPhoto(null); setPhotoError("Photo must be 6 MB or smaller."); return; }
    setPhoto(file);
  };

  const publish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    try {
      await onPublish({ category, title: title.trim(), body: body.trim(), photo, expiryHours, dealSource, dealKind, merchantName: merchantName.trim() });
    } finally { setPublishing(false); }
  };

  return (
    <div className="composer-backdrop" role="dialog" aria-modal="true" aria-label="Create a Ping">
      <div className="composer-sheet composer-v3-sheet">
        <div className="sheet-handle" />
        <div className="composer-header"><button onClick={onClose} disabled={publishing}>Cancel</button><strong>New Ping</strong><span /></div>
        <h2>What should people nearby know?</h2>

        <div className="composer-v3-category-grid" aria-label="Ping category">
          {CATEGORY_ORDER.map((key) => {
            const item = CATEGORY_DEFINITIONS[key];
            return <button type="button" key={key} className={category === key ? "selected" : ""} onClick={() => chooseCategory(key)} disabled={publishing}><PingIcon name={item.icon} size={16} /><span>{item.label}</span></button>;
          })}
        </div>

        {category === "deals" && (
          <section className="composer-v3-deal-panel">
            <div className="composer-v3-source-toggle">
              <button type="button" className={dealSource === "spotted" ? "selected" : ""} onClick={() => setDealSource("spotted")}><PingIcon name="deals" size={15} />I found this deal</button>
              <button type="button" className={dealSource === "business" ? "selected" : ""} onClick={() => setDealSource("business")}><PingIcon name="business" size={15} />Business post</button>
            </div>
            <label>Shop or business name<input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} maxLength={120} placeholder="e.g. Tesco, local café, Currys" /></label>
            <label>What kind of deal?<select value={dealKind} onChange={(event) => setDealKind(event.target.value as DealKind)}>{DEAL_KINDS.map((kind) => <option key={kind} value={kind}>{DEAL_KIND_LABEL[kind]}</option>)}</select></label>
            {dealSource === "business" && <small>Business posts are self-identified for now. Ping will not call them verified until a verification system exists.</small>}
          </section>
        )}

        <label className="composer-label">Short headline</label>
        <input className="composer-input" placeholder={category === "deals" ? "e.g. Air fryer reduced to £39" : "What should neighbours know?"} maxLength={70} value={title} onChange={(event) => setTitle(event.target.value)} disabled={publishing} />
        <label className="composer-label">Useful detail</label>
        <textarea placeholder={category === "deals" ? "Price, stock, where you saw it and anything people should know…" : "Keep it clear and useful…"} maxLength={280} value={body} onChange={(event) => setBody(event.target.value)} disabled={publishing} />

        <div className="composer-v3-expiry">
          <label><span>Keep this Ping live for</span><select value={expiryHours} onChange={(event) => setExpiryHours(Number(event.target.value))}>{expiryOptionsForCategory(category).map((hours) => <option key={hours} value={hours}>{hours < 24 ? `${hours} hours` : `${hours / 24} ${hours === 24 ? "day" : "days"}`}</option>)}</select></label>
          <small>Ping recommends shorter lifetimes for traffic, parking and alerts, and longer ones for Lost & Found.</small>
        </div>

        <label className="composer-photo-picker">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0] || null)} disabled={publishing} />
          <span><PingIcon name="plus" size={18} /></span>
          <div><strong>{photo ? "Change photo" : "Add a photo"}</strong><small>Optional · JPEG, PNG or WebP · max 6 MB</small></div>
          <b>{photo ? "Change" : "Add"}</b>
        </label>
        {photoPreview && <div className="composer-photo-preview"><img src={photoPreview} alt="Selected Ping photo preview" /><button type="button" onClick={() => choosePhoto(null)} disabled={publishing}>Remove</button></div>}
        {photoError && <div className="composer-photo-error">{photoError}</div>}

        <div className="expiry-note">Your browser location is snapped to an approximate public area before publishing.</div>
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
  const [filter, setFilter] = useState<PingLocalFilter>("all");
  const [locationState, setLocationState] = useState<PingLocationState>("checking");
  const [coordinates, setCoordinates] = useState<PingCoordinates | null>(null);
  const [dataMode, setDataMode] = useState<DataMode>("idle");
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    setRadius(readPingRadius());
    setFilter(readPingCategory());
    const unsubscribe = subscribePingLocalPreferences((next) => { setRadius(next.radius); setFilter(next.category); });

    let cancelled = false;
    void getPingLocationSilently().then((result) => {
      if (cancelled) return;
      setLocationState(result.state);
      if (result.coordinates) setCoordinates(result.coordinates);
    });
    const handleLocation = (event: Event) => {
      const detail = (event as CustomEvent<PingCoordinates>).detail;
      if (!detail) return;
      setCoordinates(detail);
      setLocationState("granted");
    };
    window.addEventListener("ping:location-changed", handleLocation);
    return () => { cancelled = true; unsubscribe(); window.removeEventListener("ping:location-changed", handleLocation); };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => { setUserId(data.session?.user.id || null); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setUserId(session?.user.id || null); setAuthReady(true); });
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
          radius_meters: Math.round(5 * 1609.344),
          result_limit: 100,
        });
        if (error) throw error;
        const base = ((data || []) as NearbyRow[]).map((row) => mapNearbyRow(row, userId));
        const live = await enrichPings(base);
        if (cancelled) return;
        setPings(live);
        setDataMode(live.length ? "live" : "quiet");
      } catch (error) {
        console.error("Feed load failed", error);
        if (!cancelled) { setPings([]); setDataMode("offline"); }
      }
    };
    void loadNearby();
    return () => { cancelled = true; };
  }, [coordinates, refreshNonce, userId]);

  useEffect(() => {
    if (!coordinates) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; setRefreshNonce((value) => value + 1); }, 350);
    };
    const pingsChannel = supabase.channel("ping-feed-live-v3").on("postgres_changes", { event: "*", schema: "public", table: "pings" }, scheduleRefresh).subscribe();
    const confirmationsChannel = supabase.channel("ping-feed-confirmations-v3").on("postgres_changes", { event: "*", schema: "public", table: "confirmations" }, scheduleRefresh).subscribe();
    return () => { if (timer) clearTimeout(timer); void supabase.removeChannel(pingsChannel); void supabase.removeChannel(confirmationsChannel); };
  }, [coordinates]);

  const requestLocation = async () => {
    setLocationState("requesting");
    const result = await requestPingLocation();
    setLocationState(result.state);
    if (result.coordinates) setCoordinates(result.coordinates);
  };

  const beginCompose = () => {
    setPendingCompose(true);
    if (!authReady) return;
    if (!userId) { requestAuth("Sign in once to post useful Pings nearby."); return; }
    if (locationState !== "granted" || !coordinates) void requestLocation();
  };

  useEffect(() => {
    if (!authReady || window.location.hash !== "#ping") return;
    window.history.replaceState({}, "", "/");
    beginCompose();
  }, [authReady]);

  useEffect(() => {
    if (!pendingCompose || !userId) return;
    if (locationState === "idle" || locationState === "unavailable") { void requestLocation(); return; }
    if (locationState === "granted" && coordinates) { setComposerOpen(true); setPendingCompose(false); }
  }, [pendingCompose, userId, locationState, coordinates]);

  const confirmPing = async (id: string) => {
    if (!userId) { requestAuth("Sign in to confirm useful Pings near you."); return; }
    try {
      const { data, error } = await createClient().rpc("confirm_ping", { target_ping_id: id });
      if (error) throw error;
      const now = new Date().toISOString();
      setPings((current) => current.map((ping) => ping.id === id ? { ...ping, confirmations: Number(data), lastConfirmedAt: now } : ping));
    } catch {}
  };

  const publishPing = async (draft: PingDraft) => {
    if (!userId) { setComposerOpen(false); requestAuth("Sign in to publish this Ping."); return; }
    if (!coordinates) { setComposerOpen(false); setPendingCompose(true); void requestLocation(); return; }
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_ping_v2", {
        ping_category: draft.category,
        ping_title: draft.title,
        ping_body: draft.body,
        ping_lat: coordinates.lat,
        ping_lng: coordinates.lng,
        ping_place_label: "Near your current location",
        ping_expires_in_hours: draft.expiryHours,
        ping_deal_source: draft.category === "deals" ? draft.dealSource : null,
        ping_deal_kind: draft.category === "deals" ? draft.dealKind : null,
        ping_merchant_name: draft.category === "deals" ? draft.merchantName : null,
      });
      if (error) throw error;
      const createdId = String(data || "");

      if (draft.photo && createdId) {
        const storagePath = `${userId}/${createdId}/photo`;
        const upload = await supabase.storage.from("ping-media").upload(storagePath, draft.photo, { cacheControl: "3600", contentType: draft.photo.type, upsert: false });
        if (upload.error) {
          console.error("Ping photo upload failed", upload.error);
          window.alert("Your Ping was posted, but the photo could not upload. The text Ping is still live.");
        } else {
          const attach = await supabase.rpc("attach_ping_media", { target_ping_id: createdId, object_path: storagePath, media_mime_type: draft.photo.type, media_byte_size: draft.photo.size });
          if (attach.error) {
            console.error("Ping photo attach failed", attach.error);
            await supabase.storage.from("ping-media").remove([storagePath]);
            window.alert("Your Ping was posted, but the photo could not be attached. The text Ping is still live.");
          }
        }
      }

      setComposerOpen(false);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      console.error("Publish failed", error);
      window.alert("Ping couldn’t publish yet. Please try again.");
    }
  };

  const ranked = useMemo(() => [...pings].sort((a, b) => usefulnessScore({ category: b.category, ageMinutes: b.ageMinutes, distanceMiles: b.distanceMiles, confirmations: b.confirmations }) - usefulnessScore({ category: a.category, ageMinutes: a.ageMinutes, distanceMiles: a.distanceMiles, confirmations: a.confirmations })), [pings]);
  const matchingCategory = useMemo(() => filter === "all" ? ranked : ranked.filter((ping) => ping.category === filter), [ranked, filter]);
  const visible = useMemo(() => matchingCategory.filter((ping) => ping.distanceMiles <= radius), [matchingCategory, radius]);
  const wider = useMemo(() => {
    if (visible.length || locationState !== "granted") return null;
    return RADII.filter((value) => value > radius).map((value) => ({ radius: value, items: matchingCategory.filter((ping) => ping.distanceMiles <= value) })).find((entry) => entry.items.length) || null;
  }, [visible.length, matchingCategory, radius, locationState]);

  const summary = visible.length
    ? visible.slice(0, 2).map((ping) => `${CATEGORY_DEFINITIONS[ping.category].shortLabel} ${ping.distanceMiles.toFixed(1)} mi`).join(" · ")
    : dataMode === "offline" ? "Live local data is temporarily unavailable." : "Real updates near you, ordered by usefulness.";

  const openPingDetail = (ping: PingItem) => window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { ...ping, category: CATEGORY_DEFINITIONS[ping.category].label } }));

  return (
    <div className="page-shell">
      <div className="app-shell">
        <div className="screen-content">
          <header className="app-header feed-v3-header">
            <div><div className="brand">ping<span>.</span></div><div className="location-pill">{locationState === "granted" ? "● Your local area" : "○ Location off"}</div></div>
          </header>

          <section className="feed-v3-summary">
            <div><span>AROUND YOU</span><h1>Useful now</h1><p>{summary}</p></div>
            <div className="feed-v3-summary-side"><strong>{visible.length} live</strong><select value={radius} onChange={(event) => writePingRadius(Number(event.target.value) as Radius)} aria-label="Nearby radius">{RADII.map((value) => <option key={value} value={value}>{value} mi</option>)}</select></div>
          </section>

          <LocationBanner state={locationState} onRequest={() => void requestLocation()} />

          <div className="filter-row feed-v3-filters" aria-label="Feed categories">
            <button type="button" className={filter === "all" ? "active" : ""} onClick={() => writePingCategory("all")}>All</button>
            {CATEGORY_ORDER.map((key) => { const item = CATEGORY_DEFINITIONS[key]; return <button type="button" key={key} className={filter === key ? "active" : ""} onClick={() => writePingCategory(key)}><PingIcon name={item.icon} size={14} />{item.shortLabel}</button>; })}
          </div>

          <main className="feed-list feed-v3-list">
            {visible.length ? visible.map((ping) => <FeedCard key={ping.id} ping={ping} onConfirm={confirmPing} onOpen={openPingDetail} />) : (
              <div className="quiet-card feed-v3-quiet">
                <div className="quiet-icon"><PingIcon name={locationState === "granted" ? "check" : "location"} size={25} /></div>
                <h2>{locationState !== "granted" ? "Your local feed starts with location." : dataMode === "offline" ? "We couldn’t load nearby Pings." : `Quiet within ${radius} ${radius === 1 ? "mile" : "miles"}.`}</h2>
                <p>{locationState !== "granted" ? "Enable location once and Ping will reuse that permission across Feed and Map." : dataMode === "offline" ? "Try again shortly." : wider ? `${wider.items.length} useful ${wider.items.length === 1 ? "Ping" : "Pings"} exist within ${wider.radius} miles.` : "Nothing active has been reported in this category nearby right now."}</p>
                {wider && <button type="button" className="feed-v3-widen" onClick={() => writePingRadius(wider.radius)}>See {wider.radius} mi</button>}
              </div>
            )}
          </main>
        </div>
      </div>

      {composerOpen && <Composer onClose={() => { setComposerOpen(false); setPendingCompose(false); }} onPublish={publishPing} />}

      <style jsx global>{`
        .feed-v3-header{padding-bottom:8px!important}.feed-v3-summary{margin:2px 18px 13px;padding:16px;border:1px solid var(--ping-line);border-radius:18px;background:var(--ping-surface);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:end}.feed-v3-summary>div:first-child>span{display:block;color:var(--ping-muted-2);font-size:8px;font-weight:800;letter-spacing:.1em}.feed-v3-summary h1{margin:5px 0 4px;font-size:25px;line-height:1;letter-spacing:-.8px}.feed-v3-summary p{margin:0;color:var(--ping-muted);font-size:10.5px;line-height:1.4}.feed-v3-summary-side{display:grid;justify-items:end;gap:7px}.feed-v3-summary-side strong{font-size:10px;color:var(--ping-accent-ink)}.feed-v3-summary-side select{height:34px;border:1px solid var(--ping-line);border-radius:10px;background:var(--ping-surface-soft);color:var(--ping-ink-2);padding:0 8px;font-size:10px;font-weight:720}
        .feed-v3-location-card{margin:0 18px 13px;padding:13px;display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:11px;align-items:center;border:1px solid rgba(60,131,246,.14);border-radius:15px;background:rgba(60,131,246,.045)}.feed-v3-location-card>span{width:36px;height:36px;display:grid;place-items:center;border-radius:11px;background:#fff;color:var(--ping-blue)}.feed-v3-location-card strong{display:block;font-size:11px}.feed-v3-location-card small{display:block;margin-top:3px;color:var(--ping-muted);font-size:8.5px;line-height:1.4}.feed-v3-location-card button{height:34px;border:0;border-radius:10px;background:var(--ping-ink);color:#fff;padding:0 11px;font-size:9px;font-weight:760}.feed-v3-location-card button:disabled{opacity:.55}
        .feed-v3-filters{display:flex!important;overflow-x:auto;scrollbar-width:none;white-space:nowrap;padding:2px 18px 13px!important}.feed-v3-filters::-webkit-scrollbar{display:none}.feed-v3-filters button{display:inline-flex!important;align-items:center;gap:6px;flex:0 0 auto}.feed-v3-list{padding-left:18px!important;padding-right:18px!important;gap:11px!important}.feed-v3-card{padding:15px 15px 13px!important;border-radius:17px!important}.feed-v3-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.feed-v3-category{display:inline-flex;align-items:center;gap:7px;color:var(--ping-ink-2);font-size:9.5px;font-weight:760}.feed-v3-category>span{width:28px;height:28px;display:grid;place-items:center;border-radius:9px;background:var(--ping-surface-soft);color:var(--ping-ink-2)}.feed-v3-when{display:flex;align-items:center;gap:5px;color:var(--ping-muted-2);font-size:8.5px}.feed-v3-when strong{color:var(--ping-muted);font-weight:720}.feed-v3-deal-context{display:flex;align-items:center;gap:5px;margin-top:10px;color:#745813;font-size:8.5px}.feed-v3-deal-context strong{color:#423710}.feed-v3-deal-context span{color:#8b783d}.feed-v3-title-row{display:flex;align-items:flex-start;gap:8px}.feed-v3-title-row h2{flex:1;min-width:0}.feed-v3-yours{margin-top:12px;padding:4px 6px;border-radius:999px;background:var(--ping-accent-soft);color:var(--ping-accent-ink);font-size:7.5px;font-weight:800}.feed-v3-place{display:flex;align-items:center;gap:5px}.feed-v3-trust{display:flex;flex-wrap:wrap;gap:6px 10px;padding:9px 0;border-top:1px solid var(--ping-line);color:var(--ping-muted);font-size:9px}.feed-v3-trust span{display:inline-flex;align-items:center;gap:4px}.feed-v3-trust b{color:var(--ping-ink-2)}.feed-v3-actions button{display:inline-flex;align-items:center;gap:5px}.feed-v3-quiet .quiet-icon{width:44px;height:44px;display:grid;place-items:center;margin:0 auto;border-radius:14px;background:var(--ping-surface-soft);color:var(--ping-ink-2)}.feed-v3-widen{margin-top:14px;border:0;border-radius:11px;background:var(--ping-ink);color:#fff;padding:10px 14px;font-size:10px;font-weight:780}
        .ping-card.tone-deal{border-color:rgba(184,146,42,.2)}.ping-photo{display:block;width:100%;max-height:300px;object-fit:cover;border-radius:15px;margin:2px 0 14px;background:#eef1eb;border:1px solid #e2e7df}
        .composer-v3-sheet{max-height:min(92dvh,760px)!important;overflow-y:auto}.composer-v3-category-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.composer-v3-category-grid button{min-height:42px;border:1px solid var(--ping-line);border-radius:12px;background:#fff;color:var(--ping-ink-2);display:flex;align-items:center;justify-content:flex-start;gap:8px;padding:0 10px;font-size:9px;font-weight:720;text-align:left}.composer-v3-category-grid button.selected{border-color:var(--ping-ink);background:var(--ping-ink);color:#fff}.composer-v3-deal-panel{margin-top:13px;padding:12px;border:1px solid rgba(184,146,42,.2);border-radius:14px;background:#fffdf5}.composer-v3-source-toggle{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:10px}.composer-v3-source-toggle button{min-height:38px;border:1px solid rgba(16,19,17,.1);border-radius:10px;background:#fff;color:var(--ping-ink-2);display:flex;align-items:center;justify-content:center;gap:6px;font-size:8.5px;font-weight:750}.composer-v3-source-toggle button.selected{background:#2e2a1b;color:#fff;border-color:#2e2a1b}.composer-v3-deal-panel label{display:grid;gap:5px;margin-top:9px;color:var(--ping-muted);font-size:9px;font-weight:700}.composer-v3-deal-panel input,.composer-v3-deal-panel select{height:40px;border:1px solid var(--ping-line);border-radius:10px;background:#fff;padding:0 10px;color:var(--ping-ink);font-size:11px}.composer-v3-deal-panel small{display:block;margin-top:9px;color:#8a7845;font-size:8px;line-height:1.45}.composer-v3-expiry{margin-top:13px;padding:11px 12px;border:1px solid var(--ping-line);border-radius:13px;background:var(--ping-surface-soft)}.composer-v3-expiry label{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--ping-ink-2);font-size:9px;font-weight:740}.composer-v3-expiry select{height:34px;border:1px solid var(--ping-line);border-radius:9px;background:#fff;padding:0 8px;font-size:9px}.composer-v3-expiry small{display:block;margin-top:5px;color:var(--ping-muted);font-size:7.5px;line-height:1.4}.composer-photo-picker{margin-top:14px;display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;border:1px solid #dfe5dc;border-radius:14px;padding:12px;background:#fff;cursor:pointer}.composer-photo-picker input{display:none}.composer-photo-picker>span{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:var(--ping-surface-soft)}.composer-photo-picker strong{display:block;font-size:11px;color:#354038}.composer-photo-picker small{display:block;margin-top:2px;color:#7a847c;font-size:9px}.composer-photo-picker b{font-size:10px;color:#2f6a35}.composer-photo-preview{position:relative;margin-top:10px}.composer-photo-preview img{display:block;width:100%;max-height:230px;object-fit:cover;border-radius:14px;background:#eef1eb}.composer-photo-preview button{position:absolute;right:8px;top:8px;border:0;border-radius:999px;padding:7px 10px;background:rgba(20,27,21,.82);color:#fff;font-size:9px;font-weight:850}.composer-photo-error{margin-top:8px;border-radius:12px;padding:9px 11px;background:#fff0ed;color:#9a4038;font-size:10px;font-weight:750}
        @media(max-width:350px){.feed-v3-summary{margin-left:14px;margin-right:14px;padding:14px}.feed-v3-location-card{margin-left:14px;margin-right:14px;grid-template-columns:34px minmax(0,1fr)}.feed-v3-location-card button{grid-column:1/-1;width:100%}.feed-v3-list{padding-left:14px!important;padding-right:14px!important}}
      `}</style>
    </div>
  );
}
