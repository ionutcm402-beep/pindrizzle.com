"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

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

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

function zoomForRadius(radiusMiles: number) {
  return radiusMiles <= 0.5 ? 14.7 : radiusMiles <= 1 ? 13.8 : radiusMiles <= 3 ? 12.2 : 11.4;
}

export default function LivePingMap({ center, radiusMiles, pings, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    setMapError(null);
    setMapReady(false);

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: STYLE_URL,
        center: [center.lng, center.lat],
        zoom: zoomForRadius(radiusMiles),
        attributionControl: true,
      });
    } catch (error) {
      setMapError(error instanceof Error ? error.message : "The live map could not start.");
      return;
    }

    mapRef.current = map;

    const handleLoad = () => {
      map.resize();
      requestAnimationFrame(() => map.resize());
      setMapReady(true);
    };

    const handleError = (event: maplibregl.ErrorEvent) => {
      const message = event?.error?.message || "The map tiles could not be loaded.";
      setMapError(message);
    };

    map.on("load", handleLoad);
    map.on("error", handleError);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const userEl = document.createElement("div");
    userEl.className = "ping-user-marker";
    userEl.setAttribute("aria-label", "Your location");
    userMarkerRef.current = new maplibregl.Marker({ element: userEl })
      .setLngLat([center.lng, center.lat])
      .addTo(map);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    const delayedResize = window.setTimeout(() => map.resize(), 250);

    return () => {
      window.clearTimeout(delayedResize);
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.off("load", handleLoad);
      map.off("error", handleError);
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.easeTo({
      center: [center.lng, center.lat],
      zoom: zoomForRadius(radiusMiles),
      duration: 450,
    });
    userMarkerRef.current?.setLngLat([center.lng, center.lat]);
  }, [center.lat, center.lng, radiusMiles, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = pings.map((ping) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `ping-map-marker${selectedId === ping.id ? " selected" : ""}`;
      button.textContent = ping.emoji;
      button.setAttribute("aria-label", `${ping.category}: ${ping.title}`);
      button.addEventListener("click", () => onSelect(ping.id));

      return new maplibregl.Marker({ element: button, anchor: "bottom" })
        .setLngLat([ping.lng, ping.lat])
        .addTo(map);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [pings, selectedId, onSelect, mapReady]);

  return (
    <>
      <div ref={containerRef} className="live-ping-map" aria-label="Map of nearby Pings" />
      {!mapReady && !mapError && (
        <div className="live-map-starting" role="status">Loading map…</div>
      )}
      {mapError && (
        <div className="live-map-error" role="status">
          <strong>Map couldn’t load</strong>
          <span>{mapError}</span>
        </div>
      )}
      <style jsx global>{`
        .live-ping-map { position:absolute; inset:0; width:100%; height:100%; overflow:hidden; background:#e9efe8; }
        .live-map-starting { position:absolute; z-index:35; left:18px; top:72px; padding:10px 13px; border-radius:999px; background:rgba(255,255,255,.96); color:#26352b; font-size:12px; font-weight:800; box-shadow:0 8px 24px rgba(18,36,23,.12); }
        .live-map-error { position:absolute; z-index:40; left:18px; right:18px; top:72px; padding:14px 16px; border-radius:16px; background:rgba(255,255,255,.96); color:#26352b; box-shadow:0 10px 30px rgba(18,36,23,.16); display:grid; gap:4px; }
        .live-map-error strong { font-size:14px; }
        .live-map-error span { font-size:11px; color:#69746d; line-height:1.4; }
        .ping-user-marker { width:18px; height:18px; border:4px solid white; border-radius:50%; background:#52db42; box-shadow:0 0 0 7px rgba(82,219,66,.2), 0 4px 16px rgba(24,76,27,.3); }
        .ping-map-marker { width:44px; height:44px; border:3px solid white; border-radius:16px 16px 16px 5px; background:#183924; display:grid; place-items:center; font-size:20px; box-shadow:0 8px 24px rgba(16,48,26,.24); cursor:pointer; transform:rotate(-8deg); transition:transform .18s ease, box-shadow .18s ease; }
        .ping-map-marker.selected { transform:translateY(-5px) rotate(-8deg) scale(1.15); box-shadow:0 12px 32px rgba(16,48,26,.34), 0 0 0 4px rgba(82,219,66,.25); }
      `}</style>
    </>
  );
}
