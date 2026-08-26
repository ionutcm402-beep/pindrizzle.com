"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ComplianceRequestType =
  | "data_access"
  | "data_erasure"
  | "data_correction"
  | "data_restriction"
  | "data_objection"
  | "safety_complaint"
  | "moderation_appeal"
  | "other";

type RequestRow = {
  id: string;
  request_type: ComplianceRequestType;
  details: string;
  status: "open" | "in_review" | "completed" | "rejected";
  response_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type RequestOption = { value: ComplianceRequestType; label: string };

function humanStatus(status: RequestRow["status"]) {
  if (status === "in_review") return "In review";
  if (status === "completed") return "Completed";
  if (status === "rejected") return "Closed — not upheld";
  return "Open";
}

export default function ComplianceRequestPanel({
  title,
  copy,
  options,
}: {
  title: string;
  copy: string;
  options: RequestOption[];
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [type, setType] = useState<ComplianceRequestType>(options[0]?.value || "other");
  const [details, setDetails] = useState("");
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const optionMap = useMemo(() => new Map(options.map((item) => [item.value, item.label])), [options]);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id || null;
    setUserId(id);
    if (!id) {
      setRows([]);
      setLoading(false);
      return;
    }

    const result = await supabase
      .from("compliance_requests")
      .select("id,request_type,details,status,response_note,created_at,resolved_at")
      .eq("user_id", id)
      .in("request_type", options.map((item) => item.value))
      .order("created_at", { ascending: false })
      .limit(20);
    setRows(result.error ? [] : ((result.data || []) as RequestRow[]));
    setLoading(false);
  }, [options]);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => window.setTimeout(() => void load(), 0));
    return () => data.subscription.unsubscribe();
  }, [load]);

  const requestSignIn = () => {
    window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to submit a privacy or safety request tied to your account." } }));
  };

  const submit = async () => {
    const text = details.trim();
    if (!userId) {
      requestSignIn();
      return;
    }
    if (text.length < 10) {
      setMessage("Add at least 10 characters so the request can be understood.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().from("compliance_requests").insert({
        user_id: userId,
        request_type: type,
        details: text,
        status: "open",
      });
      if (error) throw error;
      setDetails("");
      setMessage("Request submitted. You can track its status below.");
      await load();
    } catch {
      setMessage("This request could not be submitted right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="legal-card legal-callout">
      <h2>{title}</h2>
      <p>{copy}</p>
      {!userId ? (
        <div className="legal-links"><button className="legal-button primary" type="button" onClick={requestSignIn}>Sign in to make a request</button></div>
      ) : (
        <div className="legal-form">
          <label htmlFor="compliance-request-type">Request type</label>
          <select id="compliance-request-type" value={type} onChange={(event) => setType(event.target.value as ComplianceRequestType)}>
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <label htmlFor="compliance-request-details">What do you need?</label>
          <textarea id="compliance-request-details" value={details} maxLength={2000} onChange={(event) => setDetails(event.target.value)} placeholder="Give enough detail for Ping to identify and review your request." />
          <small>{details.length}/2000 characters</small>
          <button className="legal-button primary" type="button" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit request"}</button>
        </div>
      )}
      {message && <div className="legal-status" role="status" aria-live="polite">{message}</div>}
      {userId && !loading && rows.length > 0 && (
        <div className="legal-request-list" aria-label="Your previous requests">
          {rows.map((row) => (
            <article className="legal-request" key={row.id}>
              <div><strong>{optionMap.get(row.request_type) || row.request_type.replaceAll("_", " ")}</strong><span>{humanStatus(row.status)}</span></div>
              <p>{new Date(row.created_at).toLocaleDateString("en-GB")} · {row.details}</p>
              {row.response_note && <p><b>Ping response:</b> {row.response_note}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
