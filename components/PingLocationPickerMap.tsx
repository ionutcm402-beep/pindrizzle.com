"use client";

import { useEffect, useRef, useState } from "react";

export type PingPickerCoordinates = { lat: number; lng: number };

type Props = {
  value: PingPickerCoordinates;
  onChange: (coordinates: PingPickerCoordinates) => void;
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

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
        const map = new maplibre.Map({
          container,
          style: STYLE_URL,
          center: [value.lng, value.lat],
          zoom: 16,
          attributionControl: true,
        });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");

        const marker = new maplibre.Marker({ draggable: true })
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
      <div ref={containerRef} className="ping-location-picker-map" aria-label="Choose Ping location on map" />
      <div className="ping-location-picker-tip">Tap the map or drag the pin</div>
      {error && <div className="ping-location-picker-error">Map could not load. Keep the current point or try again.</div>}
      <style jsx global>{`
        .ping-location-picker-map-wrap{position:relative;overflow:hidden;border:1px solid var(--ping-line);border-radius:15px;background:#e9ece7}.ping-location-picker-map{height:235px;width:100%}.ping-location-picker-tip{position:absolute;left:10px;top:10px;z-index:3;padding:7px 9px;border:1px solid rgba(16,19,17,.08);border-radius:999px;background:rgba(255,255,255,.94);color:var(--ping-ink-2);font-size:8px;font-weight:760;box-shadow:0 6px 18px rgba(16,19,17,.08)}.ping-location-picker-error{position:absolute;left:10px;right:10px;bottom:10px;z-index:4;padding:9px 10px;border-radius:10px;background:rgba(255,255,255,.95);color:var(--ping-danger);font-size:8px;font-weight:700}.ping-location-picker-map .maplibregl-ctrl-bottom-right{bottom:8px;right:8px}.ping-location-picker-map .maplibregl-ctrl-group{border-radius:10px;overflow:hidden;box-shadow:0 5px 18px rgba(16,19,17,.12)}
      `}</style>
    </div>
  );
}
