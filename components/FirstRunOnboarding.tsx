"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type Radius = 0.5 | 1 | 3 | 5;

const RADII: Array<{ value: Radius; label: string; detail: string }> = [
  { value: 0.5, label: "0.5 mi", detail: "Very local" },
  { value: 1, label: "1 mi", detail: "Your mile" },
  { value: 3, label: "3 mi", detail: "Wider area" },
  { value: 5, label: "5 mi", detail: "Explore more" },
];

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: 14,
    background: "rgba(15, 22, 16, .58)",
    backdropFilter: "blur(10px)",
  },
  sheet: {
    width: "min(100%, 430px)",
    borderRadius: "30px 30px 24px 24px",
    padding: "12px 20px 22px",
    background: "#fbfbf7",
    boxShadow: "0 -24px 70px rgba(12, 18, 13, .28)",
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    margin: "0 auto 16px",
    background: "#d9ded7",
  },
  top: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 34,
  },
  brand: {
    fontSize: 27,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "-1.2px",
    color: "#151815",
  },
  skip: {
    border: 0,
    padding: "8px 4px",
    background: "transparent",
    color: "#747c75",
    fontSize: 12,
    fontWeight: 800,
  },
  kicker: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    marginTop: 20,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#edf8e9",
    color: "#2b6c2e",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: ".25px",
  },
  title: {
    margin: "13px 0 9px",
    maxWidth: 360,
    color: "#172019",
    fontSize: 31,
    lineHeight: 1.03,
    letterSpacing: "-1.15px",
  },
  copy: {
    margin: 0,
    color: "#657067",
    fontSize: 13,
    lineHeight: 1.55,
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 9,
    marginTop: 18,
  },
  feature: {
    minHeight: 92,
    padding: 13,
    border: "1px solid #e3e8df",
    borderRadius: 18,
    background: "#fff",
  },
  featureIcon: {
    display: "block",
    marginBottom: 8,
    fontSize: 20,
  },
  featureTitle: {
    display: "block",
    color: "#29312b",
    fontSize: 11,
    fontWeight: 900,
  },
  featureCopy: {
    display: "block",
    marginTop: 3,
    color: "#7b847c",
    fontSize: 9.5,
    lineHeight: 1.35,
  },
  primary: {
    width: "100%",
    marginTop: 18,
    border: 0,
    borderRadius: 17,
    padding: "15px 16px",
    background: "#59d951",
    color: "#123214",
    boxShadow: "0 10px 24px rgba(89, 217, 81, .27)",
    fontSize: 14,
    fontWeight: 900,
  },
  progress: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    marginTop: 13,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: "#d8ded5",
  },
  dotActive: {
    width: 19,
    background: "#59d951",
  },
  radiusGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 9,
    marginTop: 19,
  },
  radius: {
    border: "1px solid #dfe5dc",
    borderRadius: 17,
    padding: "13px 12px",
    background: "#fff",
    textAlign: "left",
    color: "#3a433c",
  },
  radiusSelected: {
    borderColor: "#59d951",
    background: "#effaec",
    boxShadow: "inset 0 0 0 1px #59d951",
  },
  radiusLabel: {
    display: "block",
    fontSize: 14,
    fontWeight: 900,
  },
  radiusDetail: {
    display: "block",
    marginTop: 3,
    color: "#788079",
    fontSize: 9.5,
    fontWeight: 700,
  },
  privacy: {
    display: "flex",
    gap: 10,
    marginTop: 15,
    padding: 13,
    borderRadius: 17,
    background: "#f1f4ef",
    color: "#626c64",
    fontSize: 10.5,
    lineHeight: 1.45,
  },
  secondary: {
    width: "100%",
    marginTop: 8,
    border: 0,
    padding: "10px 12px",
    background: "transparent",
    color: "#717a72",
    fontSize: 11,
    fontWeight: 800,
  },
};

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
    <div className="first-run-backdrop" style={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="ping-onboarding-title">
      <section className="first-run-sheet" style={styles.sheet} ref={sheetRef}>
        <div style={styles.handle} aria-hidden="true" />
        <div style={styles.top}>
          <div style={styles.brand} aria-label="Ping">ping<span style={{ color: "#55d84d" }} aria-hidden="true">.</span></div>
          <button type="button" style={styles.skip} onClick={() => finish(false)}>Not now</button>
        </div>

        {step === 1 ? (
          <>
            <div style={styles.kicker}>● REAL LOCAL ACTIVITY</div>
            <h1 id="ping-onboarding-title" ref={headingRef} tabIndex={-1} style={styles.title}>Know what matters around you.</h1>
            <p style={styles.copy}>Ping is a live neighbourhood feed for useful things happening nearby—not a social network full of filler.</p>

            <div style={styles.featureGrid}>
              <div style={styles.feature}>
                <span style={styles.featureIcon} aria-hidden="true">📍</span>
                <strong style={styles.featureTitle}>Nearby first</strong>
                <small style={styles.featureCopy}>See real Pings inside the area you choose.</small>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon} aria-hidden="true">⚡</span>
                <strong style={styles.featureTitle}>Useful now</strong>
                <small style={styles.featureCopy}>Alerts, traffic, lost & found, help and local updates.</small>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon} aria-hidden="true">✓</span>
                <strong style={styles.featureTitle}>Community checked</strong>
                <small style={styles.featureCopy}>People nearby can confirm, reply and report bad information.</small>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon} aria-hidden="true">○</span>
                <strong style={styles.featureTitle}>Browse freely</strong>
                <small style={styles.featureCopy}>No account wall just to look around your local Feed.</small>
              </div>
            </div>

            <button type="button" style={styles.primary} onClick={() => setStep(2)}>Set up my area</button>
          </>
        ) : (
          <>
            <div style={styles.kicker}>📍 YOUR AREA</div>
            <h1 id="ping-onboarding-title" ref={headingRef} tabIndex={-1} style={styles.title}>How local should Ping feel?</h1>
            <p style={styles.copy}>Start small. You can change this radius at any time from the Feed or your profile.</p>

            <div style={styles.radiusGrid} role="group" aria-label="Choose nearby radius">
              {RADII.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  style={{ ...styles.radius, ...(radius === option.value ? styles.radiusSelected : {}) }}
                  aria-pressed={radius === option.value}
                  onClick={() => setRadius(option.value)}
                >
                  <strong style={styles.radiusLabel}>{option.label}</strong>
                  <small style={styles.radiusDetail}>{option.detail}</small>
                </button>
              ))}
            </div>

            <div style={styles.privacy}>
              <span style={{ fontSize: 18 }} aria-hidden="true">🔒</span>
              <div><strong style={{ color: "#354038" }}>Your exact public position stays private.</strong><br />Ping asks for device location only when you enable it. Public Ping locations are approximate, not your exact browser coordinates.</div>
            </div>

            <button type="button" style={styles.primary} onClick={() => finish(true)}>Open my Feed</button>
            <button type="button" style={styles.secondary} onClick={() => setStep(1)}>Back</button>
          </>
        )}

        <div style={styles.progress} aria-hidden="true">
          <span style={{ ...styles.dot, ...(step === 1 ? styles.dotActive : {}) }} />
          <span style={{ ...styles.dot, ...(step === 2 ? styles.dotActive : {}) }} />
        </div>
      </section>
    </div>
  );
}
