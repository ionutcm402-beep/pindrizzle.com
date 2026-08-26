"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type RangeDays = 7 | 30 | 90;
type Summary = {
  window_days: number;
  sessions: number;
  returning_sessions: number;
  location_enabled_sessions: number;
  quiet_feed_sessions: number;
  quiet_recovery_sessions: number;
  quiet_expand_sessions: number;
  quiet_map_sessions: number;
  quiet_create_sessions: number;
};

function firstRow(value: unknown): Summary | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    window_days: Number(row.window_days || 0),
    sessions: Number(row.sessions || 0),
    returning_sessions: Number(row.returning_sessions || 0),
    location_enabled_sessions: Number(row.location_enabled_sessions || 0),
    quiet_feed_sessions: Number(row.quiet_feed_sessions || 0),
    quiet_recovery_sessions: Number(row.quiet_recovery_sessions || 0),
    quiet_expand_sessions: Number(row.quiet_expand_sessions || 0),
    quiet_map_sessions: Number(row.quiet_map_sessions || 0),
    quiet_create_sessions: Number(row.quiet_create_sessions || 0),
  };
}

function pct(part: number, whole: number) {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

export default function Phase26BetaValidationOps() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [range, setRange] = useState<RangeDays>(7);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [status, setStatus] = useState("Loading validation signals…");

  useEffect(() => {
    if (window.location.pathname !== "/ops") return;
    setTarget(document.querySelector<HTMLElement>(".ops-screen"));
  }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setAllowed(false);
      setStatus("");
      return;
    }
    const moderator = await supabase.rpc("is_moderator");
    if (moderator.error || !moderator.data) {
      setAllowed(false);
      setStatus("");
      return;
    }
    setAllowed(true);
    setStatus("Loading validation signals…");
    const result = await supabase.rpc("ops_beta_validation_summary", { range_days: range });
    if (result.error) {
      setSummary(null);
      setStatus("Beta validation metrics could not load right now.");
      return;
    }
    setSummary(firstRow(result.data));
    setStatus("");
  }, [range]);

  useEffect(() => { if (target) void load(); }, [target, load]);

  if (!target || !allowed) return null;

  return createPortal(
    <section className="phase26-validation-card" aria-label="Beta validation">
      <div className="phase26-validation-head">
        <div><span>BETA VALIDATION</span><h2>Is Ping becoming useful?</h2><p>Consent-based, session-level signals only. No location history or personal activity timeline.</p></div>
        <div className="phase26-validation-range" aria-label="Validation range">
          {([7, 30, 90] as RangeDays[]).map((days) => <button type="button" key={days} className={range === days ? "active" : ""} onClick={() => setRange(days)}>{days}d</button>)}
        </div>
      </div>

      {status && <div className="phase26-validation-status">{status}</div>}

      {summary && (
        <>
          <div className="phase26-validation-grid">
            <article><span>Return signal</span><strong>{pct(summary.returning_sessions, summary.sessions)}</strong><small>{summary.returning_sessions} of {summary.sessions} sessions came back after 6h+</small></article>
            <article><span>Location activation</span><strong>{pct(summary.location_enabled_sessions, summary.sessions)}</strong><small>{summary.location_enabled_sessions} sessions reached live nearby mode</small></article>
            <article><span>Quiet-area recovery</span><strong>{pct(summary.quiet_recovery_sessions, summary.quiet_feed_sessions)}</strong><small>{summary.quiet_recovery_sessions} of {summary.quiet_feed_sessions} quiet sessions took a useful next step</small></article>
          </div>

          <div className="phase26-recovery-mix">
            <div><span>When the Feed was quiet</span><strong>{summary.quiet_feed_sessions} sessions</strong></div>
            <div className="phase26-recovery-bars">
              <span><b style={{ width: `${summary.quiet_feed_sessions ? Math.min(100, (summary.quiet_expand_sessions / summary.quiet_feed_sessions) * 100) : 0}%` }} />Widened area · {summary.quiet_expand_sessions}</span>
              <span><b style={{ width: `${summary.quiet_feed_sessions ? Math.min(100, (summary.quiet_map_sessions / summary.quiet_feed_sessions) * 100) : 0}%` }} />Opened Map · {summary.quiet_map_sessions}</span>
              <span><b style={{ width: `${summary.quiet_feed_sessions ? Math.min(100, (summary.quiet_create_sessions / summary.quiet_feed_sessions) * 100) : 0}%` }} />Started a Ping · {summary.quiet_create_sessions}</span>
            </div>
          </div>

          <p className="phase26-validation-note">Interpretation: these are browser-session signals, not unique people. Use them to compare beta behaviour over time, not as precise user counts.</p>
        </>
      )}
    </section>,
    target,
  );
}
