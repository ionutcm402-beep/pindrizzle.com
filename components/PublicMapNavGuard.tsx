"use client";

import { useEffect } from "react";

export default function PublicMapNavGuard() {
  useEffect(() => {
    let forwarding = false;

    const closeAuthSheet = () => {
      const sheets = Array.from(document.querySelectorAll<HTMLElement>(".composer-backdrop"));
      for (const sheet of sheets) {
        const title = sheet.querySelector<HTMLElement>(".composer-header strong")?.textContent?.trim();
        if (title === "Join Ping") {
          sheet.querySelector<HTMLButtonElement>(".composer-header button")?.click();
        }
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (forwarding) return;

      const nav = (event.target as HTMLElement | null)?.closest<HTMLElement>(".bottom-nav");
      if (!nav) return;

      const rect = nav.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;
      const fraction = relativeX / rect.width;

      // The Map control is the second of five nav slots. Treat the visual
      // second slot as Map even if another element's hitbox overlaps it.
      const clickedMapSlot = fraction >= 0.2 && fraction < 0.4;
      if (!clickedMapSlot) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      closeAuthSheet();

      const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>("button"));
      const mapButton = buttons.find((button) =>
        (button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase() === "map",
      );

      if (mapButton) {
        forwarding = true;
        mapButton.click();
        forwarding = false;
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
