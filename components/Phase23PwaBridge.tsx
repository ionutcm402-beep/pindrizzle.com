"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export default function Phase23PwaBridge() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    let cancelled = false;
    const register = async () => {
      try {
        if (cancelled) return;
        await navigator.serviceWorker.register("/ping-sw.js", { scope: "/", updateViaCache: "none" });
      } catch (error) {
        console.error("Pindrizzle service worker registration failed", error);
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
