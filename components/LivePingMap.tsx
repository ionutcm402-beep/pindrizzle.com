"use client";

import { useEffect, useRef, useState } from "react";
import type { PingCategoryKey } from "@/lib/ping-categories";
import { loadPindrizzleMapStyle } from "@/lib/pindrizzle-map-style";

export type MapPingCategory = PingCategoryKey;
export type MapPing = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  categoryKey: MapPingCategory;
  category: string;
  distanceMiles: number;
  confirmations: number;
  priceLabel?: string | null;
};

type Props = {
  center: { lat: number; lng: number };
  radiusMiles: number;
  pings: MapPing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

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
    deals: '<path d="M4 5h8l8 8-7 7-8-8V5Z"/><circle cx="8" cy="9" r="1.1"/><path d="m10 15 5-5"/>',
    marketplace: '<path d="M4 9 12 5l8 4v10H4V9Z"/><path d="M8 19v-6h8v6M7 9h10"/>',
    parking: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
    events: '<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 3v5M16 3v5M4 10h16"/>',
    outages: '<path d="m13 3-7 10h6l-1 8 7-11h-6l1-7Z"/>',
    local: '<path d="M19 10c0 4.4-7 10-7 10S5 14.4 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${paths[category]}</svg>`;
}

function groupPings(pings: MapPing[]) {
  const groups = new Map<string, MapPing[]>();
  pings.forEach((ping) => {
    const key = `${Math.round(ping.lat * 1000)}:${Math.round(ping.lng * 1000)}`;
    const current = groups.get(key) || [];
    current.push(ping);
    groups.set(key, current);
  });
  return Array.from(groups.values());
}

export default function LivePingMap({ center, radiusMiles, pings }: Props) {
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
        const style = await loadPindrizzleMapStyle();
        if (disposed) return;
        const map = new maplibre.Map({ container, style, center: [center.lng, center.lat], zoom: zoomForRadius(radiusMiles), attributionControl: false });
        mapRef.current = map;
        map.on("error", (event: any) => setMapError(event?.error?.message || "The map tiles could not be loaded."));
        map.on("load", () => { if (!disposed) { map.resize(); requestAnimationFrame(() => map.resize()); setMapReady(true); } });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-right");
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
    const groups = groupPings(pings);
    markersRef.current = groups.map((group) => {
      const representative = group[0];
      const isCluster = group.length > 1;
      const isPricePin = !isCluster && representative.categoryKey === "marketplace" && Boolean(representative.priceLabel);
      const avgLat = group.reduce((sum, ping) => sum + ping.lat, 0) / group.length;
      const avgLng = group.reduce((sum, ping) => sum + ping.lng, 0) / group.length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `ping-map-pin ping-map-pin-${representative.categoryKey}${isCluster ? " cluster" : ""}${isPricePin ? " price" : ""}`;
      button.setAttribute("aria-label", isCluster ? `${group.length} nearby pins. Zoom in to separate them.` : `${representative.category}: ${representative.title}${representative.priceLabel ? `, ${representative.priceLabel}` : ""}`);
      button.dataset.pingTitle = isCluster ? `${group.length} pins nearby` : representative.title;
      if (!isCluster) button.dataset.userContent = "true";
      button.innerHTML = isCluster
        ? `<span class="ping-map-pin-head"><b>${group.length}</b></span>`
        : isPricePin
          ? `<span class="ping-map-price-head"><b></b></span><span class="ping-map-price-tail"></span>`
          : `<span class="ping-map-pin-head">${markerSvg(representative.categoryKey)}</span>`;
      if (isPricePin) {
        const price = button.querySelector(".ping-map-price-head b");
        if (price) price.textContent = representative.priceLabel || "";
      }
      button.addEventListener("click", () => {
        if (isCluster) {
          map.easeTo({ center: [avgLng, avgLat], zoom: Math.min(map.getZoom() + 2, 17), duration: 360 });
          return;
        }
        window.location.assign(`/#ping=${encodeURIComponent(representative.id)}`);
      });
      return new maplibre.Marker({ element: button, anchor: "bottom" }).setLngLat([avgLng, avgLat]).addTo(map);
    });
    return () => { markersRef.current.forEach((marker) => marker.remove()); markersRef.current = []; };
  }, [pings, mapReady]);

  return (
    <>
      <div ref={containerRef} className="live-ping-map" aria-label="Map of nearby pins" />
      {!mapReady && !mapError && <div className="live-map-starting" role="status">Loading map…</div>}
      {mapError && <div className="live-map-error" role="status"><strong>Map couldn’t load</strong><span>{mapError}</span></div>}
      <style jsx global>{`
        .map-v3-card{display:none!important}
        .live-ping-map{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;background:#d9e2e6}.live-map-starting{position:absolute;z-index:35;left:16px;top:120px;padding:8px 12px;border:1px solid rgba(8,43,73,.10);border-radius:999px;background:rgba(248,252,253,.92);color:#496777;font-size:10px;font-weight:700;box-shadow:var(--pd-elevation-1);backdrop-filter:blur(16px)}.live-map-error{position:absolute;z-index:40;left:16px;right:16px;top:120px;padding:16px;border:1px solid var(--pd-line);border-radius:20px;background:rgba(255,255,255,.96);color:var(--pd-text);box-shadow:var(--pd-elevation-2);display:grid;gap:4px}.live-map-error strong{font-size:13px}.live-map-error span{font-size:10px;color:var(--pd-muted);line-height:1.45}
        .ping-user-marker{width:14px;height:14px;border:3px solid #fff;border-radius:50%;background:#2f83d6;box-shadow:0 0 0 6px rgba(37,189,200,.17),0 4px 12px rgba(8,43,73,.24)}
        .ping-map-pin{--pin:#2f83d6;position:relative;width:38px!important;height:46px!important;min-width:38px!important;min-height:46px!important;border:0!important;background:transparent!important;padding:0!important;cursor:pointer;filter:drop-shadow(0 5px 8px rgba(8,43,73,.20));transform-origin:50% 100%;transition:transform .16s ease,filter .16s ease;overflow:visible!important}.ping-map-pin-head{position:absolute;left:5px;top:5px;width:29px;height:29px;display:grid;place-items:center;border:2px solid rgba(255,255,255,.96);border-radius:50% 50% 50% 8px;background:var(--pin);color:#fff;transform:rotate(-45deg);box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}.ping-map-pin-head svg{width:14px;height:14px;transform:rotate(45deg)}.ping-map-pin-head b{font-size:10px;color:#fff;transform:rotate(45deg)}.ping-map-pin-alert{--pin:#ef6f64}.ping-map-pin-traffic{--pin:#e5a64d}.ping-map-pin-lost_found{--pin:#6f82c9}.ping-map-pin-free{--pin:#25bdc8}.ping-map-pin-help{--pin:#55cad3}.ping-map-pin-deals{--pin:#2f83d6}.ping-map-pin-marketplace{--pin:#082b49}.ping-map-pin-parking{--pin:#6078ad}.ping-map-pin-events{--pin:#507fc4}.ping-map-pin-outages{--pin:#e9855f}.ping-map-pin-local{--pin:#3698e5}.ping-map-pin.cluster{--pin:#0d3d60}.ping-map-pin:focus-visible{outline:3px solid rgba(37,189,200,.55)!important;outline-offset:4px!important}.ping-map-pin:hover,.ping-map-pin:focus-visible{transform:scale(1.14);z-index:8!important;filter:drop-shadow(0 8px 12px rgba(8,43,73,.25))}
        .ping-map-pin::after{content:attr(data-ping-title);position:absolute;z-index:12;left:50%;bottom:49px;max-width:190px;min-width:max-content;padding:8px;border:1px solid rgba(8,43,73,.08);border-radius:12px;background:rgba(250,253,254,.97);color:#0a2b46;box-shadow:var(--pd-elevation-2);font-size:9px;font-weight:760;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;pointer-events:none;transform:translate(-50%,5px) scale(.96);transition:opacity .14s ease,transform .14s ease}.ping-map-pin:hover::after,.ping-map-pin:focus-visible::after{opacity:1;transform:translate(-50%,0) scale(1)}
        .ping-map-pin.price{width:auto!important;min-width:56px!important;height:43px!important;min-height:43px!important;filter:drop-shadow(0 5px 8px rgba(8,43,73,.20))}.ping-map-price-head{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;min-width:56px;height:30px;padding:0 10px;border:2px solid rgba(255,255,255,.96);border-radius:999px;background:#082b49;color:#fff;white-space:nowrap}.ping-map-price-head b{font-size:10px;font-weight:820;letter-spacing:-.02em}.ping-map-price-tail{position:absolute;z-index:1;left:50%;top:27px;width:10px;height:11px;transform:translateX(-50%);background:#25bdc8;clip-path:polygon(0 0,100% 0,50% 100%)}
        .live-ping-map .maplibregl-ctrl-attrib{margin:0 7px 7px 0!important;border:1px solid rgba(8,43,73,.08)!important;border-radius:10px!important;background:rgba(242,248,249,.74)!important;color:#617985!important;box-shadow:none!important;font-size:8px!important;backdrop-filter:blur(10px)}.live-ping-map .maplibregl-ctrl-attrib a{color:#496777!important;text-decoration:none!important}.live-ping-map .maplibregl-ctrl-attrib-button{width:28px!important;height:28px!important;background-color:rgba(242,248,249,.88)!important;border-radius:9px!important}
        .map-v3-topbar{top:7px!important;left:12px!important;right:12px!important;min-height:36px!important;padding:3px 6px!important;border:1px solid rgba(255,255,255,.64)!important;border-bottom:0!important;border-radius:14px 14px 0 0!important;background:rgba(246,251,252,.91)!important;box-shadow:var(--pd-elevation-2)!important;backdrop-filter:blur(18px) saturate(135%)!important;-webkit-backdrop-filter:blur(18px) saturate(135%)!important;justify-content:flex-end!important}
        .map-v3-brand{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;display:flex!important;align-items:baseline!important;gap:5px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;white-space:nowrap!important}.map-v3-brand .brand{font-size:0!important;line-height:1!important;text-transform:none!important}.map-v3-brand .brand span{display:none!important}.map-v3-brand .brand::before{content:"pindrizzle"!important;font-size:14px!important;line-height:1!important;font-weight:790!important;letter-spacing:-.052em!important;text-transform:lowercase!important;background:var(--pd-wordmark-gradient)!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important}.map-v3-brand>strong{font-size:7px!important;line-height:1!important;font-weight:740!important;color:var(--pd-muted)!important;text-transform:lowercase!important}
        .map-v3-top-actions{display:flex!important;gap:3px!important}.map-v3-top-actions button{display:grid!important;width:26px!important;height:26px!important;place-items:center!important;border:0!important;border-radius:8px!important;background:rgba(232,239,242,.9)!important;box-shadow:none!important;color:#0d3d60!important;font-size:12px!important}.map-v3-top-actions button svg{width:14px!important;height:14px!important}.map-v3-top-actions button:active{transform:scale(.95)}.map-v3-top-actions button:last-child:active{transform:rotate(18deg) scale(.95)}
        .map-v3-controls{top:42px!important;left:12px!important;right:12px!important;padding:3px 6px 5px!important;border:1px solid rgba(255,255,255,.64)!important;border-top:0!important;border-radius:0 0 14px 14px!important;background:rgba(246,251,252,.91)!important;box-shadow:var(--pd-elevation-2)!important;backdrop-filter:blur(18px) saturate(135%)!important;-webkit-backdrop-filter:blur(18px) saturate(135%)!important}.map-v3-status{display:none!important}.map-v3-control-row{margin-top:0!important;grid-template-columns:minmax(0,1fr) minmax(82px,104px)!important;gap:4px!important}.map-v3-radii{padding:1px!important;gap:1px!important;border-radius:8px!important;background:rgba(229,239,243,.86)!important}.map-v3-radii button{height:21px!important;border-radius:6px!important;background:transparent!important;font-size:6.8px!important;font-weight:760!important}.map-v3-radii button.active{background:#082b49!important;color:#fff!important;box-shadow:0 2px 6px rgba(8,43,73,.12)!important}.map-v3-filter-button{height:23px!important;max-width:none!important;justify-content:space-between!important;border:0!important;border-radius:8px!important;background:rgba(229,239,243,.86)!important;padding:0 7px!important;font-size:6.8px!important}.map-v3-filter-button svg{width:12px!important;height:12px!important}
        @media(max-width:350px){.map-v3-topbar{left:8px!important;right:8px!important}.map-v3-controls{left:8px!important;right:8px!important}.map-v3-brand .brand::before{font-size:13px!important}.map-v3-top-actions button{width:25px!important;height:25px!important}.map-v3-control-row{grid-template-columns:minmax(0,1fr) 80px!important}.map-v3-radii button{font-size:6.4px!important}}
        @media (hover:none){.ping-map-pin::after{display:none}}
      `}</style>
    </>
  );
}
