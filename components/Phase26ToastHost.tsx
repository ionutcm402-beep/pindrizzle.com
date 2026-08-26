"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ToastTone = "neutral" | "success" | "warning";
type Toast = { id: number; message: string; tone: ToastTone };
type ToastDetail = { message?: string; tone?: ToastTone };

function toneFor(message: string): ToastTone {
  const value = message.toLowerCase();
  if (value.includes("could not") || value.includes("couldn’t") || value.includes("failed") || value.includes("try again")) return "warning";
  if (value.includes("posted") || value.includes("saved") || value.includes("sent") || value.includes("copied")) return "success";
  return "neutral";
}

export default function Phase26ToastHost() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef(0);

  const show = useCallback((message: string, tone?: ToastTone) => {
    const clean = String(message || "").trim();
    if (!clean) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    idRef.current += 1;
    setToast({ id: idRef.current, message: clean, tone: tone || toneFor(clean) });
    timerRef.current = window.setTimeout(() => setToast(null), 4600);
  }, []);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message?: unknown) => show(String(message ?? ""));

    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      if (detail?.message) show(detail.message, detail.tone);
    };
    window.addEventListener("ping:toast", onToast as EventListener);

    return () => {
      window.alert = originalAlert;
      window.removeEventListener("ping:toast", onToast as EventListener);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [show]);

  if (!toast) return null;

  return (
    <div className={`phase26-toast phase26-toast-${toast.tone}`} role="status" aria-live="polite" key={toast.id}>
      <span aria-hidden="true">{toast.tone === "success" ? "✓" : toast.tone === "warning" ? "!" : "•"}</span>
      <p>{toast.message}</p>
      <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message">×</button>
    </div>
  );
}
