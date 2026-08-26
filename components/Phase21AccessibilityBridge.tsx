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
    const timer = window.setTimeout(() => setAnnouncement(`${label} loaded`), 80);
    return () => window.clearTimeout(timer);
  }, [label]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
}
