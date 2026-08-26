"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Radius = 0.5 | 1 | 3 | 5;
type IconName = "location" | "bolt" | "shield" | "eye";

const RADII: Array<{ value: Radius; label: string; detail: string }> = [
  { value: 0.5, label: "0.5 mi", detail: "Very local" },
  { value: 1, label: "1 mi", detail: "Your mile" },
  { value: 3, label: "3 mi", detail: "Wider area" },
  { value: 5, label: "5 mi", detail: "Explore more" },
];

function LineIcon({ name }: { name: IconName }) {
  if (name === "bolt") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 2 5.5 13h6L11 22l7.5-12h-6L13 2Z" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 19 6v5c0 4.7-2.8 8.1-7 10-4.2-1.9-7-5.3-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  if (name === "eye") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export default function FirstRunOnboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [radius, setRadius] = useState<Radius>(1);
  const sheetRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const finishRef = useRef<(reload: boolean) => void>(() => {});

  const finish = useCallback((reload: boolean) => {
    try {
      localStorage.setItem("ping-onboarding-v1", "complete");
      localStorage.setItem("ping-radius", String(radius));
    } catch {}
    setVisible(false);
    if (reload) window.location.reload();
  }, [radius]);
  finishRef.current = finish;

  useEffect(() => {
    if (window.location.pathname !== "/") return;
    try {
      if (localStorage.getItem("ping-onboarding-v1") === "complete") return;
      const stored = Number(localStorage.getItem("ping-radius") || 1);
      if ([0.5, 1, 3, 5].includes(stored)) setRadius(stored as Radius);
    } catch {}
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finishRef.current(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => headingRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [visible, step]);

  if (!visible) return null;

  return (
    <div className="first-run-backdrop" role="dialog" aria-modal="true" aria-labelledby="ping-onboarding-title">
      <section className="first-run-sheet" ref={sheetRef}>
        <header className="first-run-top">
          <div className="first-run-brand" aria-label="Ping">ping<span aria-hidden="true">.</span></div>
          <button type="button" className="first-run-skip" onClick={() => finish(false)}>Not now</button>
        </header>

        {step === 1 ? (
          <div className="first-run-step first-run-step-one">
            <div className="first-run-intro">
              <div className="first-run-kicker"><i aria-hidden="true" />LIVE AROUND YOU</div>
              <h1 id="ping-onboarding-title" className="first-run-heading" ref={headingRef} tabIndex={-1}>Know what matters around you.</h1>
              <p className="first-run-copy">Useful local updates from people nearby—without the noise of a traditional social feed.</p>
            </div>

            <div className="first-run-content-grid">
              <div className="first-run-benefits">
                <div className="first-run-benefit">
                  <span className="first-run-icon"><LineIcon name="location" /></span>
                  <div><strong>Nearby first</strong><small>Your chosen area decides what you see, not global popularity.</small></div>
                </div>
                <div className="first-run-benefit">
                  <span className="first-run-icon"><LineIcon name="bolt" /></span>
                  <div><strong>Useful right now</strong><small>Alerts, traffic, lost & found, free items, help and local updates.</small></div>
                </div>
                <div className="first-run-benefit">
                  <span className="first-run-icon"><LineIcon name="shield" /></span>
                  <div><strong>Community checked</strong><small>People nearby can confirm useful information and report bad information.</small></div>
                </div>
                <div className="first-run-browse-note">
                  <span className="first-run-note-icon"><LineIcon name="eye" /></span>
                  <span>Browse before signing in. Join only when you want to participate.</span>
                </div>
              </div>

              <div className="first-run-local-visual" aria-hidden="true">
                <span className="first-run-ring ring-one" />
                <span className="first-run-ring ring-two" />
                <span className="first-run-ring ring-three" />
                <span className="first-run-local-dot dot-one" />
                <span className="first-run-local-dot dot-two" />
                <span className="first-run-local-dot dot-three" />
                <span className="first-run-local-center"><LineIcon name="location" /></span>
                <span className="first-run-local-label">YOUR AREA</span>
              </div>
            </div>

            <div className="first-run-actions">
              <button type="button" className="first-run-primary" onClick={() => setStep(2)}>
                Choose my area <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="first-run-step first-run-step-two">
            <div className="first-run-intro compact">
              <div className="first-run-kicker"><i aria-hidden="true" />YOUR AREA</div>
              <h1 id="ping-onboarding-title" className="first-run-heading" ref={headingRef} tabIndex={-1}>Choose how local Ping feels.</h1>
              <p className="first-run-copy">Start small. You can change this radius whenever you want from the Feed or your profile.</p>
            </div>

            <div className="first-run-radius-grid" role="group" aria-label="Choose nearby radius">
              {RADII.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`first-run-radius${radius === option.value ? " selected" : ""}`}
                  aria-pressed={radius === option.value}
                  onClick={() => setRadius(option.value)}
                >
                  <span className="first-run-radius-mark" aria-hidden="true" />
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </button>
              ))}
            </div>

            <div className="first-run-privacy">
              <span className="first-run-icon"><LineIcon name="shield" /></span>
              <div><strong>Your exact public position stays private.</strong><small>Ping asks for device location only when you enable it. Public Ping locations are approximate, not your exact browser coordinates.</small></div>
            </div>

            <div className="first-run-actions two">
              <button type="button" className="first-run-primary" onClick={() => finish(true)}>
                Open my local Feed <span aria-hidden="true">→</span>
              </button>
              <button type="button" className="first-run-secondary" onClick={() => setStep(1)}>Back</button>
            </div>
          </div>
        )}

        <div className="first-run-progress" aria-hidden="true">
          <span className={step === 1 ? "active" : ""} />
          <span className={step === 2 ? "active" : ""} />
        </div>
      </section>
    </div>
  );
}
