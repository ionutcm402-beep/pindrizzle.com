"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import PingIcon from "@/components/PingIcon";

function installedStandalone() {
  if (typeof window === "undefined") return false;
  if (Capacitor.isNativePlatform()) return true;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return standalone || navigatorStandalone;
}

export default function Phase23InstallEntry() {
  const pathname = usePathname();
  const [target, setTarget] = useState<Element | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) { setInstalled(true); setTarget(null); return; }
    setInstalled(installedStandalone());
    if (pathname !== "/you") { setTarget(null); return; }
    const timer = window.setTimeout(() => setTarget(document.querySelector("#you-account-settings") || document.querySelector(".settings-list")), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!target) return null;

  return createPortal(
    <button type="button" onClick={() => window.location.assign("/install")}>
      <span><PingIcon name="install" /></span><div><strong>{installed ? "Pindrizzle is installed" : "Install Pindrizzle"}</strong><small>{installed ? "See installed-app details" : "Add Pindrizzle to your home screen or desktop"}</small></div><b><PingIcon name="chevron" size={16} /></b>
    </button>,
    target,
  );
}
