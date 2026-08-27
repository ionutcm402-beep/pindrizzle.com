"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type BetaState = { has_access: boolean; access_source: string | null; granted_at: string | null };
type FeedbackRow = { id: string; feedback_type: string; message: string; page_path: string | null; rating: number | null; status: string; moderator_note: string | null; created_at: string };

const feedbackTypes = [
  ["bug", "Something broke"],
  ["confusing", "Something was confusing"],
  ["idea", "I have an idea"],
  ["praise", "Something worked well"],
  ["other", "Other feedback"],
] as const;

export default function BetaPanel() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [state, setState] = useState<BetaState | null>(null);
  const [invite, setInvite] = useState("");
  const [kind, setKind] = useState("bug");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [originPath, setOriginPath] = useState("/beta");
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user || null;
    setSignedIn(Boolean(user));
    if (!user) {
      setState(null);
      setFeedback([]);
      setIsModerator(false);
      setLoading(false);
      return;
    }

    const [betaResult, moderatorResult, feedbackResult] = await Promise.all([
      supabase.rpc("my_beta_state"),
      supabase.rpc("is_moderator"),
      supabase.from("beta_feedback").select("id,feedback_type,message,page_path,rating,status,moderator_note,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    const row = Array.isArray(betaResult.data) ? betaResult.data[0] : betaResult.data;
    setState(row ? (row as BetaState) : { has_access: false, access_source: null, granted_at: null });
    setIsModerator(Boolean(moderatorResult.data));
    setFeedback((feedbackResult.data || []) as FeedbackRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      if (from?.startsWith("/") && from.length <= 160) setOriginPath(from);
      const pending = localStorage.getItem("ping-beta-pending-invite");
      if (pending) setInvite(pending);
    } catch {}
    void load();
  }, [load]);

  const openAuth = () => window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to join the Pindrizzle closed beta." } }));

  const redeem = async () => {
    if (!signedIn || busy) return;
    const code = invite.trim().toUpperCase();
    if (!/^PING-[A-Z0-9]{10,32}$/.test(code)) {
      setStatus("Enter a valid beta invite code.");
      return;
    }
    setBusy(true);
    setStatus("");
    const result = await createClient().rpc("redeem_beta_invite", { invite_code: code });
    if (result.error) {
      setStatus("That invite is invalid, expired or fully used.");
    } else {
      try { localStorage.removeItem("ping-beta-pending-invite"); } catch {}
      setStatus("Beta access activated.");
      window.dispatchEvent(new Event("ping:beta-refresh"));
      await load();
    }
    setBusy(false);
  };

  const submitFeedback = async () => {
    if (!state?.has_access || busy) return;
    const clean = message.trim();
    if (clean.length < 10) {
      setStatus("Tell us a little more — at least 10 characters.");
      return;
    }
    setBusy(true);
    setStatus("");
    const result = await createClient().rpc("submit_beta_feedback", {
      feedback_kind: kind,
      feedback_message: clean,
      feedback_page: originPath,
      feedback_rating: rating,
    });
    if (result.error) {
      setStatus("Feedback could not be sent right now.");
    } else {
      setMessage("");
      setRating(null);
      setStatus("Feedback sent — thank you.");
      await load();
    }
    setBusy(false);
  };

  if (loading) return <div className="beta24-page"><main className="beta24-shell"><section className="beta24-card"><h1>Loading beta access…</h1></section></main></div>;

  return (
    <div className="beta24-page">
      <main className="beta24-shell">
        <header className="beta24-head">
          <a href="/you" aria-label="Back to You">‹</a>
          <div><span>CLOSED BETA</span><h1>Help shape Pindrizzle before launch.</h1><p>Browse freely. Creating and interacting with local pins is limited to invited testers until public launch.</p></div>
        </header>

        {!signedIn ? (
          <section className="beta24-card beta24-hero">
            <strong>Already have an invite?</strong>
            <h2>Sign in or create your tester account.</h2>
            <p>Your invite is redeemed after sign-in. Existing Pindrizzle testers keep access automatically.</p>
            <button type="button" onClick={openAuth}>Sign in / Sign up</button>
          </section>
        ) : !state?.has_access ? (
          <section className="beta24-card beta24-hero">
            <strong>INVITE REQUIRED</strong><h2>Your account can browse Pindrizzle, but participation is still locked.</h2>
            <p>Enter the invite you received. It unlocks posting, replies, confirmations, Helpful, following and promotion testing.</p>
            <label htmlFor="beta-invite">Beta invite code</label>
            <input id="beta-invite" value={invite} onChange={(event) => setInvite(event.target.value.toUpperCase())} placeholder="PING-…" autoCapitalize="characters" />
            <button type="button" onClick={redeem} disabled={busy}>{busy ? "Checking…" : "Activate beta access"}</button>
          </section>
        ) : (
          <>
            <section className="beta24-access">
              <div><span>✓</span><div><strong>Beta access active</strong><small>{state.access_source === "grandfathered" ? "Existing tester" : "Invited tester"}</small></div></div>
              {isModerator && <a href="/moderation/beta">Open beta console</a>}
            </section>

            <section className="beta24-card">
              <div className="beta24-title"><div><span>TESTER FEEDBACK</span><h2>What should we fix or improve?</h2></div><small>Linked to this account, not public.</small></div>
              <label htmlFor="beta-kind">Feedback type</label>
              <select id="beta-kind" value={kind} onChange={(event) => setKind(event.target.value)}>{feedbackTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
              <label>Overall experience <small>(optional)</small></label>
              <div className="beta24-rating" aria-label="Rate your experience">{[1,2,3,4,5].map((value) => <button type="button" key={value} aria-pressed={rating === value} className={rating === value ? "active" : ""} onClick={() => setRating(rating === value ? null : value)}>{value}</button>)}</div>
              <label htmlFor="beta-message">What happened?</label>
              <textarea id="beta-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} placeholder="Tell us what you expected, what happened, and what would make Pindrizzle better…" />
              <div className="beta24-form-foot"><small>Context: {originPath}</small><button type="button" onClick={submitFeedback} disabled={busy || message.trim().length < 10}>{busy ? "Sending…" : "Send feedback"}</button></div>
            </section>

            <section className="beta24-card">
              <div className="beta24-title"><div><span>BETA CHECKLIST</span><h2>Useful things to test</h2></div></div>
              <ul><li>Create a real local pin and check how its approximate location appears.</li><li>Open Feed, Search and Map at different radii.</li><li>Try a reply, confirmation, Helpful and Follow flow.</li><li>Install Pindrizzle and enable push if your device supports it.</li><li>Report anything confusing, unsafe or broken through the existing safety tools.</li></ul>
            </section>

            {feedback.length > 0 && <section className="beta24-card"><div className="beta24-title"><div><span>YOUR FEEDBACK</span><h2>Recent submissions</h2></div></div><div className="beta24-history">{feedback.map((row) => <article key={row.id}><div><strong>{row.feedback_type.replaceAll("_"," ")}</strong><span>{row.status}</span></div><p data-user-content>{row.message}</p>{row.moderator_note && <small data-user-content>Pindrizzle team: {row.moderator_note}</small>}<time>{new Date(row.created_at).toLocaleDateString()}</time></article>)}</div></section>}
          </>
        )}

        {status && <div className="beta24-status" role="status" aria-live="polite">{status}</div>}
        <footer><a href="/">Feed</a><a href="/safety">Safety</a><a href="/privacy">Privacy</a></footer>
      </main>
      <style jsx global>{`
        .beta24-page{min-height:100dvh;background:linear-gradient(180deg,#eef9fc 0%,#f8fbfc 54%,#edf7fb 100%);padding:24px;display:flex;justify-content:center;color:#102b3b}.beta24-shell{width:min(100%,720px)}.beta24-head{display:grid;grid-template-columns:44px 1fr;gap:14px;align-items:start;margin-bottom:14px}.beta24-head>a{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.92);border:1px solid rgba(71,165,205,.16);text-decoration:none;color:#173c51;font-size:28px;box-shadow:0 8px 24px rgba(22,58,77,.07)}.beta24-head span,.beta24-title span{font-size:9px;font-weight:950;letter-spacing:.7px;color:#147ca7}.beta24-head h1{font-size:34px;line-height:1.02;letter-spacing:-1.3px;margin:5px 0 7px}.beta24-head p{margin:0;color:#607a88;font-size:12px;line-height:1.5}.beta24-card,.beta24-access{background:rgba(255,255,255,.92);border:1px solid rgba(70,165,205,.16);border-radius:22px;padding:18px;margin-bottom:11px;box-shadow:0 10px 30px rgba(22,58,77,.06);backdrop-filter:blur(16px)}.beta24-hero{background:linear-gradient(135deg,#0d3147,#15506a);color:#fff;border-color:rgba(105,214,239,.14)}.beta24-hero strong{font-size:9px;letter-spacing:.7px;color:#8ce7f0}.beta24-card h2{font-size:20px;margin:5px 0 8px}.beta24-card p{color:#607a88;font-size:11px;line-height:1.55}.beta24-hero p{color:#d7edf3}.beta24-card label{display:block;font-size:10px;font-weight:900;color:#506d7b;margin:13px 0 6px}.beta24-card input,.beta24-card select,.beta24-card textarea{width:100%;border:1px solid rgba(69,158,196,.22);border-radius:14px;background:#fff;padding:12px;color:#102b3b;font:inherit;outline:none}.beta24-card input:focus,.beta24-card select:focus,.beta24-card textarea:focus{border-color:#4ab9d8;box-shadow:0 0 0 3px rgba(74,185,216,.12)}.beta24-card textarea{min-height:130px;resize:vertical}.beta24-card button,.beta24-hero button,.beta24-access a{border:0;border-radius:13px;background:#25b7d3;color:#082f42;padding:12px 14px;font-weight:950;text-decoration:none}.beta24-hero button{margin-top:10px}.beta24-access{display:flex;justify-content:space-between;align-items:center;gap:12px}.beta24-access>div{display:flex;align-items:center;gap:10px}.beta24-access>div>span{width:40px;height:40px;border-radius:13px;background:#e4f8fb;display:grid;place-items:center;color:#15728f;font-weight:950}.beta24-access strong,.beta24-access small{display:block}.beta24-access small{color:#6d8490;font-size:9px;margin-top:2px}.beta24-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.beta24-title>small{color:#738995;font-size:9px}.beta24-rating{display:flex;gap:7px}.beta24-rating button{width:44px;height:44px;padding:0;background:#eaf6fa;color:#365968}.beta24-rating button.active{background:#0e3850;color:#fff}.beta24-form-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px}.beta24-form-foot small{color:#738995;font-size:9px}.beta24-history{display:grid;gap:8px}.beta24-history article{padding:12px;border-radius:15px;background:#edf7fa}.beta24-history article>div{display:flex;justify-content:space-between;gap:10px}.beta24-history strong{font-size:10px;text-transform:capitalize}.beta24-history span{font-size:8px;text-transform:uppercase;color:#3f778e;font-weight:900}.beta24-history p{margin:6px 0}.beta24-history small{display:block;color:#35697e;font-size:9px}.beta24-history time{display:block;color:#7f949e;font-size:8px;margin-top:6px}.beta24-card ul{padding-left:18px;color:#536e7b;font-size:11px;line-height:1.6}.beta24-status{position:sticky;bottom:18px;margin:12px auto;padding:12px 14px;border-radius:14px;background:#0e3850;color:#fff;font-size:11px;font-weight:850;text-align:center}.beta24-shell footer{display:flex;justify-content:center;gap:12px;padding:10px}.beta24-shell footer a{color:#456879;font-size:10px;font-weight:850}@media(max-width:760px){.beta24-page{padding:18px 14px 80px}.beta24-head h1{font-size:29px}.beta24-access{align-items:flex-start;flex-direction:column}.beta24-title{flex-direction:column}.beta24-form-foot{align-items:stretch;flex-direction:column}.beta24-form-foot button{width:100%}}
      `}</style>
    </div>
  );
}
