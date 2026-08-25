"use client";

import { useEffect, useRef, useState } from "react";

export type MapPing = {
  id: string;
  lat: number;
  lng: number;
  emoji: string;
  title: string;
  category: string;
  distanceMiles: number;
  confirmations: number;
};

type Props = {
  center: { lat: number; lng: number };
  radiusMiles: number;
  pings: MapPing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

type MapLibreApi = {
  Map: new (options: Record<string, unknown>) => any;
  Marker: new (options?: Record<string, unknown>) => any;
  NavigationControl: new (options?: Record<string, unknown>) => any;
};

declare global {
  interface Window {
    maplibregl?: MapLibreApi;
  }
}

// OpenFreeMap's supported browser integration uses the MapLibre v5 global build.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const SCRIPT_URL = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js";
const CSS_URL = "https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css";

function zoomForRadius(radiusMiles: number) {
  return radiusMiles <= 0.5 ? 14.7 : radiusMiles <= 1 ? 13.8 : radiusMiles <= 3 ? 12.2 : 11.4;
}

function loadMapLibre(): Promise<MapLibreApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("Map is browser-only"));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);

  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS_URL;
      document.head.appendChild(link);
    }

    const finish = () => window.maplibregl
      ? resolve(window.maplibregl)
      : reject(new Error("MapLibre loaded but did not initialise"));

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      if (window.maplibregl) return resolve(window.maplibregl);
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("MapLibre CDN failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = finish;
    script.onerror = () => reject(new Error("MapLibre CDN failed to load"));
    document.head.appendChild(script);
  });
}

export default function LivePingMap({ center, radiusMiles, pings, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    setMapError(null);

    loadMapLibre().then((maplibre) => {
      if (disposed || !containerRef.current || mapRef.current) return;
      const map = new maplibre.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [center.lng, center.lat],
        zoom: zoomForRadius(radiusMiles),
        attributionControl: true,
      });

      map.on?.("error", (event: any) => {
        const message = event?.error?.message || "The map tiles could not be loaded.";
        setMapError(message);
      });

      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;

      const userEl = document.createElement("div");
      userEl.className = "ping-user-marker";
      userEl.setAttribute("aria-label", "Your location");
      userMarkerRef.current = new maplibre.Marker({ element: userEl }).setLngLat([center.lng, center.lat]).addTo(map);
    }).catch((error) => {
      if (!disposed) setMapError(error instanceof Error ? error.message : "The live map could not start.");
    });

    return () => {
      disposed = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center: [center.lng, center.lat], zoom: zoomForRadius(radiusMiles), duration: 450 });
    userMarkerRef.current?.setLngLat([center.lng, center.lat]);
  }, [center.lat, center.lng, radiusMiles]);

  useEffect(() => {
    let cancelled = false;
    loadMapLibre().then((maplibre) => {
      const map = mapRef.current;
      if (cancelled || !map) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = pings.map((ping) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `ping-map-marker${selectedId === ping.id ? " selected" : ""}`;
        button.textContent = ping.emoji;
        button.setAttribute("aria-label", `${ping.category}: ${ping.title}`);
        button.addEventListener("click", () => onSelect(ping.id));
        return new maplibre.Marker({ element: button, anchor: "bottom" }).setLngLat([ping.lng, ping.lat]).addTo(map);
      });
    }).catch((error) => {
      if (!cancelled) setMapError(error instanceof Error ? error.message : "Nearby markers could not load.");
    });
    return () => { cancelled = true; };
  }, [pings, selectedId, onSelect]);

  return (
    <>
      <div ref={containerRef} className="live-ping-map" aria-label="Map of nearby Pings" />
      {mapError && (
        <div className="live-map-error" role="status">
          <strong>Map couldn’t load</strong>
          <span>{mapError}</span>
        </div>
      )}
      <style jsx global>{`
        .live-ping-map { position:absolute; inset:0; overflow:hidden; background:#e9efe8; }
        .live-map-error { position:absolute; z-index:40; left:18px; right:18px; top:72px; padding:14px 16px; border-radius:16px; background:rgba(255,255,255,.96); color:#26352b; box-shadow:0 10px 30px rgba(18,36,23,.16); display:grid; gap:4px; }
        .live-map-error strong { font-size:14px; }
        .live-map-error span { font-size:11px; color:#69746d; line-height:1.4; }
        .live-ping-map .maplibregl-canvas { position:absolute; left:0; top:0; }
        .live-ping-map .maplibregl-canvas-container { width:100%; height:100%; }
        .live-ping-map .maplibregl-control-container { position:absolute; inset:0; pointer-events:none; }
        .live-ping-map .maplibregl-ctrl-top-right { position:absolute; top:18px; right:18px; pointer-events:auto; }
        .live-ping-map .maplibregl-ctrl-group { display:flex; flex-direction:column; overflow:hidden; border-radius:14px; background:rgba(255,255,255,.94); box-shadow:0 8px 26px rgba(18,36,23,.12); }
        .live-ping-map .maplibregl-ctrl-group button { width:38px; height:38px; border:0; background:transparent; cursor:pointer; }
        .live-ping-map .maplibregl-ctrl-attrib { position:absolute; right:6px; bottom:5px; padding:2px 5px; border-radius:4px; background:rgba(255,255,255,.82); font-size:9px; pointer-events:auto; }
        .live-ping-map .maplibregl-ctrl-attrib a { color:#47534b; }
        .ping-user-marker { width:18px; height:18px; border:4px solid white; border-radius:50%; background:#52db42; box-shadow:0 0 0 7px rgba(82,219,66,.2), 0 4px 16px rgba(24,76,27,.3); }
        .ping-map-marker { width:44px; height:44px; border:3px solid white; border-radius:16px 16px 16px 5px; background:#183924; display:grid; place-items:center; font-size:20px; box-shadow:0 8px 24px rgba(16,48,26,.24); cursor:pointer; transform:rotate(-8deg); transition:transform .18s ease, box-shadow .18s ease; }
        .ping-map-marker.selected { transform:translateY(-5px) rotate(-8deg) scale(1.15); box-shadow:0 12px 32px rgba(16,48,26,.34), 0 0 0 4px rgba(82,219,66,.25); }
      `}</style>
    </>
  );
}
