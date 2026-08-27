"use client";

import { useEffect, useRef, useState } from "react";

export type MapPingCategory = "alert" | "traffic" | "lost_found" | "free" | "help" | "local";
export type MapPing = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  categoryKey: MapPingCategory;
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

function markerSvg(category: MapPingCategory) {
  const paths: Record<MapPingCategory, string> = {
    alert: '<path d="M12 4 3.8 19h16.4L12 4Z"/><path d="M12 9v4.5M12 16h.01"/>',
    traffic: '<path d="M5 17h14l-1.5-6.5h-11L5 17Z"/><path d="m8 10.5 1-4h6l1 4M8 17v2M16 17v2"/>',
    lost_found: '<circle cx="10" cy="10" r="5.5"/><path d="m14 14 5 5M8.3 9a2 2 0 1 1 3.4 1.4c-.8.7-1.5 1-1.5 2.1"/>',
    free: '<rect x="4" y="9" width="16" height="10" rx="2"/><path d="M12 9v10M3.5 9h17M8 6c0-1.6 1.8-2.2 4 3 2.2-5.2 4-4.6 4-3S14.4 9 12 9 8 7.6 8 6Z"/>',
    help: '<circle cx="12" cy="12" r="8"/><path d="M9.8 9.5a2.4 2.4 0 1 1 4 1.7c-.9.8-1.7 1.2-1.7 2.5M12 16.5h.01"/>',
    local: '<path d="M19 10c0 4.4-7 10-7 10S5 14.4 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[category]}</svg>`;
}

export default function LivePingMap({ center, radiusMiles, pings, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const maplibreRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let delayedResize = 0;
    setMapError(null);
    setMapReady(false);

    const start = async () => {
      try {
        const module = await import("maplibre-gl");
        if (disposed) return;
        const maplibre = (module as any).default ?? module;
        maplibreRef.current = maplibre;
        const map = new maplibre.Map({
          container,
          style: STYLE_URL,
          center: [center.lng, center.lat],
          zoom: zoomForRadius(radiusMiles),
          attributionControl: true,
        });
        mapRef.current = map;
        map.on("error", (event: any) => setMapError(event?.error?.message || "The map tiles could not be loaded."));
        map.on("load", () => {
          if (disposed) return;
          map.resize();
          requestAnimationFrame(() => map.resize());
          setMapReady(true);
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        const userEl = document.createElement("div");
        userEl.className = "ping-user-marker";
        userEl.setAttribute("aria-label", "Your location");
        userMarkerRef.current = new maplibre.Marker({ element: userEl }).setLngLat([center.lng, center.lat]).addTo(map);
        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(container);
        delayedResize = window.setTimeout(() => map.resize(), 300);
      } catch (error) {
        if (!disposed) setMapError(error instanceof Error ? error.message : "The live map could not start.");
      }
    };

    void start();
    return () => {
      disposed = true;
      if (delayedResize) window.clearTimeout(delayedResize);
      resizeObserver?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.easeTo({ center: [center.lng, center.lat], zoom: zoomForRadius(radiusMiles), duration: 420 });
    userMarkerRef.current?.setLngLat([center.lng, center.lat]);
  }, [center.lat, center.lng, radiusMiles, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !mapReady) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = pings.map((ping) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `ping-map-pin ping-map-pin-${ping.categoryKey}${selectedId === ping.id ? " selected" : ""}`;
      button.setAttribute("aria-label", `${ping.category}: ${ping.title}`);
      button.title = ping.title;
      button.innerHTML = `<span class="ping-map-pin-head">${markerSvg(ping.categoryKey)}</span><span class="ping-map-pin-tail"></span>`;
      button.addEventListener("click", () => onSelect(ping.id));
      return new maplibre.Marker({ element: button, anchor: "bottom" }).setLngLat([ping.lng, ping.lat]).addTo(map);
    });
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [pings, selectedId, onSelect, mapReady]);

  return (
    <>
      <div ref={containerRef} className="live-ping-map" aria-label="Map of nearby Pings" />
      {!mapReady && !mapError && <div className="live-map-starting" role="status">Loading map…</div>}
      {mapError && <div className="live-map-error" role="status"><strong>Map couldn’t load</strong><span>{mapError}</span></div>}
      <style jsx global>{`
        .live-ping-map{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;background:#e9ece7}.live-map-starting{position:absolute;z-index:35;left:14px;top:190px;padding:8px 11px;border:1px solid rgba(16,19,17,.09);border-radius:999px;background:rgba(255,255,255,.9);color:#555b57;font-size:10px;font-weight:650;box-shadow:0 8px 24px rgba(17,22,18,.06);backdrop-filter:blur(16px)}.live-map-error{position:absolute;z-index:40;left:14px;right:14px;top:190px;padding:14px 15px;border:1px solid rgba(16,19,17,.10);border-radius:16px;background:rgba(255,255,255,.94);color:#101311;box-shadow:0 12px 34px rgba(17,22,18,.08);display:grid;gap:4px}.live-map-error strong{font-size:13px}.live-map-error span{font-size:10px;color:#727873;line-height:1.45}
        .ping-user-marker{width:14px;height:14px;border:3px solid #fff;border-radius:50%;background:#3c83f6;box-shadow:0 0 0 6px rgba(60,131,246,.15),0 3px 10px rgba(42,86,158,.22)}
        .ping-map-pin{--pin:#46d66f;position:relative;width:36px!important;height:44px!important;min-width:36px!important;min-height:44px!important;border:0!important;background:transparent!important;padding:0!important;cursor:pointer;filter:drop-shadow(0 5px 7px rgba(16,25,18,.18));transform-origin:50% 100%;transition:transform .16s ease}.ping-map-pin-head{position:absolute;top:0;left:2px;width:32px;height:32px;display:grid;place-items:center;border:2px solid #fff;border-radius:50%;background:var(--pin);color:#fff}.ping-map-pin-head svg{width:16px;height:16px}.ping-map-pin-tail{position:absolute;left:14px;top:27px;width:8px;height:12px;background:var(--pin);clip-path:polygon(0 0,100% 0,50% 100%)}.ping-map-pin-alert{--pin:#e8554f}.ping-map-pin-traffic{--pin:#d86b43}.ping-map-pin-lost_found{--pin:#b16b9b}.ping-map-pin-free{--pin:#31a955}.ping-map-pin-help{--pin:#34865a}.ping-map-pin-local{--pin:#3c83f6}.ping-map-pin.selected{transform:scale(1.22);z-index:5!important}.ping-map-pin.selected .ping-map-pin-head{box-shadow:0 0 0 4px rgba(255,255,255,.7)}.ping-map-pin:focus-visible{outline:3px solid #1769d2!important;outline-offset:4px!important}
      `}</style>
    </>
  );
}
