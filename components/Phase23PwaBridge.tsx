"use client";

import { useEffect } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __pindrizzleInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export default function Phase23PwaBridge() {
  useEffect(() => {
    const beforeInstall = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      window.__pindrizzleInstallPrompt = promptEvent;
      window.dispatchEvent(new Event("pindrizzle:install-available"));
    };

    const installed = () => {
      window.__pindrizzleInstallPrompt = null;
      window.dispatchEvent(new Event("pindrizzle:installed"));
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);

    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      return () => {
        window.removeEventListener("beforeinstallprompt", beforeInstall);
        window.removeEventListener("appinstalled", installed);
      };
    }

    let cancelled = false;
    const register = async () => {
      try {
        if (cancelled) return;
        await navigator.serviceWorker.register("/ping-sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
      } catch (error) {
        console.error("Pindrizzle service worker registration failed", error);
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  return null;
}
