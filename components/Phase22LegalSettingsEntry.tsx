"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Phase22LegalSettingsEntry() {
  const pathname = usePathname();
  const [target, setTarget] = useState<Element | null>(null);
  const [moderator, setModerator] = useState(false);

  useEffect(() => {
    if (pathname !== "/you") {
      setTarget(null);
      setModerator(false);
      return;
    }
    const timer = window.setTimeout(() => setTarget(document.querySelector(".settings-list")), 0);
    void createClient().rpc("is_moderator").then(({ data, error }) => setModerator(!error && Boolean(data)));
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!target) return null;

  return createPortal(
    <>
      <button type="button" onClick={() => window.location.assign("/privacy")}>
        <span>⚖️</span><div><strong>Privacy, legal & data</strong><small>Analytics choice, data rights, Terms and Safety</small></div><b>›</b>
      </button>
      {moderator && (
        <>
          <button type="button" onClick={() => window.location.assign("/moderation/compliance")}>
            <span>📋</span><div><strong>Compliance requests</strong><small>Privacy, safety complaints and appeals</small></div><b>›</b>
          </button>
          <button type="button" onClick={() => window.location.assign("/moderation/launch")}>
            <span>🚦</span><div><strong>Launch readiness</strong><small>Production gates, Stripe, SMTP and legal status</small></div><b>›</b>
          </button>
        </>
      )}
    </>,
    target,
  );
}
