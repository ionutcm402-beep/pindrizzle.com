"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import PingIcon from "@/components/PingIcon";

function installedStandalone() {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return standalone || navigatorStandalone;
}

export default function Phase23InstallEntry() {
  const pathname = usePathname();
  const [target, setTarget] = useState<Element | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(installedStandalone());
    if (pathname !== "/you") {
      setTarget(null);
      return;
    }
    const timer = window.setTimeout(() => setTarget(document.querySelector("#you-account-settings") || document.querySelector(".settings-list")), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!target) return null;

  return createPortal(
    <button type="button" onClick={() => window.location.assign("/install")}>
      <span><PingIcon name="install" /></span><div><strong>{installed ? "Ping is installed" : "Install Ping"}</strong><small>{installed ? "See installed-app details" : "Add Ping to your home screen or desktop"}</small></div><b><PingIcon name="chevron" size={16} /></b>
    </button>,
    target,
  );
}
