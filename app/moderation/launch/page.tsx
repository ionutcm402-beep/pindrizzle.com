"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Gate = { key: string; label: string; ready: boolean; detail: string };
type Readiness = {
  checkedAt: string;
  stage: "closed_beta" | "public";
  stripeMode: "test" | "live" | "missing";
  livePaymentsEnabled: boolean;
  prerequisitesReady: boolean;
  publicAccessLive: boolean;
  paymentsLive: boolean;
  safeToOpenPublicAccess: boolean;
  safeToEnableLivePayments: boolean;
  gates: Gate[];
};

export default function LaunchReadinessPage() {
  const [data, setData] = useState<Readiness | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || "";
    if (!token) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    const response = await fetch("/api/launch/readiness", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as (Readiness & { error?: string }) | null;
    if (response.status === 403) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    if (!response.ok || !payload) {
      setAllowed(true);
      setMessage(payload?.error || "Launch readiness could not be checked.");
      setLoading(false);
      return;
    }

    setAllowed(true);
    setData(payload);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const readyCount = useMemo(() => data?.gates.filter((gate) => gate.ready).length || 0, [data]);
  const totalCount = data?.gates.length || 0;

  if (allowed === false) return <div className="legal-page"><div className="legal-shell"><main className="legal-content"><section className="legal-card legal-warning"><h2>Moderator access required</h2><p>This launch dashboard is intentionally hidden from ordinary accounts.</p><div className="legal-links"><a href="/you">Back to You</a></div></section></main></div></div>;

  return (
    <div className="legal-page">
      <div className="legal-shell">
        <header className="legal-head">
          <a className="legal-back" href="/you" aria-label="Back to You">‹</a>
          <div><span className="legal-kicker">PHASE 25 · MODERATOR ONLY</span><h1>Launch readiness</h1><p className="legal-updated">Fail-closed production gate · read-only</p></div>
        </header>
        <main className="legal-content">
          {loading && <section className="legal-card"><h2>Checking production gates…</h2></section>}
          {message && <div className="legal-status" role="status">{message}</div>}

          {data && (
            <>
              <section className={data.prerequisitesReady ? "legal-card legal-callout" : "legal-card legal-warning"}>
                <h2>{data.prerequisitesReady ? "Launch prerequisites complete" : "Public launch remains locked"}</h2>
                <p>{readyCount} of {totalCount} required production gates are complete. This screen cannot change release stage, environment variables, Stripe settings or Supabase Auth configuration.</p>
                <div className="launch25-state-grid">
                  <div><span>Release stage</span><strong>{data.stage === "public" ? "PUBLIC" : "CLOSED BETA"}</strong></div>
                  <div><span>Stripe mode</span><strong>{data.stripeMode.toUpperCase()}</strong></div>
                  <div><span>Public access</span><strong>{data.publicAccessLive ? "LIVE" : "LOCKED"}</strong></div>
                  <div><span>Payments</span><strong>{data.paymentsLive ? "LIVE" : "LOCKED"}</strong></div>
                </div>
              </section>

              <section className="legal-card">
                <h2>Required gates</h2>
                <div className="launch25-gates">
                  {data.gates.map((gate) => (
                    <article key={gate.key} className={gate.ready ? "ready" : "blocked"}>
                      <span aria-hidden="true">{gate.ready ? "✓" : "!"}</span>
                      <div><strong>{gate.label}</strong><p>{gate.detail}</p></div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="legal-card">
                <h2>Final switch order</h2>
                <ol>
                  <li>Resolve every blocked prerequisite above and run final signup/reset/payment smoke tests.</li>
                  <li>Merge Phase 25 only after explicit approval and verify the production build.</li>
                  <li>Set the Supabase release stage from <b>closed_beta</b> to <b>public</b>.</li>
                  <li>Enable <b>PING_LIVE_PAYMENTS_ENABLED=true</b> only after the correct Pindrizzle live Stripe key/webhook are deployed and verified.</li>
                  <li>Re-open this dashboard and confirm Public access and Payments both show LIVE.</li>
                </ol>
                <p><b>Rollback:</b> switch release stage back to closed beta and disable live payments first. Do not delete payment records or undo completed Stripe events.</p>
              </section>

              <section className="legal-card legal-warning">
                <h2>No bypass button by design</h2>
                <p>Pindrizzle deliberately has no “Launch anyway” control here. The final release requires operator/account configuration outside the app, followed by an explicit controlled switch.</p>
              </section>
            </>
          )}

          <div className="legal-links"><button type="button" className="legal-button primary" onClick={() => void load()} disabled={loading}>{loading ? "Checking…" : "Refresh gates"}</button><a href="/moderation">Moderation ops</a><a href="/moderation/compliance">Compliance queue</a></div>
        </main>
      </div>
      <style jsx global>{`
        .launch25-state-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}.launch25-state-grid div{padding:11px;border:1px solid rgba(30,63,35,.12);border-radius:14px;background:rgba(255,255,255,.58)}.launch25-state-grid span,.launch25-state-grid strong{display:block}.launch25-state-grid span{font-size:8px;color:#6f7a71;font-weight:850}.launch25-state-grid strong{margin-top:3px;font-size:12px}.launch25-gates{display:grid;gap:8px}.launch25-gates article{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:start;padding:12px;border-radius:15px;border:1px solid #e0e6dd}.launch25-gates article>span{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-weight:950}.launch25-gates article.ready>span{background:#e3f6df;color:#2d6c32}.launch25-gates article.blocked>span{background:#fae6df;color:#9a4238}.launch25-gates strong{font-size:11px}.launch25-gates p{margin:3px 0 0;font-size:9px;color:#6c786f;line-height:1.45}@media(max-width:620px){.launch25-state-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  );
}
