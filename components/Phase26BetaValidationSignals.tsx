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
    let shouldMarkReturn = false;
    try {
      const previous = Number(localStorage.getItem(LAST_VISIT_KEY) || 0);
      shouldMarkReturn = previous > 0 && now - previous >= RETURN_GAP_MS;
      localStorage.setItem(LAST_VISIT_KEY, String(now));
    } catch {}

    if (!shouldMarkReturn) return;
    const timer = window.setTimeout(() => track("return_visit"), 250);
    return () => window.clearTimeout(timer);
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
        window.setTimeout(() => track("location_enabled"), 0);
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
