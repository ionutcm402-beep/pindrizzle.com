"use client";

import { useEffect } from "react";

export default function AlertsNavHardLink() {
  useEffect(() => {
    const bind = () => {
      const nav = document.querySelector<HTMLElement>(".bottom-nav");
      if (!nav) return;
      const controls = Array.from(nav.querySelectorAll<HTMLElement>("button,a"));
      const alerts = controls.find((control) => control.textContent?.replace(/\d+/g, "").trim().endsWith("Alerts"));
      if (!alerts || alerts.dataset.alertsHardLink === "1") return;
      alerts.dataset.alertsHardLink = "1";

      const go = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign("/alerts");
      };

      alerts.addEventListener("pointerup", go, true);
      alerts.addEventListener("click", go, true);
    };

    bind();
    const observer = new MutationObserver(bind);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
