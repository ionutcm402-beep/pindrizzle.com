"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PingIcon from "@/components/PingIcon";
import PingLocationPickerMap, { type PingPickerCoordinates } from "@/components/PingLocationPickerMap";
import { getPingLocationSilently } from "@/lib/ping-location";

type LocationPrecision = "approximate" | "exact";

export default function Phase25LocationChoiceBridge() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<LocationPrecision>("approximate");
  const [coordinates, setCoordinates] = useState<PingPickerCoordinates | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const modeRef = useRef<LocationPrecision>("approximate");
  const coordinatesRef = useRef<PingPickerCoordinates | null>(null);
  const composerActiveRef = useRef(false);

  modeRef.current = mode;
  coordinatesRef.current = coordinates;

  useEffect(() => {
    let currentSheet: HTMLElement | null = null;

    const updateCopy = () => {
      document.querySelectorAll<HTMLElement>(".feed-v3-location-card small").forEach((node) => {
        if (node.textContent?.includes("exact position is never published")) {
          node.textContent = "One permission powers Feed, Map and local posting. You choose Private or Exact for each Ping.";
        }
      });
      const note = currentSheet?.querySelector<HTMLElement>(".expiry-note");
      if (note) {
        note.textContent = modeRef.current === "exact"
          ? "Exact location: this selected point will be visible to everyone who can see this Ping."
          : "Private location: Ping publishes an approximate nearby area, not this exact point.";
      }
    };

    const attach = () => {
      const sheet = document.querySelector<HTMLElement>(".composer-v3-sheet");
      if (!sheet) {
        if (currentSheet) {
          currentSheet = null;
          composerActiveRef.current = false;
          setHost(null);
          setPickerOpen(false);
        }
        updateCopy();
        return;
      }
      if (sheet === currentSheet) {
        updateCopy();
        return;
      }

      currentSheet = sheet;
      composerActiveRef.current = true;
      modeRef.current = "approximate";
      setMode("approximate");
      setPickerOpen(false);
      setCoordinates(null);

      let locationHost = sheet.querySelector<HTMLElement>("[data-ping-location-choice-host]");
      if (!locationHost) {
        locationHost = document.createElement("div");
        locationHost.dataset.pingLocationChoiceHost = "true";
        const note = sheet.querySelector(".expiry-note");
        if (note?.parentElement) note.parentElement.insertBefore(locationHost, note);
        else sheet.appendChild(locationHost);
      }
      setHost(locationHost);
      updateCopy();

      void getPingLocationSilently().then((result) => {
        if (currentSheet !== sheet || !result.coordinates) return;
        setCoordinates({ lat: result.coordinates.lat, lng: result.coordinates.lng });
      });
    };

    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    attach();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const note = document.querySelector<HTMLElement>(".composer-v3-sheet .expiry-note");
    if (!note) return;
    note.textContent = mode === "exact"
      ? "Exact location: this selected point will be visible to everyone who can see this Ping."
      : "Private location: Ping publishes an approximate nearby area, not this exact point.";
  }, [mode]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!composerActiveRef.current || !url.includes("/rest/v1/rpc/create_ping_v3")) {
        return originalFetch(input, init);
      }

      try {
        let bodyText = typeof init?.body === "string" ? init.body : "";
        if (!bodyText && input instanceof Request) bodyText = await input.clone().text();
        if (!bodyText) return originalFetch(input, init);
        const body = JSON.parse(bodyText) as Record<string, unknown>;
        body.ping_location_precision = modeRef.current;
        if (coordinatesRef.current) {
          body.ping_lat = coordinatesRef.current.lat;
          body.ping_lng = coordinatesRef.current.lng;
        }
        const nextUrl = url.replace("/rest/v1/rpc/create_ping_v3", "/rest/v1/rpc/create_ping_v4");
        const nextInit = { ...init, body: JSON.stringify(body) };
        if (input instanceof Request) {
          const nextRequest = new Request(nextUrl, input);
          return originalFetch(nextRequest, nextInit);
        }
        return originalFetch(nextUrl, nextInit);
      } catch (error) {
        console.error("Ping location choice bridge could not prepare publish request", error);
        return originalFetch(input, init);
      }
    };

    window.fetch = wrappedFetch;
    return () => {
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    };
  }, []);

  if (!host) return null;

  const chooseMode = (next: LocationPrecision) => {
    setMode(next);
    if (next === "exact" && !coordinates) {
      void getPingLocationSilently().then((result) => {
        if (result.coordinates) setCoordinates({ lat: result.coordinates.lat, lng: result.coordinates.lng });
      });
    }
  };

  return createPortal(
    <section className={`composer-location-choice ${mode === "exact" ? "exact" : "private"}`} aria-label="Ping location privacy">
      <div className="composer-location-choice-head">
        <div><span>LOCATION</span><strong>How precise should this Ping be?</strong></div>
        <PingIcon name={mode === "exact" ? "location" : "shield"} size={17} />
      </div>
      <div className="composer-location-choice-toggle" role="group" aria-label="Location visibility">
        <button type="button" className={mode === "approximate" ? "selected" : ""} aria-pressed={mode === "approximate"} onClick={() => chooseMode("approximate")}>
          <PingIcon name="shield" size={15} /><span><strong>Private location</strong><small>Approximate area</small></span>
        </button>
        <button type="button" className={mode === "exact" ? "selected" : ""} aria-pressed={mode === "exact"} onClick={() => chooseMode("exact")}>
          <PingIcon name="location" size={15} /><span><strong>Exact location</strong><small>Public exact point</small></span>
        </button>
      </div>
      <p className="composer-location-choice-copy">
        {mode === "exact"
          ? "Anyone who can see this Ping can see the selected exact point. Use this only when a precise public location is useful."
          : "People see a nearby approximate area. Your selected exact point stays hidden."}
      </p>
      <button type="button" className="composer-location-map-toggle" onClick={() => setPickerOpen((value) => !value)}>
        <PingIcon name="map" size={15} />{pickerOpen ? "Hide map" : coordinates ? "Choose on map" : "Loading location…"}
      </button>
      {pickerOpen && coordinates && <div className="composer-location-map"><PingLocationPickerMap value={coordinates} onChange={setCoordinates} /><small>{mode === "exact" ? "The pin above is the public point." : "Ping will blur the selected point to a nearby area before publishing."}</small></div>}
      <style jsx global>{`
        .composer-location-choice{margin-top:13px;padding:12px;border:1px solid var(--ping-line);border-radius:14px;background:#fff}.composer-location-choice.exact{border-color:rgba(232,85,79,.28);background:#fffafa}.composer-location-choice-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.composer-location-choice-head>div>span{display:block;color:var(--ping-muted-2);font-size:7px;font-weight:850;letter-spacing:.1em}.composer-location-choice-head strong{display:block;margin-top:3px;color:var(--ping-ink);font-size:10px}.composer-location-choice-head>svg{color:var(--ping-muted)}.composer-location-choice.exact .composer-location-choice-head>svg{color:var(--ping-danger)}.composer-location-choice-toggle{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.composer-location-choice-toggle button{min-height:48px;border:1px solid var(--ping-line);border-radius:11px;background:#fff;color:var(--ping-ink-2);display:flex;align-items:center;gap:8px;padding:8px 9px;text-align:left}.composer-location-choice-toggle button.selected{border-color:var(--ping-ink);background:var(--ping-ink);color:#fff}.composer-location-choice.exact .composer-location-choice-toggle button.selected{border-color:#3a302f;background:#3a302f}.composer-location-choice-toggle span{display:grid;gap:2px}.composer-location-choice-toggle strong{font-size:9px}.composer-location-choice-toggle small{font-size:7.5px;opacity:.72}.composer-location-choice-copy{margin:9px 0 0;color:var(--ping-muted);font-size:8px;line-height:1.45}.composer-location-choice.exact .composer-location-choice-copy{color:#80514d}.composer-location-map-toggle{margin-top:9px;min-height:36px;border:1px solid var(--ping-line);border-radius:10px;background:var(--ping-surface-soft);color:var(--ping-ink-2);padding:0 10px;display:inline-flex;align-items:center;gap:6px;font-size:8.5px;font-weight:760}.composer-location-map{display:grid;gap:6px;margin-top:9px}.composer-location-map>small{color:var(--ping-muted);font-size:7.5px;line-height:1.4}@media(max-width:350px){.composer-location-choice-toggle{grid-template-columns:1fr}}
      `}</style>
    </section>,
    host,
  );
}
