"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

export default function Phase22LegalSettingsEntry() {
  const pathname = usePathname();
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    if (pathname !== "/you") {
      setTarget(null);
      return;
    }
    const timer = window.setTimeout(() => setTarget(document.querySelector(".settings-list")), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!target) return null;

  return createPortal(
    <button type="button" onClick={() => window.location.assign("/privacy")}>
      <span>⚖️</span><div><strong>Privacy, legal & data</strong><small>Analytics choice, data rights, Terms and Safety</small></div><b>›</b>
    </button>,
    target,
  );
}
