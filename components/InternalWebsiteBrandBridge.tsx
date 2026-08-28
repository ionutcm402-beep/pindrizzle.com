"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function InternalWebsiteBrandBridge() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ops" && !pathname.startsWith("/moderation")) return;

    const apply = () => {
      const brand = document.querySelector<HTMLElement>(".ops-header .brand.small");
      if (brand) brand.textContent = "Pindrizzle";

      if (pathname === "/ops") {
        const footnote = document.querySelector<HTMLElement>(".ops-footnote");
        if (footnote) {
          footnote.textContent = "Deployment and serverless runtime errors remain visible in Vercel. This screen focuses on Pindrizzle’s product/database signals and intentionally avoids personal analytics profiles.";
        }
      }
    };

    apply();
    const timer = window.setTimeout(apply, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
