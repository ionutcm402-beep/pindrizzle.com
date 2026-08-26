"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PulseResult = "useful" | "needs_work";

const ELIGIBLE_PATHS = new Set(["/", "/map", "/search", "/alerts", "/you"]);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function numericStorage(key: string) {
  try { return Number(localStorage.getItem(key) || 0); } catch { return 0; }
}

export default function Phase26BetaPulse() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PulseResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [path, setPath] = useState("/");

  useEffect(() => {
    const currentPath = window.location.pathname;
    setPath(currentPath);
    if (!ELIGIBLE_PATHS.has(currentPath)) return;

    let cancelled = false;
    let timer = 0;

    const prepare = async () => {
      const now = Date.now();
      if (now - numericStorage("ping-beta-pulse-last-asked") < WEEK_MS) return;
      if (now - numericStorage("ping-beta-pulse-dismissed") < TWO_DAYS_MS) return;

      let visits = numericStorage("ping-beta-pulse-visits");
      try {
        if (!sessionStorage.getItem("ping-beta-pulse-counted")) {
          visits += 1;
          localStorage.setItem("ping-beta-pulse-visits", String(visits));
          sessionStorage.setItem("ping-beta-pulse-counted", "1");
        }
      } catch {}
      if (visits < 3) return;

      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user || cancelled) return;

      const [releaseResult, betaResult] = await Promise.all([
        supabase.rpc("public_release_stage"),
        supabase.rpc("my_beta_state"),
      ]);
      if (cancelled || releaseResult.error || betaResult.error) return;

      const stage = Array.isArray(releaseResult.data) ? releaseResult.data[0] : releaseResult.data;
      const betaRow = Array.isArray(betaResult.data) ? betaResult.data[0] : betaResult.data;
      if (String(stage || "closed_beta") !== "closed_beta" || !betaRow?.has_access) return;

      timer = window.setTimeout(() => {
        if (cancelled || document.visibilityState !== "visible") return;
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
        setVisible(true);
      }, 18000);
    };

    void prepare();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem("ping-beta-pulse-dismissed", String(Date.now())); } catch {}
    setVisible(false);
  };

  const submit = async (choice: PulseResult) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const useful = choice === "useful";
    const response = await createClient().rpc("submit_beta_feedback", {
      feedback_kind: useful ? "praise" : "confusing",
      feedback_message: useful
        ? "Quick beta pulse: Ping felt useful on this visit."
        : "Quick beta pulse: Ping did not feel useful enough on this visit.",
      feedback_page: path,
      feedback_rating: useful ? 5 : 2,
    });

    if (response.error) {
      setFailed(true);
      setBusy(false);
      return;
    }

    try {
      localStorage.setItem("ping-beta-pulse-last-asked", String(Date.now()));
      localStorage.removeItem("ping-beta-pulse-dismissed");
    } catch {}
    setResult(choice);
    setBusy(false);
  };

  if (!visible) return null;

  return (
    <aside className="phase26-beta-pulse" aria-live="polite" aria-label="Ping beta check-in">
      {!result ? (
        <>
          <div className="phase26-pulse-topline">
            <span>BETA CHECK-IN</span>
            <button type="button" onClick={dismiss} aria-label="Not now">×</button>
          </div>
          <strong>Was Ping useful on this visit?</strong>
          <p>One tap helps us learn whether the local experience is actually working.</p>
          <div className="phase26-pulse-actions">
            <button type="button" onClick={() => void submit("useful")} disabled={busy}>Yes, useful</button>
            <button type="button" onClick={() => void submit("needs_work")} disabled={busy}>Needs work</button>
          </div>
          {failed && <small>Couldn’t send that check-in. You can still leave detailed feedback from the beta page.</small>}
        </>
      ) : (
        <>
          <div className="phase26-pulse-topline"><span>THANK YOU</span><button type="button" onClick={() => setVisible(false)} aria-label="Close">×</button></div>
          <strong>{result === "useful" ? "That helps us measure what’s working." : "That’s useful to know."}</strong>
          <p>{result === "useful" ? "We’ll ask again only after you’ve had more time with Ping." : "Tell us what got in the way and we can turn it into a concrete fix."}</p>
          {result === "needs_work" && <a href={`/beta?from=${encodeURIComponent(path)}`}>Tell us what needs work</a>}
        </>
      )}
    </aside>
  );
}
