"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Phase22LegalSettingsEntry() {
  const pathname = usePathname();
  const [privacyTarget, setPrivacyTarget] = useState<Element | null>(null);
  const [internalTarget, setInternalTarget] = useState<Element | null>(null);
  const [moderator, setModerator] = useState(false);

  useEffect(() => {
    if (pathname !== "/you") {
      setPrivacyTarget(null);
      setInternalTarget(null);
      setModerator(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setPrivacyTarget(document.querySelector("#you-privacy-settings"));
      setInternalTarget(document.querySelector("#you-internal-settings"));
    }, 0);

    void createClient().rpc("is_moderator").then(({ data, error }) => setModerator(!error && Boolean(data)));
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <>
      {privacyTarget && createPortal(
        <button type="button" className="you-legal-entry" onClick={() => window.location.assign("/privacy")}>
          <span className="you-row-icon legal"/><div><strong>Privacy, legal & data</strong><small>Analytics choice, data rights, Terms and Safety</small></div><b>›</b>
        </button>,
        privacyTarget,
      )}

      {moderator && internalTarget && createPortal(
        <>
          <button type="button" className="you-compliance-entry" onClick={() => window.location.assign("/moderation/compliance")}>
            <span className="you-row-icon compliance"/><div><strong>Compliance requests</strong><small>Privacy, safety complaints and appeals</small></div><b>›</b>
          </button>
          <button type="button" className="you-launch-entry" onClick={() => window.location.assign("/moderation/launch")}>
            <span className="you-row-icon launch"/><div><strong>Launch readiness</strong><small>Production gates, Stripe, SMTP and legal status</small></div><b>›</b>
          </button>
        </>,
        internalTarget,
      )}
    </>
  );
}
