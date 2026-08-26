"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RangeDays = 7 | 30 | 90;

type Summary = {
  window_days: number;
  sessions: number;
  signed_in_sessions: number;
  feed_sessions: number;
  map_sessions: number;
  search_sessions: number;
  ping_open_sessions: number;
  new_profiles: number;
  pings_created: number;
  replies_created: number;
  confirmations_created: number;
  reports_created: number;
  promotion_requests: number;
  paid_promotions: number;
  revenue_pence: number;
};

type DailyMetric = {
  metric_day: string;
  sessions: number;
  signed_in_sessions: number;
  new_profiles: number;
  pings_created: number;
  replies_created: number;
  confirmations_created: number;
  reports_created: number;
  promotion_requests: number;
  paid_promotions: number;
  revenue_pence: number;
};

type Health = {
  live_pings: number;
  open_report_cases: number;
  report_cases_over_24h: number;
  pending_promotions: number;
  active_promotions: number;
  promotion_anomalies: number;
  active_push_devices: number;
  notifications_24h: number;
  push_attempts_24h: number;
  push_delivered_24h: number;
  push_failed_24h: number;
};

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null;
  if (value && typeof value === "object") return value as T;
  return null;
}

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function percent(part: number, whole: number) {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function dayLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normaliseSummary(row: Summary | null): Summary | null {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, n(value)])) as unknown as Summary;
}

function normaliseHealth(row: Health | null): Health | null {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, n(value)])) as unknown as Health;
}

export default function OpsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [range, setRange] = useState<RangeDays>(7);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setAllowed(false);
      setSummary(null);
      setDaily([]);
      setHealth(null);
      return;
    }

    const { data: moderatorData, error: moderatorError } = await supabase.rpc("is_moderator");
    if (moderatorError || !Boolean(moderatorData)) {
      setAllowed(false);
      return;
    }

    setAllowed(true);
    setMessage("");
    const [summaryResult, dailyResult, healthResult] = await Promise.all([
      supabase.rpc("ops_product_summary", { range_days: range }),
      supabase.rpc("ops_daily_metrics", { range_days: range }),
      supabase.rpc("ops_health_snapshot"),
    ]);

    if (summaryResult.error || dailyResult.error || healthResult.error) {
      console.error("Ops metrics failed", summaryResult.error || dailyResult.error || healthResult.error);
      setMessage("Operations data could not refresh right now.");
      return;
    }

    setSummary(normaliseSummary(firstRow<Summary>(summaryResult.data)));
    setDaily(((dailyResult.data || []) as DailyMetric[]).map((row) => ({
      ...row,
      sessions: n(row.sessions),
      signed_in_sessions: n(row.signed_in_sessions),
      new_profiles: n(row.new_profiles),
      pings_created: n(row.pings_created),
      replies_created: n(row.replies_created),
      confirmations_created: n(row.confirmations_created),
      reports_created: n(row.reports_created),
      promotion_requests: n(row.promotion_requests),
      paid_promotions: n(row.paid_promotions),
      revenue_pence: n(row.revenue_pence),
    })));
    setHealth(normaliseHealth(firstRow<Health>(healthResult.data)));
    setLastUpdated(new Date());
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const pushRate = useMemo(() => health?.push_attempts_24h ? Math.round((health.push_delivered_24h / health.push_attempts_24h) * 100) : null, [health]);
  const engagement = summary ? summary.replies_created + summary.confirmations_created : 0;

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="ops-screen">
          <header className="ops-header">
            <a href="/you" aria-label="Back to You">‹</a>
            <div><div className="brand small">ping<span>.</span></div><h1>Operations</h1></div>
          </header>

          {allowed === null && <section className="ops-state">Checking operator access…</section>}
          {allowed === false && <section className="ops-state"><strong>Operator access required.</strong><p>This dashboard is not available to ordinary accounts.</p></section>}

          {allowed && (
            <>
              <section className="ops-intro">
                <div>◎</div>
                <div><strong>Product health without personal tracking.</strong><p>Session-level usage, real community activity and system health. No IP, location history or user timeline is stored here.</p></div>
              </section>

              <div className="ops-toolbar">
                <div className="ops-range" aria-label="Analytics range">
                  {([7, 30, 90] as RangeDays[]).map((days) => <button key={days} type="button" className={range === days ? "active" : ""} onClick={() => setRange(days)}>{days}d</button>)}
                </div>
                <small>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loading…"}</small>
              </div>
              {message && <div className="ops-message">{message}</div>}

              {summary && (
                <>
                  <section className="ops-kpis">
                    <article><span>Browser sessions</span><strong>{summary.sessions}</strong><small>{percent(summary.signed_in_sessions, summary.sessions)} had a signed-in event</small></article>
                    <article><span>New accounts</span><strong>{summary.new_profiles}</strong><small>{range}-day registrations</small></article>
                    <article><span>Pings created</span><strong>{summary.pings_created}</strong><small>{engagement} replies + confirms</small></article>
                    <article><span>Paid revenue</span><strong>{money(summary.revenue_pence)}</strong><small>{summary.paid_promotions} paid {summary.paid_promotions === 1 ? "promotion" : "promotions"}</small></article>
                  </section>

                  <section className="ops-section">
                    <div className="ops-section-title"><div><span>PRODUCT USE</span><h2>Where sessions go</h2></div><small>Session-level, not unique people</small></div>
                    <div className="ops-journey">
                      <article><strong>{summary.feed_sessions}</strong><span>Feed</span><small>{percent(summary.feed_sessions, summary.sessions)} of sessions</small></article>
                      <article><strong>{summary.map_sessions}</strong><span>Map</span><small>{percent(summary.map_sessions, summary.sessions)} of sessions</small></article>
                      <article><strong>{summary.search_sessions}</strong><span>Search</span><small>{percent(summary.search_sessions, summary.sessions)} of sessions</small></article>
                      <article><strong>{summary.ping_open_sessions}</strong><span>Opened a Ping</span><small>{percent(summary.ping_open_sessions, summary.sessions)} of sessions</small></article>
                    </div>
                  </section>
                </>
              )}

              {health && (
                <section className="ops-section">
                  <div className="ops-section-title"><div><span>HEALTH</span><h2>Operational signals</h2></div><small>Last 24h where noted</small></div>
                  <div className="ops-health-grid">
                    <article className={health.report_cases_over_24h ? "attention" : "good"}><div><strong>Moderation</strong><span>{health.open_report_cases} open cases</span></div><b>{health.report_cases_over_24h ? `${health.report_cases_over_24h} >24h` : "Current"}</b></article>
                    <article className={health.promotion_anomalies ? "attention" : "good"}><div><strong>Promotions</strong><span>{health.active_promotions} active · {health.pending_promotions} pending</span></div><b>{health.promotion_anomalies ? `${health.promotion_anomalies} anomaly` : "Consistent"}</b></article>
                    <article className={health.push_failed_24h ? "watch" : "good"}><div><strong>Push delivery</strong><span>{health.push_attempts_24h} attempts · {health.push_failed_24h} failed</span></div><b>{pushRate === null ? "No attempts" : `${pushRate}% delivered`}</b></article>
                    <article className="good"><div><strong>Local activity</strong><span>{health.live_pings} live Pings</span></div><b>{health.notifications_24h} alerts / 24h</b></article>
                    <article className="good"><div><strong>Push devices</strong><span>Enabled subscriptions</span></div><b>{health.active_push_devices}</b></article>
                  </div>
                </section>
              )}

              <section className="ops-section">
                <div className="ops-section-title"><div><span>TREND</span><h2>Daily activity</h2></div><small>UTC day buckets</small></div>
                <div className="ops-table-wrap">
                  <table className="ops-table">
                    <thead><tr><th>Day</th><th>Sessions</th><th>New</th><th>Pings</th><th>Replies</th><th>Confirms</th><th>Reports</th><th>Revenue</th></tr></thead>
                    <tbody>
                      {daily.map((row) => <tr key={row.metric_day}><td>{dayLabel(row.metric_day)}</td><td>{row.sessions}</td><td>{row.new_profiles}</td><td>{row.pings_created}</td><td>{row.replies_created}</td><td>{row.confirmations_created}</td><td>{row.reports_created}</td><td>{money(row.revenue_pence)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="ops-links">
                <a href="/moderation"><span>🛡️</span><div><strong>Moderation operations</strong><small>Work the report queue</small></div><b>›</b></a>
                <a href="/moderation/promotions"><span>↗</span><div><strong>Promotion review</strong><small>Review paid-placement requests</small></div><b>›</b></a>
                <a href="/business"><span>◎</span><div><strong>Promoter dashboard</strong><small>See the user-facing campaign experience</small></div><b>›</b></a>
              </section>

              <p className="ops-footnote">Deployment and serverless runtime errors remain visible in Vercel. This screen focuses on Ping’s product/database signals and intentionally avoids personal analytics profiles.</p>
            </>
          )}
        </main>

        <style jsx global>{`
          .ops-screen{min-height:100%;padding-bottom:42px}.ops-header{display:flex;gap:14px;align-items:flex-start;padding:24px 22px 18px}.ops-header>a{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;text-decoration:none;color:#233329;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:29px}.ops-header h1{font-size:31px;letter-spacing:-1px;margin:17px 0 0}.ops-state,.ops-intro,.ops-toolbar,.ops-message,.ops-kpis,.ops-section,.ops-links,.ops-footnote{margin-left:22px;margin-right:22px}.ops-state{padding:22px;border-radius:20px;background:#f2f4ef;color:#647168}.ops-state p{margin:6px 0 0;font-size:12px}.ops-intro{display:grid;grid-template-columns:42px 1fr;gap:11px;padding:16px;border-radius:19px;background:#edf5e9}.ops-intro>div:first-child{width:42px;height:42px;border-radius:14px;background:#dcefd6;display:grid;place-items:center;font-size:22px}.ops-intro strong{font-size:14px}.ops-intro p{margin:4px 0 0;color:#647168;font-size:10px;line-height:1.5}.ops-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:13px}.ops-range{display:flex;gap:5px;padding:4px;border-radius:13px;background:#eef1ec}.ops-range button{border:0;border-radius:9px;padding:7px 10px;background:transparent;color:#6f7a71;font-size:9px;font-weight:900}.ops-range button.active{background:#fff;color:#294c2d;box-shadow:0 3px 10px rgba(34,45,36,.07)}.ops-toolbar>small{font-size:8px;color:#8b948d}.ops-message{margin-top:10px;padding:10px 12px;border-radius:12px;background:#f8ece8;color:#845046;font-size:9px;font-weight:750}.ops-kpis{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.ops-kpis article{padding:14px;border:1px solid #e2e7df;border-radius:18px;background:#fff}.ops-kpis span,.ops-kpis small{display:block}.ops-kpis span{color:#7b867d;font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.04em}.ops-kpis strong{display:block;margin-top:7px;font-size:25px;letter-spacing:-.7px}.ops-kpis small{margin-top:3px;color:#89928a;font-size:8px}.ops-section{margin-top:22px}.ops-section-title{display:flex;justify-content:space-between;align-items:flex-end;gap:10px}.ops-section-title span{display:block;color:#728076;font-size:8px;font-weight:950;letter-spacing:.12em}.ops-section-title h2{font-size:19px;margin:3px 0 0;letter-spacing:-.35px}.ops-section-title>small{font-size:8px;color:#909890}.ops-journey{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.ops-journey article{padding:13px;border-radius:16px;background:#f2f4ef}.ops-journey strong{display:block;font-size:21px}.ops-journey span{display:block;margin-top:2px;font-size:10px;font-weight:900}.ops-journey small{display:block;margin-top:3px;color:#808a82;font-size:8px}.ops-health-grid{display:grid;gap:8px;margin-top:10px}.ops-health-grid article{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 14px;border-radius:16px;border:1px solid #e1e7df;background:#fff}.ops-health-grid article.good{border-color:#dce8d9;background:#f7fbf5}.ops-health-grid article.watch{border-color:#eee1bd;background:#fffaf0}.ops-health-grid article.attention{border-color:#efd1cb;background:#fff6f3}.ops-health-grid strong,.ops-health-grid span{display:block}.ops-health-grid strong{font-size:11px}.ops-health-grid span{margin-top:2px;color:#7d877f;font-size:8px}.ops-health-grid b{font-size:9px;white-space:nowrap}.ops-health-grid .good b{color:#3d7043}.ops-health-grid .watch b{color:#806719}.ops-health-grid .attention b{color:#94463d}.ops-table-wrap{overflow:auto;margin-top:10px;border:1px solid #e2e7df;border-radius:17px;background:#fff}.ops-table{border-collapse:collapse;min-width:620px;width:100%;font-size:8px}.ops-table th,.ops-table td{padding:10px 9px;text-align:right;border-bottom:1px solid #edf0eb}.ops-table th:first-child,.ops-table td:first-child{text-align:left}.ops-table th{color:#7a857c;font-size:7px;text-transform:uppercase;letter-spacing:.04em}.ops-table tbody tr:last-child td{border-bottom:0}.ops-table td{color:#384139;font-weight:750}.ops-links{display:grid;gap:8px;margin-top:22px}.ops-links a{display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;text-decoration:none;color:#263128;padding:12px 13px;border:1px solid #e1e6df;border-radius:16px;background:#fff}.ops-links a>span{width:36px;height:36px;border-radius:12px;background:#f0f4ed;display:grid;place-items:center}.ops-links strong,.ops-links small{display:block}.ops-links strong{font-size:11px}.ops-links small{margin-top:2px;color:#7c867e;font-size:8px}.ops-links b{color:#849087;font-size:20px}.ops-footnote{margin-top:18px;color:#8a938b;font-size:8px;line-height:1.5;text-align:center}
        `}</style>
      </div>
    </div>
  );
}
