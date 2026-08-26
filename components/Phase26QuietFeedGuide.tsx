"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type QuietMode = "location" | "quiet" | "offline";

function readRadius() {
  try {
    const value = Number(localStorage.getItem("ping-radius") || 1);
    if ([0.5, 1, 3, 5].includes(value)) return value;
  } catch {}
  return 1;
}

export default function Phase26QuietFeedGuide() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<QuietMode | null>(null);
  const [radius, setRadius] = useState(1);

  useEffect(() => {
    if (window.location.pathname !== "/") return;
    let frame = 0;

    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const card = document.querySelector<HTMLElement>(".quiet-card");
        const heading = card?.querySelector("h2")?.textContent?.trim() || "";
        if (!card) {
          setTarget(null);
          setMode(null);
          return;
        }

        let nextMode: QuietMode | null = null;
        if (heading.includes("Enable location")) nextMode = "location";
        else if (heading.includes("couldn’t load")) nextMode = "offline";
        else if (heading.includes("Quiet around here")) nextMode = "quiet";

        setTarget(card);
        setMode(nextMode);
        setRadius(readRadius());
      });
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    sync();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const widerRadius = useMemo(() => {
    if (radius < 3) return 3;
    if (radius < 5) return 5;
    return null;
  }, [radius]);

  if (!target || !mode) return null;

  const widen = () => {
    if (!widerRadius) return;
    try { localStorage.setItem("ping-radius", String(widerRadius)); } catch {}
    window.location.reload();
  };

  const enableLocation = () => {
    const button = document.querySelector<HTMLButtonElement>(".location-status button");
    button?.click();
  };

  return createPortal(
    <div className="phase26-quiet-actions" aria-label="What to do next">
      {mode === "location" && (
        <button type="button" className="phase26-primary-action" onClick={enableLocation}>
          <span className="phase26-action-icon" aria-hidden="true">◎</span>
          Enable nearby activity
        </button>
      )}

      {mode === "offline" && (
        <button type="button" className="phase26-primary-action" onClick={() => window.location.reload()}>
          <span className="phase26-action-icon" aria-hidden="true">↻</span>
          Try again
        </button>
      )}

      {mode === "quiet" && (
        <>
          <a className="phase26-primary-action" href="/#ping">
            <span className="phase26-action-icon" aria-hidden="true">＋</span>
            Create a useful Ping
          </a>
          <div className="phase26-secondary-actions">
            {widerRadius && (
              <button type="button" onClick={widen}>Widen to {widerRadius} mi</button>
            )}
            <a href="/map">Explore the map</a>
          </div>
          <small className="phase26-quiet-note">Quiet is real data too. Ping never fills an empty area with sample posts.</small>
        </>
      )}
    </div>,
    target,
  );
}
