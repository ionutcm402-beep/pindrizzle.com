"use client";

import { useEffect } from "react";

export default function YouNavHardLink() {
  useEffect(() => {
    const bind = () => {
      const nav = document.querySelector<HTMLElement>(".bottom-nav");
      if (!nav) return;
      const controls = Array.from(nav.querySelectorAll<HTMLElement>("button,a"));
      const you = controls.find((control) => control.textContent?.trim().endsWith("You"));
      if (!you || you.dataset.youHardLink === "1") return;
      you.dataset.youHardLink = "1";

      const go = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign("/you");
      };

      you.addEventListener("pointerup", go, true);
      you.addEventListener("click", go, true);
    };

    bind();
    const observer = new MutationObserver(bind);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
