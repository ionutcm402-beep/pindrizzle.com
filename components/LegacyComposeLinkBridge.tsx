"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const COMPOSE_PREFLIGHT_KEY = "pindrizzle:compose-preflight";
const COMPOSE_PREFLIGHT_MAX_AGE_MS = 30_000;

function shouldUseBrowserNavigation(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function consumeComposePreflight() {
  try {
    const raw = window.sessionStorage.getItem(COMPOSE_PREFLIGHT_KEY);
    window.sessionStorage.removeItem(COMPOSE_PREFLIGHT_KEY);
    const timestamp = Number(raw);
    return Number.isFinite(timestamp) && Date.now() - timestamp >= 0 && Date.now() - timestamp <= COMPOSE_PREFLIGHT_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export default function LegacyComposeLinkBridge() {
  const router = useRouter();

  useEffect(() => {
    const guardComposeHash = () => {
      if (window.location.hash !== "#ping") return;
      if (consumeComposePreflight()) return;
      router.replace("/compose-start");
    };

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || shouldUseBrowserNavigation(event)) return;
      const target = event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href='/feed#ping'],a[href='/#ping'],a[href='#ping']")
        : null;
      if (!target) return;

      event.preventDefault();
      router.push("/compose-start");
    };

    guardComposeHash();
    window.addEventListener("hashchange", guardComposeHash);
    document.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("hashchange", guardComposeHash);
      document.removeEventListener("click", handleClick, true);
    };
  }, [router]);

  return null;
}
