"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const routeNames: Record<string, string> = {
  "/": "Feed",
  "/map": "Map",
  "/search": "Search",
  "/place": "Local area",
  "/alerts": "Alerts",
  "/following": "Following",
  "/you": "Your profile",
  "/promote": "Promote",
  "/business": "Promoter dashboard",
  "/moderation": "Moderation",
  "/moderation/promotions": "Promotion moderation",
  "/ops": "Operations",
};

export default function Phase21AccessibilityBridge() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState("");

  const label = useMemo(() => {
    if (pathname.startsWith("/profile/")) return "Public profile";
    return routeNames[pathname] || "Ping";
  }, [pathname]);

  useEffect(() => {
    document.title = `${label} — Ping`;

    const main = document.querySelector<HTMLElement>("main");
    if (main) {
      main.id = "ping-primary-content";
      if (!main.hasAttribute("tabindex")) main.tabIndex = -1;
    }

    document.querySelectorAll<HTMLElement>('nav[aria-label="Primary navigation"] .active').forEach((item) => {
      item.setAttribute("aria-current", "page");
    });
    document.querySelectorAll<HTMLElement>('nav[aria-label="Primary navigation"] a:not(.active),nav[aria-label="Primary navigation"] button:not(.active)').forEach((item) => {
      item.removeAttribute("aria-current");
    });
    document.querySelectorAll<HTMLElement>('nav[aria-label="Primary navigation"] a > span,nav[aria-label="Primary navigation"] button > span').forEach((icon) => {
      icon.setAttribute("aria-hidden", "true");
    });

    const timer = window.setTimeout(() => setAnnouncement(`${label} loaded`), 80);
    return () => window.clearTimeout(timer);
  }, [label, pathname]);

  useEffect(() => {
    const keyboardParity = (event: KeyboardEvent) => {
      if (event.key !== " ") return;
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[role="button"]') : null;
      if (!target || target.tagName === "BUTTON" || target.tagName === "A") return;
      event.preventDefault();
      target.click();
    };
    document.addEventListener("keydown", keyboardParity);
    return () => document.removeEventListener("keydown", keyboardParity);
  }, []);

  const skipToContent = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const main = document.querySelector<HTMLElement>("#ping-primary-content") || document.querySelector<HTMLElement>("main");
    if (!main) return;
    event.preventDefault();
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: "start" });
  };

  return (
    <>
      <a className="phase21-skip-link" href="#ping-primary-content" onClick={skipToContent}>Skip to main content</a>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </>
  );
}
