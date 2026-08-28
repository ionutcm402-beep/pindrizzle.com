"use client";

import { useEffect, useRef, useState } from "react";
import { loadPindrizzleMapStyle } from "@/lib/pindrizzle-map-style";

export type PingPickerCoordinates = { lat: number; lng: number };

type Props = {
  value: PingPickerCoordinates;
  onChange: (coordinates: PingPickerCoordinates) => void;
};

export default function PingLocationPickerMap({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState("");
  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    const start = async () => {
      try {
        const module = await import("maplibre-gl");
        if (disposed) return;
        const maplibre = (module as any).default ?? module;
        const style = await loadPindrizzleMapStyle();
        if (disposed) return;
        const map = new maplibre.Map({
          container,
          style,
          center: [value.lng, value.lat],
          zoom: 16,
          attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-left");

        const markerEl = document.createElement("div");
        markerEl.className = "pindrizzle-picker-pin";
        markerEl.setAttribute("aria-label", "Selected exact pin location");
        markerEl.innerHTML = '<span class="pindrizzle-picker-pin-core"><i></i></span>';

        const marker = new maplibre.Marker({ element: markerEl, draggable: true, anchor: "bottom" })
          .setLngLat([value.lng, value.lat])
          .addTo(map);
        markerRef.current = marker;

        marker.on("dragend", () => {
          const point = marker.getLngLat();
          onChangeRef.current({ lat: point.lat, lng: point.lng });
        });
        map.on("click", (event: any) => {
          const next = { lat: event.lngLat.lat, lng: event.lngLat.lng };
          marker.setLngLat([next.lng, next.lat]);
          onChangeRef.current(next);
        });
        map.on("error", (event: any) => {
          if (!disposed && event?.error?.message) setError(event.error.message);
        });
        map.on("load", () => {
          map.resize();
          requestAnimationFrame(() => map.resize());
        });
        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(container);
      } catch (value) {
        if (!disposed) setError(value instanceof Error ? value.message : "Map could not start.");
      }
    };

    void start();
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLngLat([value.lng, value.lat]);
    mapRef.current.easeTo({ center: [value.lng, value.lat], duration: 220 });
  }, [value.lat, value.lng]);

  return (
    <div className="ping-location-picker-map-wrap">
      <div ref={containerRef} className="ping-location-picker-map" aria-label="Choose pin location on map" />
      <div className="ping-location-picker-tip">Tap the map or drag the pin</div>
      {error && <div className="ping-location-picker-error">Map could not load. Keep the current point or try again.</div>}
      <style jsx global>{`
        .ping-location-picker-map-wrap{position:relative;overflow:hidden;border:1px solid var(--pd-line);border-radius:var(--pd-radius-card);background:#d9e2e6;box-shadow:var(--pd-elevation-1)}
        .ping-location-picker-map{height:235px;width:100%}
        .ping-location-picker-tip{position:absolute;left:var(--pd-space-2);top:var(--pd-space-2);z-index:3;padding:var(--pd-space-2) var(--pd-space-3);border:1px solid var(--pd-line);border-radius:var(--pd-radius-pill);background:rgba(250,253,254,.94);color:var(--pd-text-2);font-size:9px;font-weight:760;box-shadow:var(--pd-elevation-1);backdrop-filter:blur(14px)}
        .ping-location-picker-error{position:absolute;left:var(--pd-space-2);right:var(--pd-space-2);bottom:var(--pd-space-2);z-index:4;padding:var(--pd-space-2) var(--pd-space-3);border:1px solid rgba(239,111,100,.16);border-radius:var(--pd-radius-control);background:rgba(255,247,246,.96);color:#934f48;font-size:9px;font-weight:700;box-shadow:var(--pd-elevation-1)}
        .pindrizzle-picker-pin{position:relative;width:38px;height:46px;filter:drop-shadow(0 7px 10px rgba(8,43,73,.22));cursor:grab}.pindrizzle-picker-pin:active{cursor:grabbing}.pindrizzle-picker-pin-core{position:absolute;left:5px;top:5px;width:29px;height:29px;display:grid;place-items:center;border:2px solid rgba(255,255,255,.96);border-radius:50% 50% 50% 8px;background:linear-gradient(135deg,var(--pd-blue-600),var(--pd-aqua-500));transform:rotate(-45deg);box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}.pindrizzle-picker-pin-core i{width:8px;height:8px;border:2px solid #fff;border-radius:50%;transform:rotate(45deg)}
        .ping-location-picker-map .maplibregl-ctrl-bottom-right{bottom:var(--pd-space-2);right:var(--pd-space-2)}
        .ping-location-picker-map .maplibregl-ctrl-bottom-left{left:var(--pd-space-2);bottom:var(--pd-space-2)}
        .ping-location-picker-map .maplibregl-ctrl-group{border:1px solid rgba(255,255,255,.72);border-radius:var(--pd-radius-control);overflow:hidden;background:rgba(250,253,254,.90);box-shadow:var(--pd-elevation-1);backdrop-filter:blur(16px)}
        .ping-location-picker-map .maplibregl-ctrl-group button{background-color:transparent}
        .ping-location-picker-map .maplibregl-ctrl-attrib{margin:0!important;border:1px solid var(--pd-line)!important;border-radius:8px!important;background:rgba(250,253,254,.88)!important;color:var(--pd-muted)!important;font-size:8px!important;box-shadow:none!important;backdrop-filter:blur(12px)}
        .ping-location-picker-map .maplibregl-ctrl-attrib a{color:var(--pd-text-2)!important}
      `}</style>
    </div>
  );
}
