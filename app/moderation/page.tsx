"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Priority = "critical" | "urgent" | "elevated" | "standard";
type QueueFilter = "all" | Priority;
type ViewMode = "queue" | "history";
type ContentType = "ping" | "chat_message";

type ModerationCase = {
  target_type: ContentType;
  target_id: string;
  content_title: string;
  content_body: string;
  content_status: string;
  content_owner_name: string;
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
  target_type: ContentType;
  target_id: string;
  content_title: string;
  content_body: string;
  content_status: string;
  content_owner_name: string;
  reports_on_target: number;
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
  csam: "Child sexual abuse material",
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
  if (value === "critical") return "Critical child-safety review";
  if (value === "urgent") return "Urgent review";
  if (value === "elevated") return "Elevated";
  return "Standard";
}

function contentLabel(type: ContentType) {
  return type === "chat_message" ? "Local Chat" : "Pin";
}

export default function ModerationPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [cases, setCases] = useState<ModerationCase[]>([]);
  const [history, setHistory] = useState<ModerationHistory[]>([]);
  const [pendingPromotions, setPendingPromotions] = useState(0);
  const [view, setView] = useState<ViewMode>("queue");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
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
      supabase.rpc("moderation_content_cases"),
      supabase.rpc("moderation_content_history", { result_limit: 100 }),
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
    critical: cases.filter((row) => row.priority_label === "critical").length,
    urgent: cases.filter((row) => row.priority_label === "urgent").length,
  }), [cases]);

  const filteredCases = useMemo(() => filter === "all" ? cases : cases.filter((row) => row.priority_label === filter), [cases, filter]);

  const inspectPing = (row: ModerationCase | ModerationHistory) => {
    if (row.target_type !== "ping") return;
    window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { id: row.target_id, live: true } }));
  };

  const act = async (row: ModerationCase, action: "dismiss" | "remove") => {
    const key = `${row.target_type}:${row.target_id}`;
    const note = (notes[key] || "").trim();
    if (note.length < 4) {
      setMessage(row.target_type === "chat_message"
        ? "Add a clear decision reason. If you remove this Local Chat message, that reason is shown to its author."
        : "Add a short decision note before resolving this case.");
      return;
    }

    const noun = row.target_type === "chat_message" ? "Local Chat message" : "Pin";
    if (action === "remove" && !window.confirm(`Remove this ${noun} for everyone and resolve all ${row.pending_reports} pending reports on it?`)) return;

    setBusyTarget(key);
    setMessage("");
    try {
      const { data, error } = await createClient().rpc("moderate_content_case", {
        target_type: row.target_type,
        target_id: row.target_id,
        moderation_action: action,
        moderation_notes: note,
      });
      if (error) throw error;
      const reviewed = Number(data || row.pending_reports || 1);
      setNotes((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setMessage(action === "remove"
        ? `${noun} removed and ${reviewed} pending ${reviewed === 1 ? "report was" : "reports were"} resolved.`
        : `${reviewed} pending ${reviewed === 1 ? "report was" : "reports were"} dismissed. The ${noun} remains live.`);
      await load(true);
    } catch (error) {
      console.error("Content moderation failed", error);
      setMessage("That case could not be resolved. Refresh and try again.");
    } finally {
      setBusyTarget(null);
    }
  };

  return (
    <main className="ops-screen">
      <header className="ops-header">
        <a href="/you" aria-label="Back to You">‹</a>
        <div><div className="brand small">Pindrizzle</div><h1>Moderation ops</h1><p>One queue for reported pins and Local Chat messages.</p></div>
      </header>

      {allowed === null && <section className="ops-state">Checking moderator access…</section>}
      {allowed === false && <section className="ops-state"><strong>Moderator access required.</strong><p>This area is not available to ordinary accounts.</p></section>}

      {allowed && (
        <>
          <section className="ops-intro">
            <div aria-hidden="true">🛡️</div>
            <div><strong>Human decisions only.</strong><p>Priority orders the queue; it never removes content automatically. Reports on the same Pin or Chat message are handled as one case.</p></div>
          </section>

          {summary.critical > 0 && <section className="ops-critical-banner" role="alert">
            <strong>{summary.critical} critical child-safety {summary.critical === 1 ? "case" : "cases"}</strong>
            <p>Review immediately. A CSAM allegation is not itself an automated external report. If human review confirms content that creates a reporting or preservation duty, follow the approved safety/legal escalation process.</p>
          </section>}

          {message && <div className="ops-message" role="status">{message}</div>}

          <section className="ops-summary" aria-label="Moderation summary">
            <button type="button" onClick={() => { setView("queue"); setFilter("all"); }}><strong>{summary.cases}</strong><span>Open cases</span></button>
            <button type="button" onClick={() => { setView("queue"); setFilter("critical"); }}><strong>{summary.critical}</strong><span>Critical</span></button>
            <button type="button" onClick={() => { setView("queue"); setFilter("urgent"); }}><strong>{summary.urgent}</strong><span>Urgent</span></button>
            <div><strong>{summary.reports}</strong><span>Pending reports</span></div>
            <a href="/moderation/promotions"><strong>{pendingPromotions}</strong><span>Promotions</span></a>
          </section>

          <nav className="ops-links" aria-label="Moderation tools">
            <a href="/moderation/promotions">Promotions</a>
            <a href="/moderation/compliance">Compliance</a>
            <a href="/moderation/beta">Closed beta</a>
            <a href="/moderation/launch">Launch readiness</a>
          </nav>

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
                {(["all", "critical", "urgent", "elevated", "standard"] as QueueFilter[]).map((value) => (
                  <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                    {value === "all" ? "All" : priorityLabel(value)}
                  </button>
                ))}
              </section>

              <section className="ops-list">
                {filteredCases.length ? filteredCases.map((row) => {
                  const key = `${row.target_type}:${row.target_id}`;
                  const working = busyTarget === key;
                  const chat = row.target_type === "chat_message";
                  return (
                    <article key={key} className={`ops-case priority-${row.priority_label}`}>
                      <div className="ops-case-top">
                        <span className={`ops-priority priority-${row.priority_label}`}>{priorityLabel(row.priority_label)}</span>
                        <span className="ops-content-type">{contentLabel(row.target_type)}</span>
                        <span className="ops-score">Triage {row.priority_score}</span>
                      </div>

                      {row.priority_label === "critical" && <div className="ops-critical-guidance"><strong>Critical child-safety path</strong><span>Review now. Preserve the decision record and follow the approved human escalation procedure if the allegation is substantiated.</span></div>}

                      <div className="ops-report-count"><strong>{row.pending_reports}</strong><span>{Number(row.pending_reports) === 1 ? "pending report" : "pending reports"}</span><small>{row.total_reports} total on this {chat ? "message" : "Pin"}</small></div>

                      <div className="ops-reasons">{(row.reasons || []).map((reason) => <span key={reason}>{reasonLabels[reason] || reason}</span>)}</div>

                      <h2>{row.content_title}</h2>
                      <p className="ops-body">{row.content_body}</p>
                      <div className="ops-meta"><span>Posted by <strong>{row.content_owner_name}</strong></span><span>Oldest report {relativeTime(row.oldest_reported_at)}</span></div>
                      {row.latest_details && <div className="ops-context"><strong>Latest report context</strong><p>{row.latest_details}</p></div>}

                      {!chat && <button type="button" className="ops-inspect" onClick={() => inspectPing(row)}>Inspect full Pin</button>}

                      <label className="ops-note">
                        <span>{chat ? "Decision reason" : "Decision note"} <b>required</b></span>
                        <textarea
                          value={notes[key] || ""}
                          onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))}
                          maxLength={500}
                          placeholder={chat ? "Explain the decision clearly. If removed, this reason is shown to the author." : "What did you review and why are you taking this action?"}
                          disabled={working}
                        />
                        <small>{(notes[key] || "").length}/500{chat ? " · removal reason shown to author" : ""}</small>
                      </label>

                      <div className="ops-actions">
                        <button type="button" onClick={() => void act(row, "dismiss")} disabled={working}>{working ? "Working…" : "Dismiss case"}</button>
                        <button type="button" className="danger" onClick={() => void act(row, "remove")} disabled={working}>{working ? "Working…" : `Remove ${chat ? "message" : "Pin"}`}</button>
                      </div>
                      <p className="ops-action-note">One human decision resolves every currently pending report on this item. The action remains in moderation history.</p>
                    </article>
                  );
                }) : <div className="ops-empty">{cases.length ? "No cases match this priority filter." : "The report queue is clear."}</div>}
              </section>
            </>
          ) : (
            <section className="ops-list ops-history-list">
              {history.length ? history.map((row) => (
                <article key={`${row.target_type}:${row.target_id}:${row.reviewed_at}`} className={`ops-history status-${row.case_status}`}>
                  <div className="ops-history-top"><span>{contentLabel(row.target_type)} · {row.case_status === "removed" ? "removed" : "case dismissed"}</span><small>{relativeTime(row.reviewed_at)}</small></div>
                  <h2>{row.content_title}</h2>
                  <p>{row.content_body}</p>
                  <div className="ops-meta"><span>Posted by <strong>{row.content_owner_name}</strong></span><span>{row.reviewed_reports} reviewed · {row.reports_on_target} total reports</span></div>
                  <div className="ops-review-record"><strong>{row.reviewed_by_name || "Moderator"}</strong><p>{row.review_notes || "No review note recorded."}</p></div>
                  {row.target_type === "ping" && <button type="button" className="ops-inspect" onClick={() => inspectPing(row)}>Inspect Pin record</button>}
                </article>
              )) : <div className="ops-empty">No moderation decisions are on record yet.</div>}
            </section>
          )}
        </>
      )}

      <style jsx global>{`
        .ops-screen{min-height:100%;padding:24px 20px 48px;color:#172019}.ops-header{display:flex;gap:14px;align-items:flex-start;padding:0 0 16px}.ops-header>a{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;text-decoration:none;color:#233329;background:#fff;border:1px solid #e4e9e3;font-size:29px;line-height:1;flex:none}.ops-header h1{font-size:29px;letter-spacing:-1px;margin:10px 0 0}.ops-header p{margin:3px 0 0;color:#778178;font-size:10px}.ops-state,.ops-intro,.ops-message,.ops-critical-banner,.ops-summary,.ops-links,.ops-refresh-row,.ops-tabs,.ops-filters,.ops-list{max-width:900px;margin-left:auto;margin-right:auto}.ops-state{padding:22px;border-radius:20px;background:#f2f4ef;color:#647168}.ops-state p{margin:6px 0 0;font-size:12px}.ops-intro{display:grid;grid-template-columns:42px 1fr;gap:11px;padding:15px;border-radius:19px;background:#edf5e9}.ops-intro>div:first-child{font-size:27px}.ops-intro strong{font-size:13px}.ops-intro p{margin:4px 0 0;color:#647168;font-size:10px;line-height:1.5}.ops-message{margin-top:10px;padding:11px 12px;border-radius:13px;background:#eaf7e7;color:#2f6035;font-size:10px;font-weight:750}.ops-critical-banner{margin-top:10px;padding:14px 15px;border:1px solid #e59a92;border-radius:15px;background:#fff0ef;color:#7d2822}.ops-critical-banner strong{font-size:13px}.ops-critical-banner p{margin:5px 0 0;font-size:10px;line-height:1.5}.ops-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-top:12px}.ops-summary button,.ops-summary div,.ops-summary a{min-height:54px;border:0;text-decoration:none;color:#1d2720;padding:9px 4px;border-radius:14px;background:#f2f4ef;text-align:center;font:inherit}.ops-summary button,.ops-summary a{cursor:pointer}.ops-summary strong{display:block;font-size:18px}.ops-summary span{display:block;margin-top:2px;color:#788279;font-size:8px;font-weight:800}.ops-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.ops-links a{min-height:44px;display:inline-flex;align-items:center;padding:0 12px;border:1px solid #e0e6e0;border-radius:999px;background:#fff;color:#42614b;text-decoration:none;font-size:9px;font-weight:800}.ops-refresh-row{display:flex;align-items:center;justify-content:space-between;margin-top:12px;color:#8a938b;font-size:9px}.ops-refresh-row button{min-height:44px;border:0;background:transparent;color:#3f7044;font-weight:800}.ops-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;padding:4px;border-radius:14px;background:#edf0ec}.ops-tabs button{min-height:44px;border:0;border-radius:10px;background:transparent;color:#69746b;font-size:10px;font-weight:850}.ops-tabs button.active{background:#fff;color:#1e3021;box-shadow:0 2px 7px rgba(20,30,22,.07)}.ops-tabs span{margin-left:4px}.ops-filters{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.ops-filters button{min-height:44px;border:1px solid #e0e5de;border-radius:999px;background:#fff;padding:0 12px;color:#657067;font-size:9px;font-weight:800}.ops-filters button.active{background:#17261b;color:#fff;border-color:#17261b}.ops-list{display:grid;gap:12px;margin-top:12px}.ops-case,.ops-history{padding:17px;border:1px solid #e2e7e1;border-radius:19px;background:#fff;box-shadow:0 8px 23px rgba(24,34,25,.05)}.ops-case.priority-critical{border-color:#e3938a;box-shadow:0 0 0 2px rgba(190,55,44,.08)}.ops-case.priority-urgent{border-color:#e8b1a5}.ops-case-top{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.ops-priority,.ops-content-type,.ops-score{display:inline-flex;align-items:center;min-height:27px;border-radius:999px;padding:0 8px;font-size:8px;font-weight:900}.ops-priority{background:#eef2ed;color:#536057}.ops-priority.priority-critical{background:#b42318;color:#fff}.ops-priority.priority-urgent{background:#fff0ec;color:#a14d3f}.ops-priority.priority-elevated{background:#fff7e4;color:#876623}.ops-content-type{background:#eaf5f7;color:#146879}.ops-score{margin-left:auto;background:#f2f4ef;color:#788279}.ops-critical-guidance{display:grid;gap:3px;margin-top:10px;padding:11px 12px;border-radius:12px;background:#fff0ef;color:#7d2822}.ops-critical-guidance strong{font-size:10px}.ops-critical-guidance span{font-size:9px;line-height:1.45}.ops-report-count{display:flex;align-items:baseline;gap:6px;margin-top:12px}.ops-report-count strong{font-size:22px}.ops-report-count span{font-size:10px;font-weight:800}.ops-report-count small{margin-left:auto;color:#849086;font-size:8px}.ops-reasons{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.ops-reasons span{padding:5px 7px;border-radius:999px;background:#f1f3ef;color:#606c63;font-size:8px;font-weight:800}.ops-case h2,.ops-history h2{margin:14px 0 7px;font-size:18px;letter-spacing:-.3px}.ops-body,.ops-history>p{margin:0;color:#606b62;font-size:11px;line-height:1.55;white-space:pre-wrap}.ops-meta{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:10px;color:#89918a;font-size:8px}.ops-context,.ops-review-record{margin-top:11px;padding:10px 11px;border-radius:12px;background:#f4f6f2}.ops-context strong,.ops-review-record strong{font-size:9px}.ops-context p,.ops-review-record p{margin:4px 0 0;color:#707a72;font-size:9px;line-height:1.5}.ops-inspect{min-height:44px;margin-top:9px;border:0;background:transparent;color:#376c42;padding:0;font-size:9px;font-weight:850}.ops-note{display:grid;gap:6px;margin-top:12px}.ops-note>span{font-size:9px;font-weight:850}.ops-note b{color:#9e493f}.ops-note textarea{min-height:86px;border:1px solid #dfe5dc;border-radius:12px;padding:10px;resize:vertical;font-size:10px}.ops-note small{text-align:right;color:#8b948c;font-size:8px}.ops-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.ops-actions button{min-height:44px;border:1px solid #dce3da;border-radius:11px;background:#f5f7f3;color:#516055;font-size:9px;font-weight:850}.ops-actions button.danger{background:#8f3029;border-color:#8f3029;color:#fff}.ops-actions button:disabled{opacity:.5}.ops-action-note{margin:7px 0 0;color:#8a938c;font-size:8px;line-height:1.45}.ops-empty{padding:26px;border:1px dashed #dfe5dc;border-radius:16px;text-align:center;color:#788379;font-size:11px}.ops-history-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.ops-history-top span{font-size:9px;font-weight:900}.ops-history-top small{color:#88928a;font-size:8px}@media(max-width:700px){.ops-screen{padding:16px 12px 36px}.ops-summary{grid-template-columns:repeat(2,1fr)}.ops-summary>a:last-child{grid-column:1/-1}.ops-report-count{align-items:flex-start;flex-wrap:wrap}.ops-report-count small{width:100%;margin-left:0}.ops-actions{grid-template-columns:1fr}.ops-case,.ops-history{padding:14px}}
      `}</style>
    </main>
  );
}
