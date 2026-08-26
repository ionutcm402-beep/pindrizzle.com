"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RequestStatus = "open" | "in_review" | "completed" | "rejected";
type ComplianceRow = {
  id: string;
  user_id: string;
  request_type: string;
  details: string;
  status: RequestStatus;
  response_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

type ProfileRow = { id: string; display_name: string };

function labelType(value: string) {
  const labels: Record<string, string> = {
    data_access: "Data access",
    data_erasure: "Data erasure",
    data_correction: "Data correction",
    data_restriction: "Restriction",
    data_objection: "Objection",
    safety_complaint: "Safety complaint",
    moderation_appeal: "Moderation appeal",
    other: "Other complaint",
  };
  return labels[value] || value.replaceAll("_", " ");
}

function statusLabel(value: RequestStatus) {
  if (value === "in_review") return "In review";
  if (value === "completed") return "Completed";
  if (value === "rejected") return "Closed — not upheld";
  return "Open";
}

export default function ComplianceModerationPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ComplianceRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      setAllowed(false);
      return;
    }
    const moderator = await supabase.rpc("is_moderator");
    if (moderator.error || !moderator.data) {
      setAllowed(false);
      return;
    }
    setAllowed(true);

    const requestResult = await supabase
      .from("compliance_requests")
      .select("id,user_id,request_type,details,status,response_note,created_at,updated_at,resolved_at")
      .order("created_at", { ascending: false })
      .limit(100);
    const nextRows = requestResult.error ? [] : ((requestResult.data || []) as ComplianceRow[]);
    setRows(nextRows);

    const userIds = [...new Set(nextRows.map((row) => row.user_id))];
    if (!userIds.length) {
      setProfiles(new Map());
      return;
    }
    const profileResult = await supabase.from("profiles").select("id,display_name").in("id", userIds);
    const map = new Map<string, string>();
    ((profileResult.data || []) as ProfileRow[]).forEach((profile) => map.set(profile.id, profile.display_name));
    setProfiles(map);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);
  const openCount = rows.filter((row) => row.status === "open").length;
  const reviewCount = rows.filter((row) => row.status === "in_review").length;

  const select = (row: ComplianceRow) => {
    setSelectedId(row.id);
    setNote(row.response_note || "");
    setMessage("");
  };

  const update = async (status: RequestStatus) => {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    const now = new Date().toISOString();
    const result = await createClient()
      .from("compliance_requests")
      .update({
        status,
        response_note: note.trim() || null,
        updated_at: now,
        resolved_at: status === "completed" || status === "rejected" ? now : null,
      })
      .eq("id", selected.id);
    if (result.error) {
      setMessage("The request could not be updated.");
    } else {
      setMessage("Request updated.");
      await load();
    }
    setBusy(false);
  };

  if (allowed === null) return <div className="legal-page"><div className="legal-shell"><main className="legal-content"><section className="legal-card"><h2>Loading compliance queue…</h2></section></main></div></div>;
  if (!allowed) return <div className="legal-page"><div className="legal-shell"><main className="legal-content"><section className="legal-card legal-warning"><h2>Moderator access required</h2><p>This queue is available only to authorised Ping moderators.</p><div className="legal-links"><a href="/you">Back to You</a></div></section></main></div></div>;

  return (
    <div className="legal-page">
      <div className="legal-shell">
        <header className="legal-head">
          <a className="legal-back" href="/moderation" aria-label="Back to moderation">‹</a>
          <div><span className="legal-kicker">MODERATOR ONLY</span><h1>Compliance queue</h1><p className="legal-updated">{openCount} open · {reviewCount} in review</p></div>
        </header>
        <main className="legal-content">
          <section className="legal-card legal-callout">
            <h2>Privacy, safety and appeal requests</h2>
            <p>Handle each request according to its substance, not just its label. The response note is visible to the requester, so do not place internal-only or unnecessary sensitive information there. Completed/rejected cases receive a resolution timestamp.</p>
          </section>

          <section className="legal-card">
            <h2>Queue</h2>
            {!rows.length ? <p>No requests have been submitted.</p> : (
              <div className="legal-request-list">
                {rows.map((row) => (
                  <article className="legal-request" key={row.id}>
                    <div><strong>{labelType(row.request_type)} · {profiles.get(row.user_id) || "Ping user"}</strong><span>{statusLabel(row.status)}</span></div>
                    <p>{new Date(row.created_at).toLocaleString("en-GB")} · {row.details}</p>
                    <div className="legal-links"><button type="button" className="legal-button" onClick={() => select(row)}>Review</button></div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {selected && (
            <section className="legal-card legal-callout">
              <h2>Review: {labelType(selected.request_type)}</h2>
              <p><b>Requester:</b> {profiles.get(selected.user_id) || selected.user_id.slice(0, 8)}</p>
              <p>{selected.details}</p>
              <div className="legal-form">
                <label htmlFor="compliance-response-note">Response shown to requester / outcome note</label>
                <textarea id="compliance-response-note" value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder="Record a clear response or reason for the outcome. The requester can read this note." />
                <div className="legal-links">
                  <button type="button" className="legal-button" disabled={busy} onClick={() => update("in_review")}>Mark in review</button>
                  <button type="button" className="legal-button primary" disabled={busy} onClick={() => update("completed")}>Complete</button>
                  <button type="button" className="legal-button" disabled={busy} onClick={() => update("rejected")}>Close — not upheld</button>
                </div>
              </div>
              {message && <div className="legal-status" role="status">{message}</div>}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
