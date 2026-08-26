"use client";

import { useEffect, useState } from "react";

export type AnalyticsChoice = "allow" | "necessary";

export const ANALYTICS_CHOICE_KEY = "ping-analytics-choice-v1";
const ANALYTICS_SESSION_KEY = "ping-product-session-v1";
const ANALYTICS_SEEN_PREFIX = "ping-product-seen-v1:";

export function readAnalyticsChoice(): AnalyticsChoice | null {
  try {
    const value = window.localStorage.getItem(ANALYTICS_CHOICE_KEY);
    return value === "allow" || value === "necessary" ? value : null;
  } catch {
    return null;
  }
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
  if (choice === "necessary") clearAnalyticsSessionStorage();
  window.dispatchEvent(new CustomEvent("ping:analytics-choice", { detail: { choice } }));
}

export default function Phase22StorageChoice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readAnalyticsChoice()) return;
    clearAnalyticsSessionStorage();
    const timer = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(timer);
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
        <p>Ping uses necessary browser storage for sign-in and preferences. Optional product analytics stays off unless you allow it.</p>
        <a href="/cookies">Storage details</a>
      </div>
      <div className="phase22-storage-actions">
        <button type="button" onClick={() => choose("necessary")}>Only necessary</button>
        <button type="button" className="allow" onClick={() => choose("allow")}>Allow analytics</button>
      </div>
      <style jsx global>{`
        .phase22-storage-choice{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:390;width:min(calc(100% - 28px),430px);background:#172019;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:16px;box-shadow:0 18px 55px rgba(10,18,12,.28);display:grid;gap:13px}.phase22-storage-choice strong{font-size:14px}.phase22-storage-choice p{margin:5px 0 7px;color:#d5ddd5;font-size:11px;line-height:1.45}.phase22-storage-choice a{color:#c8efc5;font-size:10px;font-weight:850;text-underline-offset:3px}.phase22-storage-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.phase22-storage-actions button{border:1px solid #5b695e;background:transparent;color:#fff;border-radius:13px;padding:11px 8px;font-size:11px;font-weight:900}.phase22-storage-actions button.allow{background:#59d951;color:#123214;border-color:#59d951}@media(max-width:520px){.phase22-storage-choice{bottom:max(12px,env(safe-area-inset-bottom));width:calc(100% - 20px)}}
      `}</style>
    </aside>
  );
}
