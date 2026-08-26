"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PromotionStatus = "draft" | "pending" | "approved" | "active" | "paused" | "ended" | "rejected";
type PromotionFilter = "all" | "pending" | "approved" | "active" | "rejected";

type PromotionRow = {
  promotion_id: string;
  ping_id: string;
  ping_title: string;
  ping_body: string;
  ping_status: string;
  promoter_user_id: string;
  promoter_name: string;
  sponsor_name: string;
  promotion_status: PromotionStatus;
  target_radius_meters: number;
  duration_hours: number;
  quoted_price_pence: number | null;
  currency: string;
  payment_status: "unpaid" | "paid" | "refunded" | "waived";
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by_name: string;
  review_notes: string | null;
};

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function money(pence: number | null) {
  return `£${((pence || 0) / 100).toFixed(2)}`;
}

function radiusLabel(meters: number) {
  if (meters === 805) return "0.5 mi";
  if (meters === 1609) return "1 mi";
  if (meters === 4828) return "3 mi";
  if (meters === 8047) return "5 mi";
  return `${meters} m`;
}

function statusLabel(status: PromotionStatus) {
  if (status === "pending") return "Pending approval";
  if (status === "approved") return "Approved · awaiting payment";
  if (status === "active") return "Promoted now";
  if (status === "rejected") return "Rejected";
  if (status === "ended") return "Ended";
  if (status === "paused") return "Paused";
  return "Draft";
}

export default function PromotionModerationPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<PromotionRow[]>([]);
  const [filter, setFilter] = useState<PromotionFilter>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
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
    const { data, error } = await supabase.rpc("moderation_promotion_history");
    if (error) {
      console.error("Promotion moderation history failed", error);
      if (!silent) setMessage("Promotion requests could not load right now.");
      return;
    }
    setRows((data || []) as PromotionRow[]);
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

  const counts = useMemo(() => ({
    pending: rows.filter((row) => row.promotion_status === "pending").length,
    approved: rows.filter((row) => row.promotion_status === "approved").length,
    active: rows.filter((row) => row.promotion_status === "active").length,
    rejected: rows.filter((row) => row.promotion_status === "rejected").length,
  }), [rows]);

  const visibleRows = useMemo(() => (
    filter === "all" ? rows : rows.filter((row) => row.promotion_status === filter)
  ), [rows, filter]);

  const inspect = (row: PromotionRow) => {
    window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { id: row.ping_id, live: true } }));
  };

  const act = async (row: PromotionRow, action: "approve" | "reject") => {
    if (row.promotion_status !== "pending") return;
    const note = (notes[row.promotion_id] || "").trim();
    if (note.length < 4) {
      setMessage("Add a short review note before deciding this promotion.");
      return;
    }
    const text = action === "approve"
      ? `Approve the promotion request for “${row.ping_title}”? No promotion goes live until payment is completed.`
      : `Reject the promotion request for “${row.ping_title}”?`;
    if (!window.confirm(text)) return;

    setBusyId(row.promotion_id);
    setMessage("");
    try {
      const { error } = await createClient().rpc("moderate_promotion_request", {
        target_promotion_id: row.promotion_id,
        moderation_action: action,
        moderation_notes: note,
      });
      if (error) throw error;
      setNotes((current) => {
        const next = { ...current };
        delete next[row.promotion_id];
        return next;
      });
      setMessage(action === "approve"
        ? "Promotion approved. It remains unpaid and cannot go live until checkout succeeds."
        : "Promotion rejected. The decision and note remain in history.");
      await load(true);
    } catch (error) {
      console.error("Promotion moderation failed", error);
      setMessage("That promotion decision could not be completed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="promo-mod-screen">
          <header className="promo-mod-header">
            <a href="/moderation" aria-label="Back to Moderation">‹</a>
            <div><div className="brand small">ping<span>.</span></div><h1>Promotion review</h1><p>Human approval before paid local reach.</p></div>
          </header>

          {allowed === null && <section className="promo-mod-state">Checking moderator access…</section>}
          {allowed === false && <section className="promo-mod-state"><strong>Moderator access required.</strong><p>This area is not available to ordinary accounts.</p></section>}

          {allowed && (
            <>
              <section className="promo-mod-intro">
                <div>↗</div>
                <div><strong>Paid reach requires human approval.</strong><p>Review usefulness, locality and sponsor name. Approval never activates a promotion or takes payment by itself.</p></div>
              </section>
              {message && <div className="promo-mod-message" role="status">{message}</div>}

              <section className="promo-mod-summary">
                <button type="button" onClick={() => setFilter("pending")}><strong>{counts.pending}</strong><span>Pending</span></button>
                <button type="button" onClick={() => setFilter("approved")}><strong>{counts.approved}</strong><span>Approved</span></button>
                <button type="button" onClick={() => setFilter("active")}><strong>{counts.active}</strong><span>Active</span></button>
                <button type="button" onClick={() => setFilter("rejected")}><strong>{counts.rejected}</strong><span>Rejected</span></button>
              </section>

              <div className="promo-refresh-row"><span>{lastUpdated ? `Updated ${relativeTime(lastUpdated.toISOString())}` : "Loading…"}</span><button type="button" onClick={() => void load()}>Refresh</button></div>

              <section className="promo-filters" aria-label="Promotion status filter">
                {(["pending", "approved", "active", "rejected", "all"] as PromotionFilter[]).map((value) => (
                  <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                    {value === "all" ? "All records" : value[0].toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </section>

              <div className="promo-mod-count"><strong>{visibleRows.length}</strong><span>{visibleRows.length === 1 ? "record shown" : "records shown"}</span></div>

              <section className="promo-mod-list">
                {visibleRows.length ? visibleRows.map((row) => {
                  const working = busyId === row.promotion_id;
                  return (
                    <article key={row.promotion_id} className={`promo-mod-card status-${row.promotion_status}`}>
                      <div className="promo-mod-top"><span className={`promo-status status-${row.promotion_status}`}>{statusLabel(row.promotion_status)}</span><small>{relativeTime(row.requested_at)}</small></div>
                      <h2>{row.ping_title}</h2>
                      <p className="promo-body">{row.ping_body}</p>
                      <div className="promo-sponsor"><span>Paid placement name</span><strong>{row.sponsor_name}</strong></div>
                      <div className="promo-meta"><span>Promoter: <strong>{row.promoter_name}</strong></span><span>Ping: {row.ping_status}</span></div>
                      <div className="promo-commercial">
                        <div><strong>{radiusLabel(row.target_radius_meters)}</strong><span>Radius</span></div>
                        <div><strong>{row.duration_hours}h</strong><span>Duration</span></div>
                        <div><strong>{money(row.quoted_price_pence)}</strong><span>Price</span></div>
                        <div><strong>{row.payment_status === "unpaid" ? "Not paid" : row.payment_status}</strong><span>Payment</span></div>
                      </div>

                      <button type="button" className="promo-inspect" onClick={() => inspect(row)}>Inspect full Ping</button>

                      {row.promotion_status === "pending" ? (
                        <>
                          <label className="promo-note">
                            <span>Review note <b>required</b></span>
                            <textarea
                              value={notes[row.promotion_id] || ""}
                              onChange={(event) => setNotes((current) => ({ ...current, [row.promotion_id]: event.target.value }))}
                              maxLength={500}
                              placeholder="Why should this paid placement be approved or rejected?"
                              disabled={working}
                            />
                            <small>{(notes[row.promotion_id] || "").length}/500</small>
                          </label>
                          <div className="promo-actions">
                            <button type="button" className="reject" onClick={() => void act(row, "reject")} disabled={working}>{working ? "Working…" : "Reject"}</button>
                            <button type="button" className="approve" onClick={() => void act(row, "approve")} disabled={working}>{working ? "Working…" : "Approve"}</button>
                          </div>
                        </>
                      ) : (
                        <div className="promo-reviewed">
                          <strong>{statusLabel(row.promotion_status)}</strong>
                          <span>{row.reviewed_at ? `Reviewed ${relativeTime(row.reviewed_at)}` : "Recorded"}{row.reviewed_by_name ? ` by ${row.reviewed_by_name}` : ""}</span>
                          {row.review_notes && <small>{row.review_notes}</small>}
                        </div>
                      )}
                    </article>
                  );
                }) : <div className="promo-empty">No promotion records match this filter.</div>}
              </section>
            </>
          )}
        </main>

        <style jsx global>{`
          .promo-mod-screen{min-height:100%;padding-bottom:36px}.promo-mod-header{display:flex;gap:14px;align-items:flex-start;padding:24px 20px 16px}.promo-mod-header>a{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;text-decoration:none;color:#233329;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:29px}.promo-mod-header h1{font-size:29px;letter-spacing:-1px;margin:16px 0 0}.promo-mod-header p{margin:3px 0 0;color:#788279;font-size:9px}.promo-mod-state,.promo-mod-intro,.promo-mod-message,.promo-mod-summary,.promo-refresh-row,.promo-filters,.promo-mod-count,.promo-mod-list{margin-left:20px;margin-right:20px}.promo-mod-state{padding:22px;border-radius:20px;background:#f2f4ef;color:#647168}.promo-mod-state p{margin:6px 0 0;font-size:12px}.promo-mod-intro{display:grid;grid-template-columns:42px 1fr;gap:11px;padding:15px;border-radius:19px;background:#edf5e9}.promo-mod-intro>div:first-child{width:42px;height:42px;border-radius:13px;background:#dcefd6;display:grid;place-items:center;font-size:21px;color:#35653b}.promo-mod-intro strong{font-size:13px}.promo-mod-intro p{margin:4px 0 0;color:#647168;font-size:9px;line-height:1.5}.promo-mod-message{margin-top:10px;padding:11px 12px;border-radius:13px;background:#eaf7e7;color:#2f6035;font-size:10px;font-weight:750}.promo-mod-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:12px}.promo-mod-summary button{border:0;padding:11px 5px;border-radius:14px;background:#f2f4ef;text-align:center;color:#1d2720;font:inherit}.promo-mod-summary strong{display:block;font-size:18px}.promo-mod-summary span{display:block;margin-top:2px;color:#788279;font-size:7px;font-weight:800}.promo-refresh-row{display:flex;justify-content:space-between;align-items:center;margin-top:11px;color:#8a938b;font-size:8px}.promo-refresh-row button{border:0;background:transparent;color:#3f7040;font-size:9px;font-weight:900}.promo-filters{display:flex;gap:6px;overflow-x:auto;margin-top:11px;scrollbar-width:none}.promo-filters::-webkit-scrollbar{display:none}.promo-filters button{white-space:nowrap;border:1px solid #dfe5dc;border-radius:999px;background:#fff;padding:7px 10px;color:#667168;font-size:8px;font-weight:850}.promo-filters button.active{border-color:#315d35;background:#315d35;color:#fff}.promo-mod-count{display:flex;align-items:baseline;gap:7px;margin-top:15px}.promo-mod-count strong{font-size:24px}.promo-mod-count span{font-size:9px;color:#77827a}.promo-mod-list{display:grid;gap:12px;margin-top:9px}.promo-mod-card{padding:15px;border:1px solid #e1e6df;border-radius:20px;background:#fff;box-shadow:0 12px 28px rgba(31,41,32,.05)}.promo-mod-card.status-approved{background:#f5faf2}.promo-mod-card.status-rejected{background:#fbf8f6}.promo-mod-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.promo-mod-top small{color:#879087;font-size:9px}.promo-status{display:inline-flex;padding:6px 8px;border-radius:999px;font-size:8px;font-weight:900}.promo-status.status-pending{background:#fff5d9;color:#755713}.promo-status.status-approved{background:#e8f4e4;color:#35643b}.promo-status.status-active{background:#dff2dc;color:#25592b}.promo-status.status-rejected{background:#fbe8e5;color:#85372f}.promo-status.status-ended,.promo-status.status-paused,.promo-status.status-draft{background:#edf1ed;color:#5d685f}.promo-mod-card h2{font-size:18px;margin:11px 0 5px}.promo-body{margin:0;color:#59665d;font-size:11px;line-height:1.45}.promo-sponsor{margin-top:11px;padding:10px 11px;border-radius:12px;background:#f5f7f3;display:flex;justify-content:space-between;gap:10px;align-items:center}.promo-sponsor span{color:#788279;font-size:8px}.promo-sponsor strong{font-size:10px}.promo-meta{display:flex;justify-content:space-between;gap:8px;margin-top:9px;color:#778179;font-size:8px}.promo-commercial{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:11px}.promo-commercial div{padding:9px 5px;border-radius:12px;background:#f1f4ef;text-align:center}.promo-commercial strong{display:block;font-size:11px}.promo-commercial span{display:block;margin-top:2px;color:#858e86;font-size:7px}.promo-inspect{width:100%;margin-top:10px;border:1px solid #dce3da;border-radius:11px;background:#fff;padding:9px;color:#365f3a;font-size:9px;font-weight:900}.promo-note{display:block;margin-top:11px}.promo-note>span{display:flex;justify-content:space-between;color:#59655d;font-size:8px;font-weight:900}.promo-note b{color:#87382f}.promo-note textarea{width:100%;min-height:72px;resize:vertical;margin-top:6px;border:1px solid #dfe5dc;border-radius:12px;background:#fbfcf9;padding:10px;color:#263129;font:inherit;font-size:10px;line-height:1.45;outline:none}.promo-note textarea:focus{border-color:#8db58b;box-shadow:0 0 0 3px rgba(89,217,81,.08)}.promo-note small{display:block;text-align:right;margin-top:3px;color:#939b94;font-size:7px}.promo-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.promo-actions button{border-radius:12px;padding:10px;font-size:10px;font-weight:900}.promo-actions .reject{border:1px solid #dce3da;background:#fff;color:#6f3b36}.promo-actions .approve{border:1px solid #173e20;background:#173e20;color:#fff}.promo-actions button:disabled{opacity:.55}.promo-reviewed{display:grid;gap:3px;margin-top:12px;padding:11px 12px;border-radius:13px;background:#f1f3ef}.promo-reviewed strong{font-size:10px}.promo-reviewed span,.promo-reviewed small{color:#727d74;font-size:8px;line-height:1.4}.promo-empty{padding:28px;border:1px dashed #dfe5dc;border-radius:18px;text-align:center;color:#788379;font-size:11px}
        `}</style>
      </div>
    </div>
  );
}
