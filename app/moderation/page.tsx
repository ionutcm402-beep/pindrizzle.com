"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ReportRow = {
  report_id: string;
  ping_id: string;
  reason: string;
  details: string | null;
  reported_at: string;
  ping_title: string;
  ping_body: string;
  ping_status: string;
  ping_owner_name: string;
  reporter_name: string;
  reports_on_ping: number;
  review_status: "pending" | "dismissed" | "removed";
  reviewed_at: string | null;
  reviewed_by_name: string;
  review_notes: string | null;
};

function reasonLabel(value: string) {
  const labels: Record<string, string> = {
    incorrect: "Incorrect or misleading",
    spam: "Spam or advertising",
    unsafe: "Unsafe or abusive",
    harassment: "Harassment",
    dangerous: "Dangerous content",
    privacy: "Privacy concern",
    other: "Other",
  };
  return labels[value] || value;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusLabel(status: ReportRow["review_status"]) {
  if (status === "dismissed") return "Dismissed";
  if (status === "removed") return "Ping removed";
  return "Pending review";
}

export default function ModerationPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
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
    const { data, error } = await supabase.rpc("moderation_report_history");
    if (error) {
      console.error("Moderation history failed", error);
      setMessage("The moderation history could not load right now.");
      return;
    }
    setRows((data || []) as ReportRow[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    pending: rows.filter((row) => row.review_status === "pending").length,
    dismissed: rows.filter((row) => row.review_status === "dismissed").length,
    removed: rows.filter((row) => row.review_status === "removed").length,
  }), [rows]);

  const act = async (row: ReportRow, action: "dismiss" | "remove") => {
    if (row.review_status !== "pending") return;
    if (action === "remove" && !window.confirm(`Remove “${row.ping_title}” from Ping for everyone?`)) return;
    setBusyId(row.report_id);
    setMessage("");
    try {
      const { error } = await createClient().rpc("moderate_report", {
        target_report_id: row.report_id,
        moderation_action: action,
        moderation_notes: action === "remove" ? "Removed after moderator review" : "Dismissed after moderator review",
      });
      if (error) throw error;
      setMessage(action === "remove" ? "Ping removed. The report stays in moderation history." : "Report dismissed. The Ping remains live and the report stays in history.");
      await load();
    } catch (error) {
      console.error("Moderation action failed", error);
      setMessage("That moderation action could not be completed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="moderation-screen">
          <header className="moderation-header">
            <a href="/you" aria-label="Back to You">‹</a>
            <div><div className="brand small">ping<span>.</span></div><h1>Moderation</h1></div>
          </header>

          {allowed === null && <section className="moderation-state">Checking moderator access…</section>}
          {allowed === false && <section className="moderation-state"><strong>Moderator access required.</strong><p>This area is not available to ordinary accounts.</p></section>}

          {allowed && (
            <>
              <section className="moderation-intro">
                <div>🛡️</div><div><strong>Every report stays on record.</strong><p>Pending reports can be dismissed or actioned. Reviewed reports remain here as an audit history.</p></div>
              </section>
              {message && <div className="moderation-message">{message}</div>}

              <section className="moderation-summary">
                <div><strong>{counts.pending}</strong><span>Pending</span></div>
                <div><strong>{counts.dismissed}</strong><span>Dismissed</span></div>
                <div><strong>{counts.removed}</strong><span>Removed</span></div>
              </section>

              <div className="moderation-count"><strong>{rows.length}</strong><span>{rows.length === 1 ? "report on record" : "reports on record"}</span></div>

              <section className="moderation-list">
                {rows.length ? rows.map((row) => (
                  <article key={row.report_id} className={`moderation-card status-${row.review_status}`}>
                    <div className="moderation-card-top">
                      <span className="reason-pill">{reasonLabel(row.reason)}</span>
                      <small>{relativeTime(row.reported_at)}</small>
                    </div>
                    <div className={`moderation-status status-${row.review_status}`}>{statusLabel(row.review_status)}</div>
                    <h2>{row.ping_title}</h2>
                    <p className="moderation-body">{row.ping_body}</p>
                    <div className="moderation-meta"><span>Posted by <strong>{row.ping_owner_name}</strong></span><span>Reported by <strong>{row.reporter_name}</strong></span></div>
                    <div className="moderation-signals"><span>{Number(row.reports_on_ping)} {Number(row.reports_on_ping) === 1 ? "report" : "reports"} on this Ping</span><span>Ping: {row.ping_status}</span></div>
                    {row.details && <div className="moderation-details">{row.details}</div>}

                    {row.review_status === "pending" ? (
                      <div className="moderation-actions">
                        <button type="button" onClick={() => act(row, "dismiss")} disabled={busyId === row.report_id}>Dismiss report</button>
                        <button type="button" className="danger" onClick={() => act(row, "remove")} disabled={busyId === row.report_id}>{busyId === row.report_id ? "Working…" : "Remove Ping"}</button>
                      </div>
                    ) : (
                      <div className="moderation-reviewed">
                        <strong>{row.review_status === "removed" ? "Action taken" : "No action taken"}</strong>
                        <span>{row.reviewed_at ? `Reviewed ${relativeTime(row.reviewed_at)}` : "Reviewed"}{row.reviewed_by_name ? ` by ${row.reviewed_by_name}` : ""}</span>
                        {row.review_notes && <small>{row.review_notes}</small>}
                      </div>
                    )}
                  </article>
                )) : <div className="moderation-empty">No reports have been submitted yet.</div>}
              </section>
            </>
          )}
        </main>

        <style jsx global>{`
          .moderation-screen{min-height:100%;padding-bottom:34px}.moderation-header{display:flex;gap:14px;align-items:flex-start;padding:24px 22px 18px}.moderation-header>a{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;text-decoration:none;color:#233329;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:29px;line-height:1}.moderation-header h1{font-size:31px;letter-spacing:-1px;margin:17px 0 0}.moderation-state,.moderation-intro,.moderation-message,.moderation-summary,.moderation-count,.moderation-list{margin-left:22px;margin-right:22px}.moderation-state{padding:22px;border-radius:20px;background:#f2f4ef;color:#647168}.moderation-state p{margin:6px 0 0;font-size:12px}.moderation-intro{display:grid;grid-template-columns:42px 1fr;gap:11px;align-items:start;padding:16px;border-radius:19px;background:#edf5e9}.moderation-intro>div:first-child{font-size:28px}.moderation-intro strong{font-size:14px}.moderation-intro p{margin:4px 0 0;color:#647168;font-size:10px;line-height:1.5}.moderation-message{margin-top:10px;padding:11px 12px;border-radius:13px;background:#eaf7e7;color:#2f6035;font-size:10px;font-weight:750}.moderation-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.moderation-summary div{padding:12px 8px;border-radius:15px;background:#f2f4ef;text-align:center}.moderation-summary strong{display:block;font-size:19px}.moderation-summary span{display:block;margin-top:2px;color:#788279;font-size:8px;font-weight:800}.moderation-count{display:flex;align-items:baseline;gap:7px;margin-top:18px}.moderation-count strong{font-size:25px}.moderation-count span{font-size:10px;color:#77827a}.moderation-list{display:grid;gap:12px;margin-top:10px}.moderation-card{padding:15px;border:1px solid #e1e6df;border-radius:20px;background:#fff;box-shadow:0 12px 28px rgba(31,41,32,.05)}.moderation-card.status-dismissed,.moderation-card.status-removed{background:#fafbf8}.moderation-card-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.reason-pill{padding:6px 8px;border-radius:999px;background:#fff1ee;color:#7d352f;font-size:9px;font-weight:900}.moderation-card-top small{color:#879087;font-size:9px}.moderation-status{display:inline-flex;margin-top:9px;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:900}.moderation-status.status-pending{background:#fff5d9;color:#755713}.moderation-status.status-dismissed{background:#edf1ed;color:#5d685f}.moderation-status.status-removed{background:#fbe8e5;color:#85372f}.moderation-card h2{font-size:17px;margin:10px 0 6px}.moderation-body{margin:0;color:#59665d;font-size:12px;line-height:1.48}.moderation-meta{display:grid;gap:3px;margin-top:11px;color:#7b857d;font-size:9px}.moderation-signals{display:flex;justify-content:space-between;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #edf0eb;color:#68746b;font-size:9px;font-weight:750}.moderation-details{margin-top:9px;padding:9px 10px;border-radius:11px;background:#f6f7f4;color:#737d75;font-size:9px}.moderation-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.moderation-actions button{border:1px solid #dce3da;border-radius:12px;background:#fff;padding:10px;font-size:10px;font-weight:850}.moderation-actions button.danger{border-color:#8d3129;background:#8d3129;color:#fff}.moderation-actions button:disabled{opacity:.55}.moderation-reviewed{display:grid;gap:3px;margin-top:12px;padding:11px 12px;border-radius:13px;background:#f1f3ef}.moderation-reviewed strong{font-size:10px}.moderation-reviewed span,.moderation-reviewed small{color:#727d74;font-size:8px;line-height:1.4}.moderation-empty{padding:28px;border:1px dashed #dfe5dc;border-radius:18px;text-align:center;color:#788379;font-size:12px}
        `}</style>
      </div>
    </div>
  );
}
