"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = "alert" | "traffic" | "lost_found" | "free" | "help" | "local" | "deals" | "events" | "outages" | "marketplace" | "parking";
type PromotablePing = {
  ping_id: string;
  category: Category;
  title: string;
  body: string;
  place_label: string | null;
  created_at: string;
  expires_at: string;
  remaining_minutes: number;
};
type PromotionRequest = {
  promotion_id: string;
  ping_id: string;
  ping_title: string;
  sponsor_name: string;
  status: "draft" | "pending" | "approved" | "active" | "paused" | "ended" | "rejected";
  target_radius_meters: number;
  duration_hours: number;
  quoted_price_pence: number | null;
  currency: string;
  payment_status: "unpaid" | "paid" | "refunded" | "waived";
  requested_at: string;
  starts_at: string;
  ends_at: string;
};

type RadiusOption = { meters: 805 | 1609 | 4828 | 8047; label: string };
type DurationOption = 6 | 12 | 24;

const RADII: RadiusOption[] = [
  { meters: 805, label: "0.5 mi" },
  { meters: 1609, label: "1 mi" },
  { meters: 4828, label: "3 mi" },
  { meters: 8047, label: "5 mi" },
];
const DURATIONS: DurationOption[] = [6, 12, 24];
const categoryMeta: Record<Category, { label: string; icon: string }> = {
  alert: { label: "Alert", icon: "🚨" },
  traffic: { label: "Traffic", icon: "🚧" },
  lost_found: { label: "Lost & Found", icon: "🐕" },
  free: { label: "Free", icon: "🎁" },
  help: { label: "Help", icon: "🙋" },
  local: { label: "Other local", icon: "📍" },
  deals: { label: "Deals", icon: "🏷️" },
  events: { label: "Events", icon: "📅" },
  outages: { label: "Outages", icon: "⚡" },
  marketplace: { label: "Marketplace", icon: "🏠" },
  parking: { label: "Parking", icon: "🅿️" },
};

function pricePence(radius: number, duration: number) {
  const matrix: Record<number, Record<number, number>> = {
    805: { 6: 99, 12: 149, 24: 199 },
    1609: { 6: 149, 12: 199, 24: 299 },
    4828: { 6: 249, 12: 399, 24: 599 },
    8047: { 6: 349, 12: 549, 24: 899 },
  };
  return matrix[radius]?.[duration] || 0;
}

function money(pence: number | null) {
  return `£${((pence || 0) / 100).toFixed(2)}`;
}

function timeLeft(minutes: number) {
  if (minutes < 60) return `${Math.max(0, minutes)} min left`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m left` : `${hours}h left`;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function radiusLabel(meters: number) {
  return RADII.find((item) => item.meters === meters)?.label || `${meters} m`;
}

function statusLabel(status: PromotionRequest["status"]) {
  if (status === "pending") return "Pending approval";
  if (status === "active") return "Promoted now";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "ended") return "Ended";
  if (status === "paused") return "Paused";
  return "Draft";
}

function errorText(error: unknown) {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return "That promotion request could not be submitted right now.";
}

export default function PromotePage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [pings, setPings] = useState<PromotablePing[]>([]);
  const [requests, setRequests] = useState<PromotionRequest[]>([]);
  const [selectedPingId, setSelectedPingId] = useState("");
  const [sponsorName, setSponsorName] = useState("");
  const [radius, setRadius] = useState<RadiusOption["meters"]>(1609);
  const [duration, setDuration] = useState<DurationOption>(6);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      const user = authData.session?.user;
      if (!user) {
        setSignedIn(false);
        setEmail(null);
        setPings([]);
        setRequests([]);
        return;
      }
      setSignedIn(true);
      setEmail(user.email || null);
      if (!sponsorName && user.email) setSponsorName(user.email.split("@")[0]);

      const [pingResult, requestResult] = await Promise.all([
        supabase.rpc("my_promotable_pings"),
        supabase.rpc("my_promotion_requests"),
      ]);
      if (pingResult.error) throw pingResult.error;
      if (requestResult.error) throw requestResult.error;
      const nextPings = (pingResult.data || []) as PromotablePing[];
      setPings(nextPings);
      setRequests((requestResult.data || []) as PromotionRequest[]);
      setSelectedPingId((current) => current && nextPings.some((item) => item.ping_id === current) ? current : nextPings[0]?.ping_id || "");
    } catch (error) {
      console.error("Promotion request screen failed", error);
      setMessage("Promotion details could not load right now.");
    } finally {
      setLoading(false);
    }
  }, [sponsorName]);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => setTimeout(() => void load(), 0));
    return () => data.subscription.unsubscribe();
  }, [load]);

  const selectedPing = useMemo(() => pings.find((item) => item.ping_id === selectedPingId) || null, [pings, selectedPingId]);
  const quote = pricePence(radius, duration);
  const durationAvailable = (hours: number) => Boolean(selectedPing && selectedPing.remaining_minutes >= hours * 60);

  useEffect(() => {
    if (!selectedPing) return;
    if (!durationAvailable(duration)) {
      const fallback = DURATIONS.find((hours) => durationAvailable(hours));
      if (fallback) setDuration(fallback);
    }
  }, [selectedPing, duration]);

  const openAuth = () => window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to promote one of your pins." } }));

  const submit = async () => {
    if (!selectedPing || !sponsorName.trim()) return;
    setSubmitting(true);
    setMessage("");
    setSuccess("");
    try {
      const { data, error } = await createClient().rpc("submit_promotion_request", {
        target_ping_id: selectedPing.ping_id,
        requested_sponsor_name: sponsorName.trim(),
        requested_radius_meters: radius,
        requested_duration_hours: duration,
      });
      if (error) throw error;
      if (!data) throw new Error("Promotion request was not created");
      setSuccess(`Promotion request submitted for ${money(quote)}. No payment has been taken.`);
      setSelectedPingId("");
      await load();
    } catch (error) {
      console.error("Promotion request failed", error);
      setMessage(errorText(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="phase9-promote-screen">
          <header className="phase9-promote-header">
            <a href="/you" className="phase9-promote-back" aria-label="Back to You">‹</a>
            <div><div className="brand small">Pindrizzle</div><h1>Promote a Pin</h1></div>
          </header>

          <section className="phase9-promote-intro">
            <span>↗</span>
            <div><strong>Reach more people nearby.</strong><p>Promoted pins stay local, are always labelled as paid placement, and keep the normal Report & Block controls.</p></div>
          </section>

          {!loading && signedIn === false ? (
            <section className="phase9-promote-empty">
              <h2>Sign in to promote a pin.</h2><p>Create a useful pin first, then choose how far and how long to promote it.</p><button type="button" onClick={openAuth}>Sign in / Sign up</button>
            </section>
          ) : loading ? (
            <section className="phase9-promote-empty"><h2>Loading promotion options…</h2></section>
          ) : (
            <>
              <section className="phase9-builder">
                <div className="phase9-step-heading"><b>1</b><div><strong>Choose your pin</strong><span>Only your live, unpromoted pins are eligible.</span></div></div>
                {pings.length ? (
                  <div className="phase9-ping-options">
                    {pings.map((ping) => {
                      const meta = categoryMeta[ping.category] || { label: "Other local", icon: "📍" };
                      const selected = ping.ping_id === selectedPingId;
                      return <button key={ping.ping_id} type="button" className={selected ? "selected" : ""} onClick={() => setSelectedPingId(ping.ping_id)}>
                        <div><span>{meta.icon} {meta.label}</span><small>{timeLeft(ping.remaining_minutes)}</small></div><strong data-user-content>{ping.title}</strong><p data-user-content>{ping.body}</p>
                      </button>;
                    })}
                  </div>
                ) : <div className="phase9-no-pings"><strong>No eligible pins right now.</strong><p>Create a new pin, then come back here while it still has enough time left.</p><a href="/#ping">Create a pin →</a></div>}

                <div className="phase9-step-heading"><b>2</b><div><strong>Who is promoting it?</strong><span>This name appears on the paid placement.</span></div></div>
                <label className="phase9-sponsor-field"><span>Sponsor / business name</span><input value={sponsorName} onChange={(event) => setSponsorName(event.target.value)} maxLength={80} placeholder="e.g. Three Bridges Coffee" /></label>

                <div className="phase9-step-heading"><b>3</b><div><strong>Choose the local reach</strong><span>The placement never appears outside this radius.</span></div></div>
                <div className="phase9-choice-grid radius">
                  {RADII.map((option) => <button type="button" key={option.meters} className={radius === option.meters ? "selected" : ""} onClick={() => setRadius(option.meters)}>{option.label}</button>)}
                </div>

                <div className="phase9-step-heading"><b>4</b><div><strong>Choose the duration</strong><span>A promotion cannot outlive the original pin.</span></div></div>
                <div className="phase9-choice-grid duration">
                  {DURATIONS.map((hours) => {
                    const available = durationAvailable(hours);
                    return <button type="button" key={hours} disabled={!available} className={duration === hours ? "selected" : ""} onClick={() => setDuration(hours)}><strong>{hours}h</strong><small>{available ? "Available" : "Pin expires first"}</small></button>;
                  })}
                </div>

                <section className="phase9-quote">
                  <div><span>Total promotion price</span><strong>{money(quote)}</strong></div>
                  <p>{radiusLabel(radius)} radius · {duration} hours · clearly labelled Promoted</p>
                  <small>Submitting creates a moderation request and takes no payment. Once approved, an unpaid request can be completed through secure Stripe Checkout.</small>
                </section>

                <button className="phase9-submit" type="button" disabled={!selectedPing || !sponsorName.trim() || !durationAvailable(duration) || submitting} onClick={() => void submit()}>{submitting ? "Submitting…" : "Submit for approval"}</button>
                {success && <div className="phase9-success">✓ {success}</div>}
                {message && <div className="phase9-error">{message}</div>}
              </section>

              <section className="phase9-request-history">
                <div className="phase9-history-title"><div><strong>My promotion requests</strong><span data-user-content>{email}</span></div><b>{requests.length}</b></div>
                {requests.length ? requests.map((request) => <article key={request.promotion_id}>
                  <div className="phase9-request-top"><span className={`status ${request.status}`}>{statusLabel(request.status)}</span><small>{relativeTime(request.requested_at)}</small></div>
                  <h2 data-user-content>{request.ping_title}</h2><p>From <span data-user-content>{request.sponsor_name}</span></p>
                  <div className="phase9-request-meta"><span>{radiusLabel(request.target_radius_meters)}</span><span>{request.duration_hours}h</span><span>{money(request.quoted_price_pence)}</span><span>{request.payment_status === "unpaid" ? "Not paid" : request.payment_status}</span></div>
                </article>) : <div className="phase9-history-empty">No promotion requests yet.</div>}
              </section>
            </>
          )}
        </main>
      </div>

      <style jsx global>{`
        .phase9-promote-screen{min-height:100%;padding:0 18px 112px;overflow:auto}.phase9-promote-header{display:flex;gap:14px;align-items:flex-start;padding:24px 4px 18px}.phase9-promote-header h1{font-size:29px;letter-spacing:-.9px;margin:14px 0 0}.phase9-promote-back{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;text-decoration:none;color:#233329;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:29px}.phase9-promote-intro{display:grid;grid-template-columns:42px 1fr;gap:11px;padding:15px;border-radius:19px;background:#eef6e9;margin-bottom:13px}.phase9-promote-intro>span{width:42px;height:42px;border-radius:14px;background:#dcefd6;display:grid;place-items:center;color:#35653b;font-size:20px}.phase9-promote-intro strong{font-size:13px}.phase9-promote-intro p{margin:4px 0 0;color:#68766b;font-size:10px;line-height:1.5}.phase9-builder{border:1px solid #e1e6de;border-radius:22px;background:#fff;padding:15px}.phase9-step-heading{display:grid;grid-template-columns:28px 1fr;gap:9px;align-items:center;margin:4px 0 10px}.phase9-step-heading>b{width:28px;height:28px;border-radius:10px;background:#eef4eb;display:grid;place-items:center;color:#35613a;font-size:11px}.phase9-step-heading strong,.phase9-step-heading span{display:block}.phase9-step-heading strong{font-size:12px}.phase9-step-heading span{margin-top:2px;color:#818a82;font-size:8px}.phase9-ping-options{display:grid;gap:8px;margin-bottom:18px}.phase9-ping-options>button{border:1px solid #e2e7df;border-radius:16px;background:#fafbf8;padding:12px;text-align:left;color:#1e251f}.phase9-ping-options>button.selected{border-color:#79c86f;background:#f1f9ee;box-shadow:0 0 0 2px rgba(86,194,75,.08)}.phase9-ping-options>button>div{display:flex;justify-content:space-between;gap:8px}.phase9-ping-options>button span{font-size:8px;font-weight:900;color:#5e6b61}.phase9-ping-options>button small{font-size:8px;color:#859087}.phase9-ping-options>button strong{display:block;font-size:14px;margin-top:7px}.phase9-ping-options>button p{margin:4px 0 0;font-size:9px;color:#747f76;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.phase9-no-pings{border:1px dashed #dce2d9;border-radius:16px;padding:15px;text-align:center;margin-bottom:18px}.phase9-no-pings strong{font-size:12px}.phase9-no-pings p{font-size:9px;color:#7b857d}.phase9-no-pings a{font-size:9px;color:#315c35;font-weight:900;text-decoration:none}.phase9-sponsor-field{display:block;margin-bottom:18px}.phase9-sponsor-field span{display:block;font-size:8px;font-weight:900;color:#687269;margin-bottom:5px}.phase9-sponsor-field input{width:100%;box-sizing:border-box;border:1px solid #dce2d9;border-radius:13px;background:#fbfcfa;padding:11px 12px;font-size:12px;outline:none}.phase9-sponsor-field input:focus{border-color:#73c66b;box-shadow:0 0 0 3px rgba(83,200,73,.08)}.phase9-choice-grid{display:grid;gap:7px;margin-bottom:18px}.phase9-choice-grid.radius{grid-template-columns:repeat(4,1fr)}.phase9-choice-grid.duration{grid-template-columns:repeat(3,1fr)}.phase9-choice-grid button{border:1px solid #dfe5dc;border-radius:13px;background:#fafbf8;padding:10px 5px;color:#4f5a51;font-size:9px;font-weight:900}.phase9-choice-grid button.selected{background:#1f2921;border-color:#1f2921;color:white}.phase9-choice-grid button:disabled{opacity:.4}.phase9-choice-grid.duration button strong,.phase9-choice-grid.duration button small{display:block}.phase9-choice-grid.duration button strong{font-size:12px}.phase9-choice-grid.duration button small{font-size:7px;margin-top:3px;font-weight:700}.phase9-quote{margin:2px 0 12px;border-radius:17px;background:#f1f7ee;padding:14px}.phase9-quote>div{display:flex;align-items:end;justify-content:space-between;gap:10px}.phase9-quote>div span{font-size:9px;font-weight:850;color:#627064}.phase9-quote>div strong{font-size:24px;letter-spacing:-.5px}.phase9-quote p{margin:6px 0 0;font-size:9px;color:#647166}.phase9-quote small{display:block;margin-top:7px;padding-top:7px;border-top:1px solid #dce8d8;color:#849086;font-size:7px;line-height:1.45}.phase9-submit{width:100%;border:0;border-radius:14px;background:#58d84f;padding:13px;font-size:11px;font-weight:950;color:#173118}.phase9-submit:disabled{opacity:.45}.phase9-success,.phase9-error{margin-top:9px;border-radius:12px;padding:10px;font-size:9px;line-height:1.4}.phase9-success{background:#eaf6e6;color:#2e6534}.phase9-error{background:#f7e9e6;color:#8a5147}.phase9-request-history{margin-top:14px}.phase9-history-title{display:flex;align-items:center;justify-content:space-between;padding:4px 3px 9px}.phase9-history-title strong,.phase9-history-title span{display:block}.phase9-history-title strong{font-size:14px}.phase9-history-title span{font-size:8px;color:#879087;margin-top:2px}.phase9-history-title>b{min-width:27px;height:27px;border-radius:10px;background:#eef3eb;display:grid;place-items:center;font-size:10px}.phase9-request-history article{border:1px solid #e0e6dd;border-radius:17px;background:#fff;padding:12px;margin-bottom:8px}.phase9-request-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.phase9-request-top .status{border-radius:999px;padding:5px 7px;background:#f0f2ed;color:#687068;font-size:7px;font-weight:950}.phase9-request-top .status.pending{background:#fff2d7;color:#89691e}.phase9-request-top .status.active{background:#e8f6e4;color:#2e6b34}.phase9-request-top .status.rejected{background:#f7e6e2;color:#915449}.phase9-request-top small{font-size:7px;color:#909890}.phase9-request-history article h2{font-size:14px;margin:8px 0 3px}.phase9-request-history article p{margin:0;font-size:8px;color:#7a847c}.phase9-request-meta{display:flex;flex-wrap:wrap;gap:5px 10px;margin-top:9px;font-size:8px;color:#69756c}.phase9-history-empty{border:1px dashed #dce3da;border-radius:16px;padding:18px;text-align:center;color:#899189;font-size:9px}.phase9-promote-empty{padding:30px 20px;border:1px solid #e1e7df;border-radius:22px;background:#fff;text-align:center}.phase9-promote-empty h2{font-size:18px;margin:0 0 6px}.phase9-promote-empty p{font-size:10px;color:#6f7a71}.phase9-promote-empty button{margin-top:12px;border:0;border-radius:12px;background:#59d951;padding:11px 15px;font-weight:900}@media(max-width:520px){.phase9-promote-screen{padding-left:15px;padding-right:15px}}
      `}</style>
    </div>
  );
}
