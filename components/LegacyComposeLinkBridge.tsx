"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function LegacyComposeLinkBridge() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const redirectLegacyFeedComposer = () => {
      if (pathname !== "/feed" || window.location.hash !== "#ping") return;
      router.replace("/#ping");
    };

    redirectLegacyFeedComposer();
    window.addEventListener("hashchange", redirectLegacyFeedComposer);
    return () => {
      window.removeEventListener("hashchange", redirectLegacyFeedComposer);
    };
  }, [pathname, router]);

  return null;
}
