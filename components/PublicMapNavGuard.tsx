"use client";

import { useEffect } from "react";

export default function PublicMapNavGuard() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const element = event.target as HTMLElement | null;
      const button = element?.closest<HTMLButtonElement>(".bottom-nav button");
      if (!button) return;

      const label = (button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (label !== "map") return;

      // Map is public. If an auth sheet is open for any reason, close it after
      // the existing React navigation handler switches the tab to Map.
      window.setTimeout(() => {
        const sheets = Array.from(document.querySelectorAll<HTMLElement>(".composer-backdrop"));
        for (const sheet of sheets) {
          const title = sheet.querySelector<HTMLElement>(".composer-header strong")?.textContent?.trim();
          if (title === "Join Ping") {
            sheet.querySelector<HTMLButtonElement>(".composer-header button")?.click();
          }
        }
      }, 0);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
