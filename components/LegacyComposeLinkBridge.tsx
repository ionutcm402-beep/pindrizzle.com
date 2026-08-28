"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function shouldUseBrowserNavigation(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export default function LegacyComposeLinkBridge() {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || shouldUseBrowserNavigation(event)) return;
      const target = event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href='/#ping'],a[href='#ping']")
        : null;
      if (!target) return;

      event.preventDefault();
      router.push("/compose-start");
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return null;
}
