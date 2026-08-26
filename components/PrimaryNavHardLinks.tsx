"use client";

import { useEffect } from "react";

export default function PrimaryNavHardLinks() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>(".bottom-nav button");
      if (!control) return;

      const label = control.textContent?.replace(/\d+/g, "").trim() || "";
      let destination = "";
      if (label.endsWith("Alerts")) destination = "/alerts";
      if (label.endsWith("You")) destination = "/you";
      if (!destination) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(destination);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
