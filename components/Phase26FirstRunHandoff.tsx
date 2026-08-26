"use client";

import { useEffect } from "react";

const HANDOFF_KEY = "ping-phase26-location-handoff";

export default function Phase26FirstRunHandoff() {
  useEffect(() => {
    if (window.location.pathname !== "/") return;

    const captureCompletion = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest("button") : null;
      if (!element || !element.closest(".first-run-sheet")) return;
      if (element.textContent?.trim() !== "Open my Feed") return;
      try { localStorage.setItem(HANDOFF_KEY, "1"); } catch {}
    };

    document.addEventListener("click", captureCompletion, true);

    let shouldContinue = false;
    try {
      shouldContinue = localStorage.getItem(HANDOFF_KEY) === "1";
      if (shouldContinue) localStorage.removeItem(HANDOFF_KEY);
    } catch {}

    let timer = 0;
    let attempts = 0;
    const continueLocation = () => {
      if (!shouldContinue) return;
      attempts += 1;
      const status = document.querySelector<HTMLElement>(".location-status");
      const button = status?.querySelector<HTMLButtonElement>("button");
      if (status && button && !button.disabled) {
        button.click();
        return;
      }
      if (attempts < 12) timer = window.setTimeout(continueLocation, 250);
    };
    if (shouldContinue) timer = window.setTimeout(continueLocation, 250);

    return () => {
      document.removeEventListener("click", captureCompletion, true);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
