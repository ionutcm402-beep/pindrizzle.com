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

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

function zoomForRadius(radiusMiles: number) {
  return radiusMiles <= 0.5 ? 14.7 : radiusMiles <= 1 ? 13.8 : radiusMiles <= 3 ? 12.2 : 11.4;
}

function markerCategory(category: string) {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
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

        map.on("error", (event: any) => {
          const message = event?.error?.message || "The map tiles could not be loaded.";
          setMapError(message);
        });

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
        userMarkerRef.current = new maplibre.Marker({ element: userEl })
          .setLngLat([center.lng, center.lat])
          .addTo(map);

        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(container);
        delayedResize = window.setTimeout(() => map.resize(), 300);
      } catch (error) {
        if (!disposed) {
          setMapError(error instanceof Error ? error.message : "The live map could not start.");
        }
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
    map.easeTo({
      center: [center.lng, center.lat],
      zoom: zoomForRadius(radiusMiles),
      duration: 450,
    });
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
      button.className = `ping-map-marker ping-map-${markerCategory(ping.category)}${selectedId === ping.id ? " selected" : ""}`;
      button.setAttribute("aria-label", `${ping.category}: ${ping.title}`);
      button.title = ping.title;
      button.addEventListener("click", () => onSelect(ping.id));

      return new maplibre.Marker({ element: button, anchor: "center" })
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
        .live-ping-map{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;background:#e9ece7}
        .live-map-starting{position:absolute;z-index:35;left:14px;top:126px;padding:8px 11px;border:1px solid rgba(16,19,17,.09);border-radius:999px;background:rgba(255,255,255,.9);color:#555b57;font-size:10.5px;font-weight:650;box-shadow:0 8px 24px rgba(17,22,18,.06);backdrop-filter:blur(16px)}
        .live-map-error{position:absolute;z-index:40;left:14px;right:14px;top:126px;padding:14px 15px;border:1px solid rgba(16,19,17,.10);border-radius:16px;background:rgba(255,255,255,.94);color:#101311;box-shadow:0 12px 34px rgba(17,22,18,.08);display:grid;gap:4px;backdrop-filter:blur(18px)}
        .live-map-error strong{font-size:13px;font-weight:720}.live-map-error span{font-size:10.5px;color:#727873;line-height:1.45}
        .ping-user-marker{width:15px;height:15px;border:3px solid #fff;border-radius:50%;background:#3c83f6;box-shadow:0 0 0 6px rgba(60,131,246,.16),0 3px 10px rgba(42,86,158,.22)}
        .ping-map-marker{--marker:#46d66f;position:relative;width:34px;height:34px;min-width:34px!important;min-height:34px!important;border:1px solid rgba(16,19,17,.12);border-radius:50%;background:rgba(255,255,255,.96);box-shadow:0 6px 16px rgba(17,22,18,.13);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
        .ping-map-marker:before{content:"";position:absolute;left:50%;top:50%;width:11px;height:11px;border-radius:50%;background:var(--marker);transform:translate(-50%,-50%)}
        .ping-map-marker.ping-map-alert,.ping-map-marker.ping-map-traffic{--marker:#e8554f}.ping-map-marker.ping-map-lost-found{--marker:#d889b3}.ping-map-marker.ping-map-free,.ping-map-marker.ping-map-help{--marker:#46d66f}.ping-map-marker.ping-map-local{--marker:#3c83f6}
        .ping-map-marker.selected{transform:scale(1.18);border-color:rgba(16,19,17,.22);box-shadow:0 9px 24px rgba(17,22,18,.18),0 0 0 4px rgba(255,255,255,.72)}
        .ping-map-marker:focus-visible{outline:3px solid #1769d2!important;outline-offset:3px!important}
      `}</style>
    </>
  );
}
