"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type InviteRow = { id: string; label: string; max_uses: number; use_count: number; expires_at: string; active: boolean; created_at: string };
type FeedbackRow = { id: string; user_id: string; feedback_type: string; message: string; page_path: string | null; rating: number | null; status: string; moderator_note: string | null; created_at: string };

export default function BetaModerationPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [accessCount, setAccessCount] = useState(0);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [label, setLabel] = useState("Beta tester");
  const [uses, setUses] = useState(1);
  const [days, setDays] = useState(30);
  const [newCode, setNewCode] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session?.user) { setAllowed(false); return; }
    const moderator = await supabase.rpc("is_moderator");
    if (!moderator.data || moderator.error) { setAllowed(false); return; }
    setAllowed(true);
    const [accessResult, inviteResult, feedbackResult] = await Promise.all([
      supabase.from("beta_access").select("user_id", { count: "exact", head: true }).is("revoked_at", null),
      supabase.rpc("beta_admin_invites"),
      supabase.from("beta_feedback").select("id,user_id,feedback_type,message,page_path,rating,status,moderator_note,created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    setAccessCount(accessResult.count || 0);
    setInvites((inviteResult.data || []) as InviteRow[]);
    setFeedback((feedbackResult.data || []) as FeedbackRow[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => feedback.find((row) => row.id === selectedId) || null, [feedback, selectedId]);
  const newFeedback = feedback.filter((row) => row.status === "new").length;
  const activeInvites = invites.filter((row) => row.active && new Date(row.expires_at).getTime() > Date.now() && row.use_count < row.max_uses).length;

  const createInvite = async () => {
    setBusy(true); setMessage(""); setNewCode("");
    const result = await createClient().rpc("create_beta_invite", { invite_label: label.trim(), invite_max_uses: uses, valid_days: days });
    if (result.error) setMessage("Invite could not be created.");
    else {
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      setNewCode(row?.invite_code || "");
      setMessage("Invite created. Copy it now — only its hash is stored.");
      await load();
    }
    setBusy(false);
  };

  const selectFeedback = (row: FeedbackRow) => { setSelectedId(row.id); setNote(row.moderator_note || ""); setMessage(""); };

  const updateFeedback = async (status: string) => {
    if (!selected || busy) return;
    setBusy(true); setMessage("");
    const now = new Date().toISOString();
    const result = await createClient().from("beta_feedback").update({ status, moderator_note: note.trim() || null, updated_at: now, resolved_at: status === "resolved" || status === "dismissed" ? now : null }).eq("id", selected.id);
    if (result.error) setMessage("Feedback could not be updated.");
    else { setMessage("Feedback updated."); await load(); }
    setBusy(false);
  };

  if (allowed === null) return <div className="beta24-admin"><main><h1>Loading beta console…</h1></main></div>;
  if (!allowed) return <div className="beta24-admin"><main><h1>Moderator access required</h1><a href="/you">Back to You</a></main></div>;

  return (
    <div className="beta24-admin"><main>
      <header><a href="/beta" aria-label="Back to beta">‹</a><div><span>MODERATOR ONLY</span><h1>Closed beta console</h1><p>Invite testers, review feedback and watch cohort size before public launch.</p></div></header>
      <section className="beta24-admin-stats"><div><strong>{accessCount}</strong><span>testers</span></div><div><strong>{activeInvites}</strong><span>active invites</span></div><div><strong>{newFeedback}</strong><span>new feedback</span></div></section>

      <section className="beta24-admin-card"><h2>Create beta invite</h2><div className="beta24-admin-grid"><label>Label<input value={label} maxLength={80} onChange={(e)=>setLabel(e.target.value)} /></label><label>Uses<input type="number" min={1} max={50} value={uses} onChange={(e)=>setUses(Number(e.target.value))} /></label><label>Valid days<input type="number" min={1} max={90} value={days} onChange={(e)=>setDays(Number(e.target.value))} /></label></div><button type="button" disabled={busy || !label.trim()} onClick={createInvite}>Generate invite</button>{newCode && <div className="beta24-code"><code>{newCode}</code><button type="button" onClick={() => navigator.clipboard?.writeText(newCode)}>Copy</button></div>}<p>Codes are shown once. The database stores only a SHA-256 hash.</p></section>

      <section className="beta24-admin-card"><h2>Invite usage</h2><div className="beta24-admin-list">{invites.length ? invites.map((row)=><article key={row.id}><div><strong>{row.label}</strong><span>{row.use_count}/{row.max_uses} used</span></div><small>{row.active ? "Active" : "Disabled"} · expires {new Date(row.expires_at).toLocaleDateString()}</small></article>) : <p>No invites yet.</p>}</div></section>

      <section className="beta24-admin-card"><h2>Tester feedback</h2><div className="beta24-admin-feedback">{feedback.length ? feedback.map((row)=><button type="button" key={row.id} className={selectedId===row.id?"selected":""} onClick={()=>selectFeedback(row)}><div><strong>{row.feedback_type}</strong><span>{row.status}</span></div><p>{row.message}</p><small>{row.rating ? `${row.rating}/5 · ` : ""}{row.page_path || "No page context"}</small></button>) : <p>No beta feedback yet.</p>}</div>{selected && <div className="beta24-review"><h3>Review feedback</h3><p>{selected.message}</p><textarea value={note} onChange={(e)=>setNote(e.target.value)} maxLength={2000} placeholder="Requester-visible response or internal resolution note…" /><div>{["reviewed","planned","resolved","dismissed"].map((value)=><button type="button" key={value} disabled={busy} onClick={()=>updateFeedback(value)}>{value}</button>)}</div></div>}</section>
      {message && <div className="beta24-admin-message" role="status">{message}</div>}
    </main><style jsx global>{`
      .beta24-admin{min-height:100dvh;background:#e9ece6;padding:24px;color:#172019}.beta24-admin>main{width:min(100%,900px);margin:auto}.beta24-admin header{display:grid;grid-template-columns:44px 1fr;gap:14px;margin-bottom:14px}.beta24-admin header>a{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#172019;text-decoration:none;font-size:28px}.beta24-admin header span{font-size:9px;font-weight:950;color:#2f6b34;letter-spacing:.7px}.beta24-admin h1{font-size:32px;margin:5px 0}.beta24-admin header p,.beta24-admin-card p{font-size:11px;color:#67726a;line-height:1.5}.beta24-admin-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:11px}.beta24-admin-stats div,.beta24-admin-card{background:#f9faf6;border:1px solid #dfe5dc;border-radius:20px;padding:17px}.beta24-admin-stats strong,.beta24-admin-stats span{display:block}.beta24-admin-stats strong{font-size:28px}.beta24-admin-stats span{font-size:9px;color:#748077;font-weight:850}.beta24-admin-card{margin-bottom:11px}.beta24-admin-card h2{font-size:18px;margin:0 0 12px}.beta24-admin-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:9px}.beta24-admin label{font-size:9px;font-weight:900;color:#5f6c62}.beta24-admin input,.beta24-admin textarea{width:100%;margin-top:5px;border:1px solid #dbe3d8;border-radius:12px;background:#fff;padding:11px;font:inherit}.beta24-admin-card>button,.beta24-code button,.beta24-review button{border:0;border-radius:11px;background:#183924;color:#fff;padding:10px 12px;font-size:9px;font-weight:900;margin-top:10px}.beta24-code{margin-top:12px;padding:12px;background:#eef6eb;border-radius:14px;display:flex;align-items:center;justify-content:space-between;gap:10px}.beta24-code code{font-weight:900;overflow-wrap:anywhere}.beta24-code button{margin:0}.beta24-admin-list,.beta24-admin-feedback{display:grid;gap:8px}.beta24-admin-list article,.beta24-admin-feedback>button{border:0;text-align:left;padding:12px;border-radius:14px;background:#eef2eb;color:#172019}.beta24-admin-list article>div,.beta24-admin-feedback>button>div{display:flex;justify-content:space-between;gap:10px}.beta24-admin-list span,.beta24-admin-feedback span,.beta24-admin-list small,.beta24-admin-feedback small{font-size:8px;color:#718077;font-weight:850}.beta24-admin-feedback button p{font-size:10px;margin:6px 0;color:#59655d}.beta24-admin-feedback button.selected{outline:2px solid #59d951}.beta24-review{margin-top:12px;padding-top:12px;border-top:1px solid #dde4da}.beta24-review textarea{min-height:100px;resize:vertical}.beta24-review>div{display:flex;flex-wrap:wrap;gap:7px}.beta24-admin-message{position:sticky;bottom:16px;padding:12px;border-radius:13px;background:#183924;color:#fff;text-align:center;font-size:10px;font-weight:850}@media(max-width:640px){.beta24-admin{padding:18px 12px 70px}.beta24-admin-stats{grid-template-columns:1fr}.beta24-admin-grid{grid-template-columns:1fr}.beta24-admin h1{font-size:27px}}
    `}</style></div>
  );
}
