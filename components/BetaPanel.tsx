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

  const openAuth = () => window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to join the Ping closed beta." } }));

  const redeem = async () => {
    if (!signedIn || busy) return;
    const code = invite.trim().toUpperCase();
    if (!/^PING-[A-Z0-9]{10,32}$/.test(code)) {
      setStatus("Enter a valid Ping beta invite code.");
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
          <div><span>CLOSED BETA</span><h1>Help shape Ping before launch.</h1><p>Browse freely. Creating and interacting with local Pings is limited to invited testers until public launch.</p></div>
        </header>

        {!signedIn ? (
          <section className="beta24-card beta24-hero">
            <strong>Already have an invite?</strong>
            <h2>Sign in or create your tester account.</h2>
            <p>Your invite is redeemed after sign-in. Existing Ping testers keep access automatically.</p>
            <button type="button" onClick={openAuth}>Sign in / Sign up</button>
          </section>
        ) : !state?.has_access ? (
          <section className="beta24-card beta24-hero">
            <strong>INVITE REQUIRED</strong><h2>Your account can browse Ping, but participation is still locked.</h2>
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
              <textarea id="beta-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} placeholder="Tell us what you expected, what happened, and what would make Ping better…" />
              <div className="beta24-form-foot"><small>Context: {originPath}</small><button type="button" onClick={submitFeedback} disabled={busy || message.trim().length < 10}>{busy ? "Sending…" : "Send feedback"}</button></div>
            </section>

            <section className="beta24-card">
              <div className="beta24-title"><div><span>BETA CHECKLIST</span><h2>Useful things to test</h2></div></div>
              <ul><li>Create a real local Ping and check how its approximate location appears.</li><li>Open Feed, Search and Map at different radii.</li><li>Try a reply, confirmation, Helpful and Follow flow.</li><li>Install Ping and enable push if your device supports it.</li><li>Report anything confusing, unsafe or broken through the existing safety tools.</li></ul>
            </section>

            {feedback.length > 0 && <section className="beta24-card"><div className="beta24-title"><div><span>YOUR FEEDBACK</span><h2>Recent submissions</h2></div></div><div className="beta24-history">{feedback.map((row) => <article key={row.id}><div><strong>{row.feedback_type.replaceAll("_"," ")}</strong><span>{row.status}</span></div><p>{row.message}</p>{row.moderator_note && <small>Ping team: {row.moderator_note}</small>}<time>{new Date(row.created_at).toLocaleDateString()}</time></article>)}</div></section>}
          </>
        )}

        {status && <div className="beta24-status" role="status" aria-live="polite">{status}</div>}
        <footer><a href="/">Feed</a><a href="/safety">Safety</a><a href="/privacy">Privacy</a></footer>
      </main>
      <style jsx global>{`
        .beta24-page{min-height:100dvh;background:#e9ece6;padding:24px;display:flex;justify-content:center;color:#172019}.beta24-shell{width:min(100%,720px)}.beta24-head{display:grid;grid-template-columns:44px 1fr;gap:14px;align-items:start;margin-bottom:14px}.beta24-head>a{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#fff;text-decoration:none;color:#172019;font-size:28px}.beta24-head span,.beta24-title span{font-size:9px;font-weight:950;letter-spacing:.7px;color:#2f6b34}.beta24-head h1{font-size:34px;line-height:1.02;letter-spacing:-1.3px;margin:5px 0 7px}.beta24-head p{margin:0;color:#657067;font-size:12px;line-height:1.5}.beta24-card,.beta24-access{background:#f9faf6;border:1px solid #dfe5dc;border-radius:22px;padding:18px;margin-bottom:11px;box-shadow:0 10px 30px rgba(31,41,32,.05)}.beta24-hero{background:linear-gradient(135deg,#17251a,#2d3f30);color:#fff}.beta24-hero strong{font-size:9px;letter-spacing:.7px;color:#94eb8d}.beta24-card h2{font-size:20px;margin:5px 0 8px}.beta24-card p{color:#657067;font-size:11px;line-height:1.55}.beta24-hero p{color:#d4ddd5}.beta24-card label{display:block;font-size:10px;font-weight:900;color:#58655b;margin:13px 0 6px}.beta24-card input,.beta24-card select,.beta24-card textarea{width:100%;border:1px solid #dce4d9;border-radius:14px;background:#fff;padding:12px;color:#172019;font:inherit}.beta24-card textarea{min-height:130px;resize:vertical}.beta24-card button,.beta24-hero button,.beta24-access a{border:0;border-radius:13px;background:#59d951;color:#123214;padding:12px 14px;font-weight:950;text-decoration:none}.beta24-hero button{margin-top:10px}.beta24-access{display:flex;justify-content:space-between;align-items:center;gap:12px}.beta24-access>div{display:flex;align-items:center;gap:10px}.beta24-access>div>span{width:40px;height:40px;border-radius:13px;background:#e7f7e3;display:grid;place-items:center;color:#2f6d34;font-weight:950}.beta24-access strong,.beta24-access small{display:block}.beta24-access small{color:#748077;font-size:9px;margin-top:2px}.beta24-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.beta24-title>small{color:#7a847b;font-size:9px}.beta24-rating{display:flex;gap:7px}.beta24-rating button{width:44px;height:44px;padding:0;background:#edf2ea;color:#445047}.beta24-rating button.active{background:#183924;color:#fff}.beta24-form-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px}.beta24-form-foot small{color:#7a847b;font-size:9px}.beta24-history{display:grid;gap:8px}.beta24-history article{padding:12px;border-radius:15px;background:#eef2eb}.beta24-history article>div{display:flex;justify-content:space-between;gap:10px}.beta24-history strong{font-size:10px;text-transform:capitalize}.beta24-history span{font-size:8px;text-transform:uppercase;color:#527055;font-weight:900}.beta24-history p{margin:6px 0}.beta24-history small{display:block;color:#3f6442;font-size:9px}.beta24-history time{display:block;color:#899289;font-size:8px;margin-top:6px}.beta24-card ul{padding-left:18px;color:#59655d;font-size:11px;line-height:1.6}.beta24-status{position:sticky;bottom:18px;margin:12px auto;padding:12px 14px;border-radius:14px;background:#183924;color:#fff;font-size:11px;font-weight:850;text-align:center}.beta24-shell footer{display:flex;justify-content:center;gap:12px;padding:10px}.beta24-shell footer a{color:#4f6352;font-size:10px;font-weight:850}@media(max-width:760px){.beta24-page{padding:18px 14px 80px}.beta24-head h1{font-size:29px}.beta24-access{align-items:flex-start;flex-direction:column}.beta24-title{flex-direction:column}.beta24-form-foot{align-items:stretch;flex-direction:column}.beta24-form-foot button{width:100%}}
      `}</style>
    </div>
  );
}
