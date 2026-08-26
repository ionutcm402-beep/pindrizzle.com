"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PingIcon from "@/components/PingIcon";

export default function Phase22LegalSettingsEntry() {
  const pathname = usePathname();
  const [privacyTarget, setPrivacyTarget] = useState<Element | null>(null);
  const [adminTarget, setAdminTarget] = useState<Element | null>(null);
  const [moderator, setModerator] = useState(false);

  useEffect(() => {
    if (pathname !== "/you") {
      setPrivacyTarget(null);
      setAdminTarget(null);
      setModerator(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setPrivacyTarget(document.querySelector("#you-privacy-settings") || document.querySelector(".settings-list"));
      setAdminTarget(document.querySelector("#you-admin-settings") || document.querySelector(".settings-list"));
    }, 0);
    void createClient().rpc("is_moderator").then(({ data, error }) => setModerator(!error && Boolean(data)));
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <>
      {privacyTarget && createPortal(
        <button type="button" onClick={() => window.location.assign("/privacy")}>
          <span><PingIcon name="legal" /></span><div><strong>Privacy, legal & data</strong><small>Analytics choice, data rights, Terms and Safety</small></div><b><PingIcon name="chevron" size={16} /></b>
        </button>,
        privacyTarget,
      )}
      {adminTarget && moderator && createPortal(
        <>
          <button type="button" onClick={() => window.location.assign("/moderation/compliance")}>
            <span><PingIcon name="review" /></span><div><strong>Compliance requests</strong><small>Privacy, safety complaints and appeals</small></div><b><PingIcon name="chevron" size={16} /></b>
          </button>
          <button type="button" onClick={() => window.location.assign("/moderation/launch")}>
            <span><PingIcon name="moderation" /></span><div><strong>Launch readiness</strong><small>Production gates, Stripe, SMTP and legal status</small></div><b><PingIcon name="chevron" size={16} /></b>
          </button>
        </>,
        adminTarget,
      )}
    </>
  );
}
