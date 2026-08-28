"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolvePlaceLabel } from "@/lib/place";
import type { PingCoordinates } from "@/lib/ping-location";

const PLACE_LABEL_KEY = "ping-place-label";
const PLACE_LABEL_AT_KEY = "ping-place-label-at";

export default function Phase15PlaceIntelligence() {
  const [active, setActive] = useState(false);
  const resolving = useRef(false);

  const applyLabel = useCallback((label: string) => {
    const safe = label && label !== "Nearby" ? label : "Your local area";
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

  const applyLocationOff = useCallback(() => {
    document.querySelectorAll<HTMLElement>(".location-pill").forEach((node) => {
      node.textContent = "○ Location off";
      node.removeAttribute("title");
      node.removeAttribute("role");
      node.removeAttribute("tabindex");
      node.style.cursor = "";
      node.onclick = null;
      node.onkeydown = null;
    });
    setActive(false);
  }, []);

  const resolveCoordinates = useCallback(async (coordinates: PingCoordinates) => {
    if (resolving.current) return;
    resolving.current = true;
    try {
      const place = await resolvePlaceLabel(coordinates.lat, coordinates.lng);
      const resolvedAt = Date.now();
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
  }, [applyLabel]);

  useEffect(() => {
    if (window.location.pathname !== "/feed") return;

    let cached = "";
    try { cached = localStorage.getItem(PLACE_LABEL_KEY) || ""; } catch {}

    let permissionStatus: PermissionStatus | null = null;
    let disposed = false;

    const syncPermission = () => {
      if (disposed || !permissionStatus) return;
      if (permissionStatus.state === "granted") {
        if (cached) {
          applyLabel(cached);
          setActive(true);
        }
      } else {
        applyLocationOff();
      }
    };

    const setupPermission = async () => {
      if (!navigator.permissions?.query) return;
      try {
        permissionStatus = await navigator.permissions.query({ name: "geolocation" });
        if (disposed) return;
        permissionStatus.addEventListener("change", syncPermission);
        syncPermission();
      } catch {}
    };
    void setupPermission();

    const onLocationChanged = (event: Event) => {
      const coordinates = (event as CustomEvent<PingCoordinates>).detail;
      if (!coordinates) return;
      if (cached) {
        applyLabel(cached);
        setActive(true);
      }
      void resolveCoordinates(coordinates);
    };
    window.addEventListener("ping:location-changed", onLocationChanged);

    return () => {
      disposed = true;
      permissionStatus?.removeEventListener("change", syncPermission);
      window.removeEventListener("ping:location-changed", onLocationChanged);
    };
  }, [applyLabel, applyLocationOff, resolveCoordinates]);

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
