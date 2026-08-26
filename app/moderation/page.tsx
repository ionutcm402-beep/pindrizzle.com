"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Priority = "urgent" | "elevated" | "standard";
type QueueFilter = "all" | Priority;
type ViewMode = "queue" | "history";

type ModerationCase = {
  ping_id: string;
  ping_title: string;
  ping_body: string;
  ping_status: string;
  ping_owner_name: string;
  pending_reports: number;
  total_reports: number;
  reasons: string[];
  oldest_reported_at: string;
  latest_reported_at: string;
  priority_score: number;
  priority_label: Priority;
  latest_details: string | null;
};

type ModerationHistory = {
  ping_id: string;
  ping_title: string;
  ping_body: string;
  ping_status: string;
  ping_owner_name: string;
  reports_on_ping: number;
  reviewed_reports: number;
  case_status: "removed" | "dismissed";
  reviewed_at: string;
  reviewed_by_name: string;
  review_notes: string | null;
};

type PromotionRow = { promotion_status: string };

const reasonLabels: Record<string, string> = {
  incorrect: "Incorrect",
  spam: "Spam",
  unsafe: "Unsafe",
  harassment: "Harassment",
  dangerous: "Dangerous",
  privacy: "Privacy",
  other: "Other",
};

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function priorityLabel(value: Priority) {
  if (value === "urgent") return "Urgent review";
  if (value === "elevated") return "Elevated";
  return "Standard";
}

export default function ModerationPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [cases, setCases] = useState<ModerationCase[]>([]);
  const [history, setHistory] = useState<ModerationHistory[]>([]);
  const [pendingPromotions, setPendingPromotions] = useState(0);
  const [view, setView] = useState<ViewMode>("queue");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyPing, setBusyPing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setMessage("");
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setAllowed(false);
      return;
    }

    const { data: moderatorData, error: moderatorError } = await supabase.rpc("is_moderator");
    if (moderatorError || !Boolean(moderatorData)) {
      setAllowed(false);
      return;
    }

    setAllowed(true);
    const [caseResult, historyResult, promotionResult] = await Promise.all([
      supabase.rpc("moderation_report_cases"),
      supabase.rpc("moderation_case_history", { result_limit: 100 }),
      supabase.rpc("moderation_promotion_history"),
    ]);

    if (caseResult.error || historyResult.error || promotionResult.error) {
      console.error("Moderation operations failed", caseResult.error || historyResult.error || promotionResult.error);
      if (!silent) setMessage("Moderation operations could not refresh right now.");
      return;
    }

    setCases((caseResult.data || []) as ModerationCase[]);
    setHistory((historyResult.data || []) as ModerationHistory[]);
    setPendingPromotions(((promotionResult.data || []) as PromotionRow[]).filter((row) => row.promotion_status === "pending").length);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 30000);
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const summary = useMemo(() => ({
    cases: cases.length,
    reports: cases.reduce((sum, row) => sum + Number(row.pending_reports || 0), 0),
    urgent: cases.filter((row) => row.priority_label === "urgent").length,
  }), [cases]);

  const filteredCases = useMemo(() => (
    filter === "all" ? cases : cases.filter((row) => row.priority_label === filter)
  ), [cases, filter]);

  const inspect = (row: ModerationCase | ModerationHistory) => {
    window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { id: row.ping_id, live: true } }));
  };

  const act = async (row: ModerationCase, action: "dismiss" | "remove") => {
    const note = (notes[row.ping_id] || "").trim();
    if (note.length < 4) {
      setMessage("Add a short decision note before resolving this case.");
      return;
    }
    if (action === "remove" && !window.confirm(`Remove “${row.ping_title}” for everyone and resolve all ${row.pending_reports} pending reports on it?`)) return;

    setBusyPing(row.ping_id);
    setMessage("");
    try {
      const { data, error } = await createClient().rpc("moderate_ping_case", {
        target_ping_id: row.ping_id,
        moderation_action: action,
        moderation_notes: note,
      });
      if (error) throw error;
      const reviewed = Number(data || row.pending_reports || 1);
      setNotes((current) => {
        const next = { ...current };
        delete next[row.ping_id];
        return next;
      });
      setMessage(action === "remove"
        ? `Ping removed and ${reviewed} pending ${reviewed === 1 ? "report was" : "reports were"} resolved.`
        : `${reviewed} pending ${reviewed === 1 ? "report was" : "reports were"} dismissed. The Ping remains live.`);
      await load(true);
    } catch (error) {
      console.error("Case moderation failed", error);
      setMessage("That case could not be resolved. Refresh and try again.");
    } finally {
      setBusyPing(null);
    }
  };

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="ops-screen">
          <header className="ops-header">
            <a href="/you" aria-label="Back to You">‹</a>
            <div><div className="brand small">ping<span>.</span></div><h1>Moderation ops</h1><p>Review cases, record decisions, keep the audit trail clean.</p></div>
          </header>

          {allowed === null && <section className="ops-state">Checking moderator access…</section>}
          {allowed === false && <section className="ops-state"><strong>Moderator access required.</strong><p>This area is not available to ordinary accounts.</p></section>}

          {allowed && (
            <>
              <section className="ops-intro">
                <div>🛡️</div>
                <div><strong>Human decisions only.</strong><p>Priority helps order the queue; it never removes a Ping automatically. Duplicate reports on one Ping are handled as one case.</p></div>
              </section>

              {message && <div className="ops-message" role="status">{message}</div>}

              <section className="ops-summary" aria-label="Moderation summary">
                <button type="button" onClick={() => { setView("queue"); setFilter("all"); }}><strong>{summary.cases}</strong><span>Open cases</span></button>
                <button type="button" onClick={() => { setView("queue"); setFilter("urgent"); }}><strong>{summary.urgent}</strong><span>Urgent</span></button>
                <div><strong>{summary.reports}</strong><span>Pending reports</span></div>
                <a href="/moderation/promotions"><strong>{pendingPromotions}</strong><span>Promotions</span></a>
              </section>

              <div className="ops-refresh-row">
                <span>{lastUpdated ? `Updated ${relativeTime(lastUpdated.toISOString())}` : "Loading…"}</span>
                <button type="button" onClick={() => void load()}>Refresh</button>
              </div>

              <section className="ops-tabs" aria-label="Moderation views">
                <button type="button" className={view === "queue" ? "active" : ""} onClick={() => setView("queue")}>Queue <span>{cases.length}</span></button>
                <button type="button" className={view === "history" ? "active" : ""} onClick={() => setView("history")}>History <span>{history.length}</span></button>
              </section>

              {view === "queue" ? (
                <>
                  <section className="ops-filters" aria-label="Queue priority filter">
                    {(["all", "urgent", "elevated", "standard"] as QueueFilter[]).map((value) => (
                      <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                        {value === "all" ? "All" : priorityLabel(value)}
                      </button>
                    ))}
                  </section>

                  <section className="ops-list">
                    {filteredCases.length ? filteredCases.map((row) => {
                      const working = busyPing === row.ping_id;
                      return (
                        <article key={row.ping_id} className={`ops-case priority-${row.priority_label}`}>
                          <div className="ops-case-top">
                            <span className={`ops-priority priority-${row.priority_label}`}>{priorityLabel(row.priority_label)}</span>
                            <span className="ops-score">Triage {row.priority_score}</span>
                          </div>

                          <div className="ops-report-count"><strong>{row.pending_reports}</strong><span>{Number(row.pending_reports) === 1 ? "pending report" : "pending reports"}</span><small>{row.total_reports} total on this Ping</small></div>

                          <div className="ops-reasons">
                            {(row.reasons || []).map((reason) => <span key={reason}>{reasonLabels[reason] || reason}</span>)}
                          </div>

                          <h2>{row.ping_title}</h2>
                          <p className="ops-body">{row.ping_body}</p>
                          <div className="ops-meta"><span>Posted by <strong>{row.ping_owner_name}</strong></span><span>Oldest report {relativeTime(row.oldest_reported_at)}</span></div>
                          {row.latest_details && <div className="ops-context"><strong>Latest report context</strong><p>{row.latest_details}</p></div>}

                          <button type="button" className="ops-inspect" onClick={() => inspect(row)}>Inspect full Ping</button>

                          <label className="ops-note">
                            <span>Decision note <b>required</b></span>
                            <textarea
                              value={notes[row.ping_id] || ""}
                              onChange={(event) => setNotes((current) => ({ ...current, [row.ping_id]: event.target.value }))}
                              maxLength={500}
                              placeholder="What did you review and why are you taking this action?"
                              disabled={working}
                            />
                            <small>{(notes[row.ping_id] || "").length}/500</small>
                          </label>

                          <div className="ops-actions">
                            <button type="button" onClick={() => void act(row, "dismiss")} disabled={working}>{working ? "Working…" : "Dismiss case"}</button>
                            <button type="button" className="danger" onClick={() => void act(row, "remove")} disabled={working}>{working ? "Working…" : "Remove Ping"}</button>
                          </div>
                          <p className="ops-action-note">One decision resolves every currently pending report on this Ping. The action remains in moderation history.</p>
                        </article>
                      );
                    }) : <div className="ops-empty">{cases.length ? "No cases match this priority filter." : "The report queue is clear."}</div>}
                  </section>
                </>
              ) : (
                <section className="ops-list ops-history-list">
                  {history.length ? history.map((row) => (
                    <article key={`${row.ping_id}-${row.reviewed_at}`} className={`ops-history status-${row.case_status}`}>
                      <div className="ops-history-top"><span>{row.case_status === "removed" ? "Ping removed" : "Case dismissed"}</span><small>{relativeTime(row.reviewed_at)}</small></div>
                      <h2>{row.ping_title}</h2>
                      <p>{row.ping_body}</p>
                      <div className="ops-meta"><span>Posted by <strong>{row.ping_owner_name}</strong></span><span>{row.reviewed_reports} reviewed · {row.reports_on_ping} total reports</span></div>
                      <div className="ops-review-record"><strong>{row.reviewed_by_name || "Moderator"}</strong><p>{row.review_notes || "No review note recorded."}</p></div>
                      <button type="button" className="ops-inspect" onClick={() => inspect(row)}>Inspect Ping record</button>
                    </article>
                  )) : <div className="ops-empty">No moderation decisions are on record yet.</div>}
                </section>
              )}
            </>
          )}
        </main>

        <style jsx global>{`
          .ops-screen{min-height:100%;padding-bottom:38px}.ops-header{display:flex;gap:14px;align-items:flex-start;padding:24px 20px 16px}.ops-header>a{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;text-decoration:none;color:#233329;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:29px;line-height:1;flex:none}.ops-header h1{font-size:29px;letter-spacing:-1px;margin:16px 0 0}.ops-header p{margin:3px 0 0;color:#778178;font-size:9px}.ops-state,.ops-intro,.ops-message,.ops-summary,.ops-refresh-row,.ops-tabs,.ops-filters,.ops-list{margin-left:20px;margin-right:20px}.ops-state{padding:22px;border-radius:20px;background:#f2f4ef;color:#647168}.ops-state p{margin:6px 0 0;font-size:12px}.ops-intro{display:grid;grid-template-columns:42px 1fr;gap:11px;padding:15px;border-radius:19px;background:#edf5e9}.ops-intro>div:first-child{font-size:27px}.ops-intro strong{font-size:13px}.ops-intro p{margin:4px 0 0;color:#647168;font-size:9px;line-height:1.5}.ops-message{margin-top:10px;padding:11px 12px;border-radius:13px;background:#eaf7e7;color:#2f6035;font-size:10px;font-weight:750}.ops-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:12px}.ops-summary button,.ops-summary div,.ops-summary a{border:0;text-decoration:none;color:#1d2720;padding:11px 4px;border-radius:14px;background:#f2f4ef;text-align:center;font:inherit}.ops-summary button,.ops-summary a{cursor:pointer}.ops-summary strong{display:block;font-size:18px}.ops-summary span{display:block;margin-top:2px;color:#788279;font-size:7px;font-weight:800}.ops-refresh-row{display:flex;align-items:center;justify-content:space-between;margin-top:12px;color:#8a938b;font-size:8px}.ops-refresh-row button{border:0;background:transparent;color:#3f7040;font-size:9px;font-weight:900}.ops-tabs{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px;padding:4px;border-radius:14px;background:#ecefe9}.ops-tabs button{border:0;border-radius:10px;background:transparent;padding:10px;color:#747e76;font-size:10px;font-weight:900}.ops-tabs button.active{background:#fff;color:#1d4722;box-shadow:0 4px 12px rgba(31,41,32,.07)}.ops-tabs span{margin-left:4px;opacity:.6}.ops-filters{display:flex;gap:6px;overflow-x:auto;padding:12px 0 2px;scrollbar-width:none}.ops-filters::-webkit-scrollbar{display:none}.ops-filters button{white-space:nowrap;border:1px solid #dfe5dc;border-radius:999px;background:#fff;padding:7px 10px;color:#667168;font-size:8px;font-weight:850}.ops-filters button.active{border-color:#315d35;background:#315d35;color:#fff}.ops-list{display:grid;gap:12px;margin-top:10px}.ops-case,.ops-history{padding:15px;border:1px solid #e0e6de;border-radius:21px;background:#fff;box-shadow:0 12px 30px rgba(31,41,32,.05)}.ops-case.priority-urgent{border-color:#efc7c1}.ops-case.priority-elevated{border-color:#eadfb9}.ops-case-top,.ops-history-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.ops-priority,.ops-history-top>span{padding:6px 8px;border-radius:999px;font-size:8px;font-weight:950}.ops-priority.priority-urgent{background:#fbe8e5;color:#87382f}.ops-priority.priority-elevated{background:#fff3d3;color:#765711}.ops-priority.priority-standard{background:#edf2ec;color:#52645a}.ops-score,.ops-case-top small,.ops-history-top small{color:#889188;font-size:8px}.ops-report-count{display:flex;align-items:baseline;gap:6px;margin-top:11px}.ops-report-count strong{font-size:24px}.ops-report-count span{font-size:9px;font-weight:850}.ops-report-count small{margin-left:auto;color:#8a938c;font-size:8px}.ops-reasons{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.ops-reasons span{padding:5px 7px;border-radius:999px;background:#f4f6f2;color:#657068;font-size:7px;font-weight:850}.ops-case h2,.ops-history h2{font-size:17px;margin:12px 0 5px}.ops-body,.ops-history>p{margin:0;color:#59655d;font-size:11px;line-height:1.48}.ops-meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px;color:#7a847c;font-size:8px}.ops-context{margin-top:10px;padding:10px 11px;border-radius:12px;background:#f6f7f4}.ops-context strong{font-size:8px}.ops-context p{margin:4px 0 0;color:#6d786f;font-size:9px;line-height:1.45}.ops-inspect{width:100%;margin-top:10px;border:1px solid #dce3da;border-radius:11px;background:#fff;padding:9px;color:#365f3a;font-size:9px;font-weight:900}.ops-note{display:block;margin-top:11px}.ops-note>span{display:flex;justify-content:space-between;font-size:8px;font-weight:900;color:#59655d}.ops-note b{color:#87382f}.ops-note textarea{width:100%;min-height:74px;resize:vertical;margin-top:6px;border:1px solid #dfe5dc;border-radius:12px;background:#fbfcf9;padding:10px;color:#263129;font:inherit;font-size:10px;line-height:1.45;outline:none}.ops-note textarea:focus{border-color:#8db58b;box-shadow:0 0 0 3px rgba(89,217,81,.08)}.ops-note small{display:block;text-align:right;margin-top:3px;color:#939b94;font-size:7px}.ops-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.ops-actions button{border:1px solid #dbe2d9;border-radius:12px;background:#fff;padding:10px;font-size:9px;font-weight:900}.ops-actions button.danger{border-color:#8d3129;background:#8d3129;color:#fff}.ops-actions button:disabled{opacity:.5}.ops-action-note{margin:7px 1px 0;color:#8a938b;font-size:7px;line-height:1.4}.ops-empty{padding:28px;border:1px dashed #dfe5dc;border-radius:18px;text-align:center;color:#788379;font-size:11px}.ops-history-list{margin-top:12px}.ops-history.status-removed{background:#fffaf9}.ops-history.status-dismissed{background:#fbfcfa}.ops-history-top>span{background:#edf2ec;color:#52645a}.ops-history.status-removed .ops-history-top>span{background:#fbe8e5;color:#87382f}.ops-review-record{margin-top:10px;padding:10px 11px;border-radius:12px;background:#f1f4ef}.ops-review-record strong{font-size:8px}.ops-review-record p{margin:4px 0 0;color:#667168;font-size:9px;line-height:1.45}
        `}</style>
      </div>
    </div>
  );
}
