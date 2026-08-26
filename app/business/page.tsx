"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CampaignStatus = "draft" | "pending" | "approved" | "active" | "paused" | "ended" | "rejected";
type Campaign = {
  promotion_id: string;
  ping_id: string;
  ping_title: string;
  sponsor_name: string;
  status: CampaignStatus;
  target_radius_meters: number;
  duration_hours: number;
  quoted_price_pence: number | null;
  currency: string;
  payment_status: "unpaid" | "paid" | "refunded" | "waived";
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
  starts_at: string;
  ends_at: string;
  review_notes: string | null;
  impression_sessions: number;
  open_sessions: number;
  confirmation_gain: number;
  reply_gain: number;
  minutes_remaining: number;
};

type Filter = "all" | "active" | "awaiting" | "history";

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

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function timeLeft(minutes: number) {
  if (minutes <= 0) return "Ending now";
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m left` : `${hours}h left`;
}

function statusLabel(status: CampaignStatus, paymentStatus: Campaign["payment_status"]) {
  if (status === "active") return "Live now";
  if (status === "pending") return "In review";
  if (status === "approved" && paymentStatus === "unpaid") return "Ready to pay";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "ended") return "Ended";
  if (status === "paused") return "Paused";
  return "Draft";
}

export default function BusinessPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<Campaign[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      const user = authData.session?.user;
      if (!user) {
        setSignedIn(false);
        setEmail(null);
        setRows([]);
        setLoading(false);
        return;
      }
      setSignedIn(true);
      setEmail(user.email || null);
      const { data, error } = await supabase.rpc("my_promotion_dashboard");
      if (error) throw error;
      setRows(((data || []) as Campaign[]).map((row) => ({
        ...row,
        impression_sessions: Number(row.impression_sessions || 0),
        open_sessions: Number(row.open_sessions || 0),
        confirmation_gain: Number(row.confirmation_gain || 0),
        reply_gain: Number(row.reply_gain || 0),
        minutes_remaining: Number(row.minutes_remaining || 0),
      })));
      setMessage("");
    } catch (error) {
      console.error("Promoter dashboard failed", error);
      setMessage("Campaign performance could not load right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const auth = supabase.auth.onAuthStateChange(() => window.setTimeout(() => void load(), 0));
    const timer = window.setInterval(() => void load(), 30000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      auth.data.subscription.unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const summary = useMemo(() => {
    const paid = rows.filter((row) => row.payment_status === "paid");
    const impressions = rows.reduce((sum, row) => sum + row.impression_sessions, 0);
    const opens = rows.reduce((sum, row) => sum + row.open_sessions, 0);
    return {
      active: rows.filter((row) => row.status === "active").length,
      spent: paid.reduce((sum, row) => sum + Number(row.quoted_price_pence || 0), 0),
      impressions,
      opens,
      openRate: impressions ? Math.round((opens / impressions) * 100) : 0,
    };
  }, [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (filter === "active") return row.status === "active";
    if (filter === "awaiting") return row.status === "pending" || row.status === "approved";
    if (filter === "history") return row.status === "ended" || row.status === "rejected";
    return true;
  }), [rows, filter]);

  const openAuth = () => window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to manage your promoted Pings." } }));
  const openPing = (pingId: string) => window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { id: pingId, live: true } }));

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="phase18-business-screen">
          <header className="phase18-business-header">
            <a href="/you" aria-label="Back to You">‹</a>
            <div><div className="brand small">ping<span>.</span></div><h1>Promoter dashboard</h1></div>
          </header>

          <section className="phase18-business-intro">
            <div>↗</div>
            <div><strong>Know what your local promotion is doing.</strong><p>See campaign status, spend and privacy-minimal performance. Browser sessions are estimates, not a count of unique people.</p></div>
          </section>

          {!loading && signedIn === false ? (
            <section className="phase18-empty"><h2>Sign in to manage promotions.</h2><p>Your campaign history and performance stay tied to your Ping account.</p><button type="button" onClick={openAuth}>Sign in / Sign up</button></section>
          ) : loading ? (
            <section className="phase18-empty"><h2>Loading campaigns…</h2></section>
          ) : (
            <>
              <section className="phase18-overview">
                <div><strong>{summary.active}</strong><span>Live campaigns</span></div>
                <div><strong>{money(summary.spent)}</strong><span>Paid so far</span></div>
                <div><strong>{summary.impressions}</strong><span>Card sessions</span></div>
                <div><strong>{summary.openRate}%</strong><span>Open rate</span></div>
              </section>

              <section className="phase18-actions">
                <a href="/promote">+ Promote another Ping</a>
                <small>{email}</small>
              </section>

              {message && <div className="phase18-message">{message}</div>}

              <section className="phase18-filter" aria-label="Campaign filter">
                {(["all","active","awaiting","history"] as Filter[]).map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All" : item === "active" ? "Live" : item === "awaiting" ? "Awaiting" : "History"}</button>)}
              </section>

              <section className="phase18-campaigns">
                {filtered.length ? filtered.map((campaign) => {
                  const openRate = campaign.impression_sessions ? Math.round((campaign.open_sessions / campaign.impression_sessions) * 100) : 0;
                  const progress = campaign.status === "active" && campaign.duration_hours > 0
                    ? Math.max(0, Math.min(100, 100 - (campaign.minutes_remaining / (campaign.duration_hours * 60)) * 100))
                    : 0;
                  return (
                    <article key={campaign.promotion_id} className={`phase18-card status-${campaign.status}`}>
                      <div className="phase18-card-top">
                        <span className={`phase18-status status-${campaign.status}`}>{statusLabel(campaign.status, campaign.payment_status)}</span>
                        <small>Requested {relativeTime(campaign.requested_at)}</small>
                      </div>
                      <h2>{campaign.ping_title}</h2>
                      <p className="phase18-sponsor">Promoted as <strong>{campaign.sponsor_name}</strong></p>

                      <div className="phase18-commercial">
                        <div><strong>{radiusLabel(campaign.target_radius_meters)}</strong><span>Radius</span></div>
                        <div><strong>{campaign.duration_hours}h</strong><span>Duration</span></div>
                        <div><strong>{money(campaign.quoted_price_pence)}</strong><span>{campaign.payment_status === "paid" ? "Paid" : campaign.payment_status === "waived" ? "Waived" : "Price"}</span></div>
                      </div>

                      {campaign.status === "active" && (
                        <div className="phase18-live-time"><div><strong>{timeLeft(campaign.minutes_remaining)}</strong><span>Campaign is live</span></div><div className="phase18-progress"><i style={{ width: `${progress}%` }} /></div></div>
                      )}

                      <div className="phase18-performance">
                        <div><strong>{campaign.impression_sessions}</strong><span>Card sessions</span></div>
                        <div><strong>{campaign.open_sessions}</strong><span>Ping opens</span></div>
                        <div><strong>{openRate}%</strong><span>Open rate</span></div>
                        <div><strong>+{campaign.confirmation_gain}</strong><span>Confirms</span></div>
                        <div><strong>+{campaign.reply_gain}</strong><span>Replies</span></div>
                      </div>

                      <small className="phase18-method">Sessions are counted once per campaign per browser session. No IP, GPS history or cross-campaign viewer profile is stored.</small>
                      {campaign.review_notes && <div className="phase18-review-note"><strong>Review note</strong><span>{campaign.review_notes}</span></div>}

                      <div className="phase18-card-actions">
                        <button type="button" onClick={() => openPing(campaign.ping_id)}>View Ping</button>
                        {campaign.status === "approved" && campaign.payment_status === "unpaid" ? <a href="/promote">Complete payment →</a> : <a href="/promote">Promote another →</a>}
                      </div>
                    </article>
                  );
                }) : <div className="phase18-no-campaigns"><strong>{rows.length ? "No campaigns in this view." : "No promotion history yet."}</strong><p>Promote a useful local Ping to start building campaign history.</p><a href="/promote">Promote a Ping →</a></div>}
              </section>
            </>
          )}
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          <a href="/"><span>⌂</span>Feed</a>
          <a href="/map"><span>⌖</span>Map</a>
          <a href="/#ping" className="compose-nav"><span>+</span>Ping</a>
          <a href="/alerts"><span>♢</span>Alerts</a>
          <a href="/you" className="active"><span>○</span>You</a>
        </nav>
      </div>

      <style jsx global>{`
        .phase18-business-screen{min-height:100%;padding:0 18px 112px}.phase18-business-header{display:flex;gap:14px;align-items:flex-start;padding:24px 4px 18px}.phase18-business-header>a{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;text-decoration:none;color:#233329;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:29px}.phase18-business-header h1{font-size:28px;letter-spacing:-.9px;margin:14px 0 0}.phase18-business-intro{display:grid;grid-template-columns:44px 1fr;gap:12px;padding:16px;border-radius:20px;background:#eef6e9}.phase18-business-intro>div:first-child{width:44px;height:44px;border-radius:14px;background:#dcefd6;display:grid;place-items:center;color:#35653b;font-size:21px}.phase18-business-intro strong{font-size:13px}.phase18-business-intro p{margin:5px 0 0;color:#69756b;font-size:9px;line-height:1.5}.phase18-empty{margin-top:14px;padding:28px 20px;border:1px solid #e1e6df;border-radius:22px;background:#fff;text-align:center}.phase18-empty h2{font-size:19px;margin:0 0 6px}.phase18-empty p{font-size:10px;color:#6f7a71;line-height:1.5}.phase18-empty button{border:0;border-radius:13px;background:#1f5420;color:#fff;padding:11px 15px;font-weight:900}.phase18-overview{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:13px}.phase18-overview div{padding:14px;border-radius:18px;background:#fff;border:1px solid #e2e7df}.phase18-overview strong{display:block;font-size:22px;letter-spacing:-.5px}.phase18-overview span{display:block;margin-top:3px;color:#79837b;font-size:8px;font-weight:800}.phase18-actions{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:11px}.phase18-actions a{border-radius:13px;background:#1f5420;color:#fff;text-decoration:none;padding:11px 13px;font-size:9px;font-weight:950}.phase18-actions small{max-width:45%;overflow:hidden;text-overflow:ellipsis;color:#8a938b;font-size:8px}.phase18-message{margin-top:10px;padding:10px;border-radius:12px;background:#f7e8e4;color:#895148;font-size:9px}.phase18-filter{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:15px}.phase18-filter button{border:1px solid #dfe5dc;border-radius:999px;background:#fff;padding:8px 5px;font-size:8px;font-weight:850;color:#68736b}.phase18-filter button.active{border-color:#2d6433;background:#eaf5e6;color:#27592c}.phase18-campaigns{display:grid;gap:12px;margin-top:12px}.phase18-card{padding:15px;border:1px solid #e0e5dc;border-radius:21px;background:#fff;box-shadow:0 10px 28px rgba(31,41,32,.045)}.phase18-card.status-active{border-color:#cfe2c9;background:#fbfff9}.phase18-card-top{display:flex;justify-content:space-between;gap:9px;align-items:center}.phase18-card-top small{color:#8a938b;font-size:8px}.phase18-status{display:inline-flex;border-radius:999px;padding:6px 8px;font-size:8px;font-weight:950}.phase18-status.status-active{background:#dcf1d7;color:#245b2b}.phase18-status.status-pending{background:#fff2cf;color:#755913}.phase18-status.status-approved{background:#e5f1e1;color:#346239}.phase18-status.status-rejected{background:#f8e7e3;color:#8a4138}.phase18-status.status-ended,.phase18-status.status-paused,.phase18-status.status-draft{background:#edf0ec;color:#626d64}.phase18-card h2{font-size:18px;margin:11px 0 3px}.phase18-sponsor{margin:0;color:#727d74;font-size:9px}.phase18-commercial{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px}.phase18-commercial div{padding:10px 5px;border-radius:13px;background:#f1f4ef;text-align:center}.phase18-commercial strong{display:block;font-size:12px}.phase18-commercial span{display:block;margin-top:2px;color:#858e86;font-size:7px}.phase18-live-time{margin-top:11px;padding:11px 12px;border-radius:14px;background:#ebf6e7}.phase18-live-time>div:first-child{display:flex;justify-content:space-between;gap:8px;align-items:center}.phase18-live-time strong{font-size:10px}.phase18-live-time span{font-size:8px;color:#6a776c}.phase18-progress{height:5px;border-radius:999px;background:#d9e7d5;overflow:hidden;margin-top:8px}.phase18-progress i{display:block;height:100%;background:#4e9d4a;border-radius:999px}.phase18-performance{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:11px}.phase18-performance div{padding:9px 3px;border-radius:12px;background:#f7f8f5;text-align:center}.phase18-performance strong{display:block;font-size:12px}.phase18-performance span{display:block;margin-top:2px;color:#899189;font-size:6.5px}.phase18-method{display:block;margin-top:9px;color:#8a938b;font-size:7px;line-height:1.45}.phase18-review-note{display:grid;gap:3px;margin-top:9px;padding:9px 10px;border-radius:11px;background:#f4f5f1}.phase18-review-note strong{font-size:8px}.phase18-review-note span{font-size:8px;color:#717c73;line-height:1.4}.phase18-card-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:11px}.phase18-card-actions button,.phase18-card-actions a{border-radius:12px;padding:10px;text-align:center;font-size:9px;font-weight:900;text-decoration:none}.phase18-card-actions button{border:1px solid #dce3da;background:#fff;color:#39443b}.phase18-card-actions a{background:#223026;color:#fff}.phase18-no-campaigns{padding:27px;border:1px dashed #dce3d9;border-radius:20px;text-align:center;color:#6e796f}.phase18-no-campaigns strong{font-size:13px;color:#344037}.phase18-no-campaigns p{font-size:9px;line-height:1.45}.phase18-no-campaigns a{font-size:9px;font-weight:900;color:#285e2d;text-decoration:none}.bottom-nav a{height:100%;border:0;background:transparent;color:#8a928b;font-size:10px;font-weight:800;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;position:relative;text-decoration:none}.bottom-nav a>span{font-size:22px;line-height:1}.bottom-nav a.active{color:#1f5420}.bottom-nav a.compose-nav{color:#1f5420}
      `}</style>
    </div>
  );
}
