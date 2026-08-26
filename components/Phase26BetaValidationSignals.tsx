"use client";

import { useEffect } from "react";

const LAST_VISIT_KEY = "ping-phase26-last-visit-v1";
const RETURN_GAP_MS = 6 * 60 * 60 * 1000;

type ValidationEvent = "return_visit" | "location_enabled";

function track(eventType: ValidationEvent) {
  window.dispatchEvent(new CustomEvent("ping:product-event", { detail: { eventType } }));
}

export default function Phase26BetaValidationSignals() {
  useEffect(() => {
    const now = Date.now();
    try {
      const previous = Number(localStorage.getItem(LAST_VISIT_KEY) || 0);
      if (previous > 0 && now - previous >= RETURN_GAP_MS) track("return_visit");
      localStorage.setItem(LAST_VISIT_KEY, String(now));
    } catch {}
  }, []);

  useEffect(() => {
    if (window.location.pathname !== "/") return;
    let frame = 0;
    let seen = false;

    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (seen) return;
        const active = document.querySelector(".location-status.good");
        if (!active) return;
        seen = true;
        track("location_enabled");
      });
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    sync();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
