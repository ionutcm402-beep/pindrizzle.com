"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolvePlaceLabel } from "@/lib/place";

const PLACE_REFRESH_MS = 15 * 60 * 1000;
const PLACE_LABEL_KEY = "ping-place-label";
const PLACE_LABEL_AT_KEY = "ping-place-label-at";

export default function Phase15PlaceIntelligence() {
  const [active, setActive] = useState(false);
  const lastResolvedAt = useRef(0);
  const resolving = useRef(false);

  const applyLabel = useCallback((label: string) => {
    const safe = label && label !== "Nearby" ? label : "Your mile";
    const nextText = `● ${safe}`;
    document.querySelectorAll<HTMLElement>(".location-pill").forEach((node) => {
      if (node.textContent !== nextText) node.textContent = nextText;
      node.setAttribute("title", "Open your privacy-safe local area snapshot.");
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");
      node.style.cursor = "pointer";
      node.onclick = () => window.location.assign("/place");
      node.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          window.location.assign("/place");
        }
      };
    });
  }, []);

  const resolveGrantedLocation = useCallback((force = false) => {
    if (!navigator.geolocation || resolving.current) return;
    const now = Date.now();
    if (!force && now - lastResolvedAt.current < PLACE_REFRESH_MS) return;

    resolving.current = true;
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const place = await resolvePlaceLabel(position.coords.latitude, position.coords.longitude);
        const resolvedAt = Date.now();
        lastResolvedAt.current = resolvedAt;
        try {
          localStorage.setItem(PLACE_LABEL_KEY, place.label);
          localStorage.setItem(PLACE_LABEL_AT_KEY, String(resolvedAt));
        } catch {}
        applyLabel(place.label);
        setActive(Boolean(place.attribution || (place.label && place.label !== "Nearby")));
        window.dispatchEvent(new CustomEvent("ping:place-resolved", { detail: place }));
      } finally {
        resolving.current = false;
      }
    }, () => {
      resolving.current = false;
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  }, [applyLabel]);

  useEffect(() => {
    // This bridge only enhances the Feed. Other routes resolve place data only
    // when they explicitly need it, avoiding background geolocation work.
    if (window.location.pathname !== "/") return;

    try {
      const cached = localStorage.getItem(PLACE_LABEL_KEY);
      const cachedAt = Number(localStorage.getItem(PLACE_LABEL_AT_KEY) || 0);
      if (cached) {
        applyLabel(cached);
        setActive(true);
      }
      if (Number.isFinite(cachedAt) && cachedAt > 0) lastResolvedAt.current = cachedAt;
    } catch {}

    let permissionStatus: PermissionStatus | null = null;
    let disposed = false;
    const onPermissionChange = () => {
      if (!disposed && permissionStatus?.state === "granted") resolveGrantedLocation(true);
    };

    const setupPermission = async () => {
      if (!navigator.permissions?.query) return;
      try {
        permissionStatus = await navigator.permissions.query({ name: "geolocation" });
        if (disposed) return;
        permissionStatus.addEventListener("change", onPermissionChange);
        if (permissionStatus.state === "granted") resolveGrantedLocation();
      } catch {}
    };
    void setupPermission();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") resolveGrantedLocation();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      permissionStatus?.removeEventListener("change", onPermissionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [applyLabel, resolveGrantedLocation]);

  if (!active) return null;
  return (
    <a
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noreferrer"
      className="phase15-osm-attribution"
      aria-label="OpenStreetMap attribution"
    >
      Place names © OpenStreetMap contributors
      <style jsx>{`
        .phase15-osm-attribution{position:fixed;right:7px;bottom:3px;z-index:4;color:#657067;background:rgba(248,248,243,.88);border-radius:6px;padding:2px 5px;font-size:7px;line-height:1.2;text-decoration:none;backdrop-filter:blur(5px)}
      `}</style>
    </a>
  );
}
