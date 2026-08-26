"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PingIcon from "@/components/PingIcon";

type BetaState = { has_access: boolean; access_source: string | null; granted_at: string | null };
type ReleaseStage = "closed_beta" | "public";

export default function Phase24BetaBridge() {
  const pathname = usePathname();
  const [releaseStage, setReleaseStage] = useState<ReleaseStage>("closed_beta");
  const [signedIn, setSignedIn] = useState(false);
  const [state, setState] = useState<BetaState | null>(null);
  const [target, setTarget] = useState<Element | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const stageResult = await supabase.rpc("public_release_stage");
    const rawStage = Array.isArray(stageResult.data) ? stageResult.data[0] : stageResult.data;
    const currentStage: ReleaseStage = !stageResult.error && rawStage === "public" ? "public" : "closed_beta";
    setReleaseStage(currentStage);

    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user || null;
    setSignedIn(Boolean(user));

    if (currentStage === "public") {
      try { localStorage.removeItem("ping-beta-pending-invite"); } catch {}
      setState(null);
      return;
    }

    if (!user) {
      setState(null);
      return;
    }

    try {
      const pending = localStorage.getItem("ping-beta-pending-invite");
      if (pending) {
        const redeem = await supabase.rpc("redeem_beta_invite", { invite_code: pending.trim().toUpperCase() });
        if (!redeem.error) localStorage.removeItem("ping-beta-pending-invite");
      }
    } catch {}

    const result = await supabase.rpc("my_beta_state");
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    setState(row ? (row as BetaState) : { has_access: false, access_source: null, granted_at: null });
  }, []);

  useEffect(() => {
    void refresh();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => window.setTimeout(() => void refresh(), 0));
    const onRefresh = () => void refresh();
    window.addEventListener("ping:beta-refresh", onRefresh);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("ping:beta-refresh", onRefresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (pathname !== "/you" || releaseStage !== "closed_beta") {
      setTarget(null);
      return;
    }
    const timer = window.setTimeout(() => setTarget(document.querySelector("#you-admin-settings") || document.querySelector(".settings-list")), 0);
    return () => window.clearTimeout(timer);
  }, [pathname, releaseStage]);

  const entry = target && releaseStage === "closed_beta" ? createPortal(
    <button type="button" onClick={() => window.location.assign("/beta?from=/you")}>
      <span><PingIcon name="beta" /></span><div><strong>Closed beta</strong><small>{state?.has_access ? "Access active · send feedback" : signedIn ? "Invite required to participate" : "Tester access & feedback"}</small></div><b><PingIcon name="chevron" size={16} /></b>
    </button>,
    target,
  ) : null;

  return (
    <>
      {entry}
      {releaseStage === "closed_beta" && signedIn && state && !state.has_access && pathname !== "/beta" && (
        <div className="phase24-beta-banner" role="status">
          <div><strong>Ping is in closed beta.</strong><span>Your account can browse, but participation needs an invite.</span></div>
          <a href={`/beta?from=${encodeURIComponent(pathname)}`}>Enter invite</a>
        </div>
      )}
      <style jsx global>{`
        .phase24-beta-banner{position:fixed;z-index:180;left:50%;bottom:calc(92px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(calc(100% - 24px),430px);display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid #d7e6d3;border-radius:16px;background:rgba(248,250,245,.97);box-shadow:0 14px 38px rgba(25,36,27,.17);backdrop-filter:blur(10px)}.phase24-beta-banner strong,.phase24-beta-banner span{display:block}.phase24-beta-banner strong{font-size:10px;color:#234827}.phase24-beta-banner span{font-size:9px;color:#6d786f;margin-top:2px}.phase24-beta-banner a{flex:0 0 auto;border-radius:11px;background:#183924;color:#fff;text-decoration:none;padding:10px 11px;font-size:9px;font-weight:900}@media(max-width:360px){.phase24-beta-banner span{display:none}}
      `}</style>
    </>
  );
}
