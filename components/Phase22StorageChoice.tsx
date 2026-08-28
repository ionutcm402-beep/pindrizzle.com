"use client";

import { useEffect, useState } from "react";

export type AnalyticsChoice = "allow" | "necessary";

export const ANALYTICS_CHOICE_KEY = "ping-analytics-choice-v1";
const ANALYTICS_SESSION_KEY = "ping-product-session-v1";
const ANALYTICS_SEEN_PREFIX = "ping-product-seen-v1:";
const ANALYTICS_CHOICE_MAX_AGE = 60 * 60 * 24 * 365;

let promptShownThisDocument = false;

function readAnalyticsChoiceCookie(): AnalyticsChoice | null {
  try {
    const prefix = `${ANALYTICS_CHOICE_KEY}=`;
    const match = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
    if (!match) return null;
    const value = decodeURIComponent(match.slice(prefix.length));
    return value === "allow" || value === "necessary" ? value : null;
  } catch {
    return null;
  }
}

function saveAnalyticsChoiceCookie(choice: AnalyticsChoice) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ANALYTICS_CHOICE_KEY}=${encodeURIComponent(choice)}; Path=/; Max-Age=${ANALYTICS_CHOICE_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {}
}

export function readAnalyticsChoice(): AnalyticsChoice | null {
  try {
    const value = window.localStorage.getItem(ANALYTICS_CHOICE_KEY);
    if (value === "allow" || value === "necessary") return value;
  } catch {}

  const cookieChoice = readAnalyticsChoiceCookie();
  if (cookieChoice) {
    try { window.localStorage.setItem(ANALYTICS_CHOICE_KEY, cookieChoice); } catch {}
  }
  return cookieChoice;
}

export function clearAnalyticsSessionStorage() {
  try {
    window.sessionStorage.removeItem(ANALYTICS_SESSION_KEY);
    const keys: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(ANALYTICS_SEEN_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {}
}

export function saveAnalyticsChoice(choice: AnalyticsChoice) {
  try { window.localStorage.setItem(ANALYTICS_CHOICE_KEY, choice); } catch {}
  saveAnalyticsChoiceCookie(choice);
  if (choice === "necessary") clearAnalyticsSessionStorage();
  window.dispatchEvent(new CustomEvent("ping:analytics-choice", { detail: { choice } }));
}

export default function Phase22StorageChoice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readAnalyticsChoice()) return;
    clearAnalyticsSessionStorage();

    const onChoice = () => setVisible(false);
    window.addEventListener("ping:analytics-choice", onChoice);

    const timer = window.setTimeout(() => {
      if (readAnalyticsChoice() || promptShownThisDocument) return;
      promptShownThisDocument = true;
      setVisible(true);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("ping:analytics-choice", onChoice);
    };
  }, []);

  if (!visible) return null;

  const choose = (choice: AnalyticsChoice) => {
    saveAnalyticsChoice(choice);
    setVisible(false);
  };

  return (
    <aside className="phase22-storage-choice" aria-label="Browser storage choice">
      <div>
        <strong>Your privacy choice</strong>
        <p>Pindrizzle uses necessary browser storage for sign-in and preferences. Optional product analytics stays off unless you allow it.</p>
        <a href="/cookies">Storage details</a>
      </div>
      <div className="phase22-storage-actions">
        <button type="button" onClick={() => choose("necessary")}>Only necessary</button>
        <button type="button" className="allow" onClick={() => choose("allow")}>Allow analytics</button>
      </div>
      <style jsx global>{`
        .phase22-storage-choice{position:fixed;isolation:isolate;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483000;box-sizing:border-box;width:min(calc(100% - 28px),430px);max-height:calc(100dvh - max(14px,env(safe-area-inset-top)) - max(14px,env(safe-area-inset-bottom)));background:linear-gradient(150deg,rgba(9,31,52,.98),rgba(13,48,72,.98));color:#f7fbff;border:1px solid rgba(124,211,246,.24);border-radius:22px;padding:15px 16px;box-shadow:0 20px 60px rgba(4,21,36,.34);display:grid;gap:12px;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}body:has(.ping-global-nav) .phase22-storage-choice{bottom:calc(var(--pd-tabbar-total,68px) + 16px);max-height:calc(100dvh - var(--pd-tabbar-total,68px) - max(12px,var(--pd-safe-top,env(safe-area-inset-top))) - 32px)}.phase22-storage-choice strong{font-size:14px;letter-spacing:-.01em}.phase22-storage-choice p{margin:5px 0 7px;color:#c7dbe8;font-size:11px;line-height:1.45}.phase22-storage-choice a{color:#7dd9f5;font-size:10px;font-weight:850;text-underline-offset:3px}.phase22-storage-actions{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr;gap:8px}.phase22-storage-actions button{position:relative;z-index:2;min-height:44px;border:1px solid rgba(183,214,229,.34);background:rgba(255,255,255,.04);color:#f7fbff;border-radius:13px;padding:10px 8px;font-size:11px;font-weight:900;touch-action:manipulation;pointer-events:auto}.phase22-storage-actions button.allow{background:linear-gradient(135deg,#1687b8,#1faac7);color:#fff;border-color:rgba(125,217,245,.44);box-shadow:0 8px 22px rgba(22,135,184,.2)}.phase22-storage-actions button:focus-visible{outline:3px solid rgba(125,217,245,.38);outline-offset:2px}@media(max-width:520px){.phase22-storage-choice{width:calc(100% - 20px);border-radius:20px;padding:14px}.phase22-storage-choice p{font-size:10.5px}.phase22-storage-actions button{min-height:44px;padding:9px 7px}}@media(max-height:700px){body:has(.ping-global-nav) .phase22-storage-choice{bottom:calc(var(--pd-tabbar-total,68px) + 10px)}.phase22-storage-choice{padding:12px 14px;gap:9px}.phase22-storage-choice p{margin:4px 0 5px}.phase22-storage-actions button{min-height:44px}}
      `}</style>
    </aside>
  );
}
