"use client";

import { useCallback, useEffect, useState } from "react";
import { resolvePlaceLabel } from "@/lib/place";

export default function Phase15PlaceIntelligence() {
  const [active, setActive] = useState(false);

  const applyLabel = useCallback((label: string) => {
    const safe = label && label !== "Nearby" ? label : "Your mile";
    document.querySelectorAll<HTMLElement>(".location-pill").forEach((node) => {
      node.textContent = `● ${safe}`;
      node.setAttribute("title", "Approximate area only — exact coordinates are not shown publicly.");
    });
  }, []);

  const resolveGrantedLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      const place = await resolvePlaceLabel(position.coords.latitude, position.coords.longitude);
      try { localStorage.setItem("ping-place-label", place.label); } catch {}
      applyLabel(place.label);
      setActive(Boolean(place.attribution || (place.label && place.label !== "Nearby")));
      window.dispatchEvent(new CustomEvent("ping:place-resolved", { detail: place }));
    }, () => {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  }, [applyLabel]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("ping-place-label");
      if (cached) applyLabel(cached);
    } catch {}

    const observer = new MutationObserver(() => {
      try {
        const cached = localStorage.getItem("ping-place-label");
        if (cached) applyLabel(cached);
      } catch {}
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (navigator.permissions?.query) {
      void navigator.permissions.query({ name: "geolocation" }).then((permission) => {
        if (permission.state === "granted") resolveGrantedLocation();
        permission.addEventListener("change", () => {
          if (permission.state === "granted") resolveGrantedLocation();
        });
      }).catch(() => {});
    }

    const visible = () => {
      if (document.visibilityState === "visible") resolveGrantedLocation();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visible);
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
