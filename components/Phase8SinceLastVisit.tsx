"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type Summary = {
  previous_visit_at: string | null;
  first_visit: boolean;
  new_pings: number;
  new_replies: number;
  new_confirmations: number;
  new_helpful: number;
};

type StoredSummary = { userId: string; savedAt: number; summary: Summary };

const SESSION_KEY = "ping-phase8-return-summary";
const SESSION_TTL = 30 * 60 * 1000;

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null;
  if (value && typeof value === "object") return value as T;
  return null;
}

function radiusMeters() {
  const visibleSelect = document.querySelector<HTMLSelectElement>(".location-status select");
  const fromPage = Number(visibleSelect?.value || 0);
  if ([0.5, 1, 3, 5].includes(fromPage)) return Math.round(fromPage * 1609.344);
  try {
    const stored = Number(localStorage.getItem("ping-radius") || 1);
    if ([0.5, 1, 3, 5].includes(stored)) return Math.round(stored * 1609.344);
  } catch {}
  return 1609;
}

function relativeVisit(value: string | null) {
  if (!value) return "";
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function normalizeSummary(row: Summary): Summary {
  return {
    previous_visit_at: row.previous_visit_at,
    first_visit: Boolean(row.first_visit),
    new_pings: Number(row.new_pings || 0),
    new_replies: Number(row.new_replies || 0),
    new_confirmations: Number(row.new_confirmations || 0),
    new_helpful: Number(row.new_helpful || 0),
  };
}

async function getCoords() {
  if (!navigator.geolocation) throw new Error("Location is unavailable");
  return await new Promise<GeolocationCoordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      reject,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });
}

export default function Phase8SinceLastVisit() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const running = useRef(false);

  const saveSessionSummary = (userId: string, value: Summary) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId, savedAt: Date.now(), summary: value } satisfies StoredSummary));
    } catch {}
  };

  const loadSummary = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setReady(true);
        return;
      }

      try {
        const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") as StoredSummary | null;
        if (stored?.userId === userId && Date.now() - stored.savedAt < SESSION_TTL) {
          setSummary(stored.summary);
          setReady(true);
          return;
        }
      } catch {}

      const permission = navigator.permissions ? await navigator.permissions.query({ name: "geolocation" }) : null;
      if (permission && permission.state !== "granted") {
        const onChange = () => {
          if (permission.state === "granted") {
            permission.removeEventListener("change", onChange);
            running.current = false;
            void loadSummary();
          }
        };
        permission.addEventListener("change", onChange);
        setReady(true);
        return;
      }

      const coords = await getCoords();
      const { data, error } = await supabase.rpc("retention_since_last_visit", {
        viewer_lat: coords.latitude,
        viewer_lng: coords.longitude,
        radius_meters: radiusMeters(),
      });
      if (error) throw error;

      const row = firstRow<Summary>(data);
      if (row) {
        const normalized = normalizeSummary(row);
        setSummary(normalized);
        saveSessionSummary(userId, normalized);
      }
      setReady(true);
    } catch (error) {
      console.error("Since-last-visit summary failed", error);
      setReady(true);
    } finally {
      running.current = false;
    }
  }, []);

  const refreshSummary = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshMessage("");
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Sign in required");

      const coords = await getCoords();
      const { data, error } = await supabase.rpc("retention_preview_since_last_visit", {
        viewer_lat: coords.latitude,
        viewer_lng: coords.longitude,
        radius_meters: radiusMeters(),
      });
      if (error) throw error;

      const row = firstRow<Summary>(data);
      if (!row) throw new Error("No summary returned");
      const normalized = normalizeSummary(row);
      setSummary(normalized);
      saveSessionSummary(userId, normalized);
      setRefreshMessage("Updated just now");
    } catch (error) {
      console.error("Catch-up refresh failed", error);
      setRefreshMessage("Couldn’t refresh right now");
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    const attach = () => {
      if (window.location.pathname !== "/") {
        setHost(null);
        return;
      }
      const filter = document.querySelector<HTMLElement>(".filter-row");
      const parent = filter?.parentElement;
      if (!filter || !parent) return;

      let node = parent.querySelector<HTMLElement>("[data-phase8-return-host]");
      if (!node) {
        node = document.createElement("div");
        node.dataset.phase8ReturnHost = "true";
        parent.insertBefore(node, filter);
      }
      setHost(node);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", attach);
    window.addEventListener("hashchange", attach);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", attach);
      window.removeEventListener("hashchange", attach);
    };
  }, []);

  useEffect(() => { void loadSummary(); }, [loadSummary]);

  const total = useMemo(() => summary ? summary.new_pings + summary.new_replies + summary.new_confirmations + summary.new_helpful : 0, [summary]);

  if (!host || !ready || !summary) return null;

  const scrollToUpdates = () => document.querySelector<HTMLElement>(".feed-list")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return createPortal(
    <section className={`phase8-return-card ${total > 0 ? "has-updates" : "is-caught-up"}`} aria-label="Since your last visit">
      <div className="phase8-return-top">
        <div>
          <span className="phase8-kicker">SINCE YOUR LAST VISIT</span>
          <h2>{summary.first_visit ? "Your local catch-up starts here." : total > 0 ? `${total} useful ${total === 1 ? "change" : "changes"} nearby.` : "You’re caught up."}</h2>
          <p>{summary.first_visit ? "Ping will show what genuinely changed around you the next time you return." : total > 0 ? `New activity since ${relativeVisit(summary.previous_visit_at)}.` : `Nothing new inside your radius since ${relativeVisit(summary.previous_visit_at)}.`}</p>
          {refreshMessage && <small className="phase8-refresh-message">{refreshMessage}</small>}
        </div>
        <button className="phase8-return-mark" type="button" onClick={() => void refreshSummary()} disabled={refreshing} aria-label="Refresh nearby changes" title="Refresh nearby changes">{refreshing ? "…" : "↻"}</button>
      </div>

      {!summary.first_visit && total > 0 && (
        <div className="phase8-return-grid">
          <div><strong>{summary.new_pings}</strong><span>New Pings</span></div>
          <div><strong>{summary.new_replies}</strong><span>Replies</span></div>
          <div><strong>{summary.new_confirmations}</strong><span>Confirms</span></div>
          <div><strong>{summary.new_helpful}</strong><span>Helpful</span></div>
        </div>
      )}

      {!summary.first_visit && total > 0 && <button className="phase8-see-updates" type="button" onClick={scrollToUpdates}>See what’s nearby ↓</button>}

      <style jsx>{`
        .phase8-return-card{margin:10px 18px 13px;padding:16px;border:1px solid #dfe6dc;border-radius:21px;background:#f5f8f2;color:#1d2a20;box-shadow:0 10px 28px rgba(31,41,32,.05)}
        .phase8-return-card.has-updates{background:linear-gradient(145deg,#edf8e7,#f9faf5)}
        .phase8-return-top{display:grid;grid-template-columns:1fr 38px;gap:10px;align-items:start}.phase8-kicker{font-size:8px;font-weight:950;letter-spacing:.11em;color:#6b796e}.phase8-return-card h2{margin:5px 0 4px;font-size:17px;line-height:1.15;letter-spacing:-.35px}.phase8-return-card p{margin:0;color:#6e796f;font-size:10px;line-height:1.45}.phase8-refresh-message{display:block;margin-top:5px;color:#758078;font-size:8px;font-weight:750}.phase8-return-mark{width:36px;height:36px;border:0;border-radius:13px;background:#dcebd5;display:grid;place-items:center;font-size:18px;font-weight:900;color:#416445;cursor:pointer}.phase8-return-mark:hover{transform:translateY(-1px)}.phase8-return-mark:disabled{opacity:.55;cursor:wait;transform:none}.phase8-return-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:13px}.phase8-return-grid div{padding:9px 4px;border-radius:13px;background:rgba(255,255,255,.72);text-align:center}.phase8-return-grid strong{display:block;font-size:17px}.phase8-return-grid span{display:block;margin-top:2px;color:#758078;font-size:7px;font-weight:850}.phase8-see-updates{width:100%;margin-top:10px;border:0;border-radius:12px;background:#1f3424;color:white;padding:10px;font-size:9px;font-weight:900;cursor:pointer}
      `}</style>
    </section>,
    host,
  );
}
