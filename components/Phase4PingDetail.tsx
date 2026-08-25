"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OpenPingDetail = {
  id: string;
  title?: string;
  body?: string;
  category?: string;
  emoji?: string;
  place?: string;
  distanceMiles?: number;
  confirmations?: number;
  ageMinutes?: number;
  live?: boolean;
  createdByMe?: boolean;
};

type PingRow = {
  id: string;
  user_id: string;
  category: "alert" | "traffic" | "lost_found" | "free" | "help" | "local";
  title: string;
  body: string;
  place_label: string | null;
  status: string;
  confirmation_count: number;
  comment_count: number;
  expires_at: string;
  created_at: string;
};

type CommentRow = {
  id: string;
  ping_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type DetailState = OpenPingDetail & {
  userId?: string;
  commentCount?: number;
  createdAt?: string;
  expiresAt?: string;
};

const categoryMeta: Record<PingRow["category"], { label: string; emoji: string }> = {
  alert: { label: "Alert", emoji: "🚨" },
  traffic: { label: "Traffic", emoji: "🚧" },
  lost_found: { label: "Lost & Found", emoji: "🐕" },
  free: { label: "Free", emoji: "🎁" },
  help: { label: "Help", emoji: "🙋" },
  local: { label: "Local", emoji: "📍" },
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function relativeTime(value?: string, fallbackMinutes?: number) {
  if (value) {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
  if (typeof fallbackMinutes === "number") return fallbackMinutes < 60 ? `${fallbackMinutes} min ago` : `${Math.floor(fallbackMinutes / 60)}h ago`;
  return "recently";
}

function expiryLabel(value?: string) {
  if (!value) return "Pings disappear automatically after 24 hours.";
  const minutes = Math.max(0, Math.floor((new Date(value).getTime() - Date.now()) / 60000));
  if (minutes <= 0) return "This Ping has expired.";
  if (minutes < 60) return `Expires in about ${minutes} min.`;
  return `Expires in about ${Math.ceil(minutes / 60)}h.`;
}

export default function Phase4PingDetail() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("incorrect");
  const [reportBusy, setReportBusy] = useState(false);

  const requestAuth = useCallback((message: string) => {
    window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message } }));
  }, []);

  const loadLiveDetail = useCallback(async (summary: OpenPingDetail) => {
    setLoading(true);
    setActionMessage("");
    try {
      const supabase = createClient();
      const [{ data: authData }, { data: row, error }, { data: replyRows, error: replyError }] = await Promise.all([
        supabase.auth.getSession(),
        supabase
          .from("pings")
          .select("id,user_id,category,title,body,place_label,status,confirmation_count,comment_count,expires_at,created_at")
          .eq("id", summary.id)
          .single(),
        supabase
          .from("comments")
          .select("id,ping_id,user_id,body,created_at")
          .eq("ping_id", summary.id)
          .order("created_at", { ascending: true }),
      ]);
      if (error) throw error;
      if (replyError) throw replyError;
      const typed = row as PingRow;
      const category = categoryMeta[typed.category];
      const userId = authData.session?.user.id || null;
      setCurrentUserId(userId);
      setDetail({
        ...summary,
        id: typed.id,
        userId: typed.user_id,
        title: typed.title,
        body: typed.body,
        category: category.label,
        emoji: category.emoji,
        place: typed.place_label || summary.place || "Nearby",
        confirmations: typed.confirmation_count,
        commentCount: typed.comment_count,
        createdAt: typed.created_at,
        expiresAt: typed.expires_at,
        live: true,
        createdByMe: userId === typed.user_id,
      });
      setComments((replyRows || []) as CommentRow[]);
    } catch (error) {
      console.error("Ping detail failed", error);
      setActionMessage("This Ping could not be loaded. It may have expired or been removed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const openDetail = useCallback((summary: OpenPingDetail) => {
    if (!summary?.id) return;
    setDetail(summary);
    setComments([]);
    setReply("");
    setReportOpen(false);
    setActionMessage("");
    setOpen(true);
    if (uuidPattern.test(summary.id)) void loadLiveDetail(summary);
    else setCurrentUserId(null);
    try { window.history.replaceState(null, "", `#ping=${summary.id}`); } catch {}
  }, [loadLiveDetail]);

  const close = useCallback(() => {
    setOpen(false);
    setReply("");
    setReportOpen(false);
    setActionMessage("");
    try {
      if (window.location.hash.startsWith("#ping=")) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {}
  }, []);

  useEffect(() => {
    const handler = (event: Event) => openDetail((event as CustomEvent<OpenPingDetail>).detail);
    window.addEventListener("ping:open-detail", handler as EventListener);
    return () => window.removeEventListener("ping:open-detail", handler as EventListener);
  }, [openDetail]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#ping=")) return;
    const id = decodeURIComponent(hash.slice(6));
    if (uuidPattern.test(id)) openDetail({ id, live: true });
  }, [openDetail]);

  useEffect(() => {
    if (!open || !detail?.id || !uuidPattern.test(detail.id)) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`ping-detail-${detail.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pings", filter: `id=eq.${detail.id}` }, () => {
        void loadLiveDetail(detail);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `ping_id=eq.${detail.id}` }, () => {
        void loadLiveDetail(detail);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [open, detail?.id, loadLiveDetail]);

  const confirm = async () => {
    if (!detail?.id || !uuidPattern.test(detail.id)) {
      setActionMessage("Preview Pings cannot be confirmed.");
      return;
    }
    if (!currentUserId) {
      requestAuth("Sign in to confirm this Ping.");
      return;
    }
    if (detail.createdByMe) {
      setActionMessage("You can’t confirm your own Ping.");
      return;
    }
    try {
      const { data, error } = await createClient().rpc("confirm_ping", { target_ping_id: detail.id });
      if (error) throw error;
      setDetail((current) => current ? { ...current, confirmations: Number(data) } : current);
      setActionMessage("Confirmed. That helps neighbours trust what they’re seeing.");
    } catch (error) {
      console.error("Confirm failed", error);
      setActionMessage("This Ping could not be confirmed right now.");
    }
  };

  const submitReply = async () => {
    const text = reply.trim();
    if (!detail?.id || !uuidPattern.test(detail.id) || text.length < 2) return;
    if (!currentUserId) {
      requestAuth("Sign in to reply to this Ping.");
      return;
    }
    setReplyBusy(true);
    try {
      const { error } = await createClient().from("comments").insert({ ping_id: detail.id, user_id: currentUserId, body: text });
      if (error) throw error;
      setReply("");
      setActionMessage("Reply posted.");
      await loadLiveDetail(detail);
    } catch (error) {
      console.error("Reply failed", error);
      setActionMessage("Your reply could not be posted yet.");
    } finally {
      setReplyBusy(false);
    }
  };

  const share = async () => {
    if (!detail) return;
    const url = `${window.location.origin}${window.location.pathname}#ping=${encodeURIComponent(detail.id)}`;
    const text = `${detail.title || "Local Ping"} — ${detail.distanceMiles != null ? `${detail.distanceMiles.toFixed(1)} mi away` : "nearby"}`;
    try {
      if (navigator.share) await navigator.share({ title: detail.title || "Ping", text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setActionMessage("Ping link copied.");
      }
    } catch {}
  };

  const submitReport = async () => {
    if (!detail?.id || !uuidPattern.test(detail.id)) return;
    if (!currentUserId) {
      requestAuth("Sign in to report a Ping.");
      return;
    }
    setReportBusy(true);
    try {
      const { error } = await createClient().from("reports").insert({
        ping_id: detail.id,
        reporter_id: currentUserId,
        reason: reportReason,
        details: "Reported from Ping detail sheet",
      });
      if (error) throw error;
      setReportOpen(false);
      setActionMessage("Report sent. Thank you for helping keep Ping useful.");
    } catch (error) {
      console.error("Report failed", error);
      setActionMessage("This report could not be sent yet.");
    } finally {
      setReportBusy(false);
    }
  };

  const commentLabel = useMemo(() => `${comments.length} ${comments.length === 1 ? "reply" : "replies"}`, [comments.length]);

  if (!open || !detail) return null;

  return (
    <div className="phase4-detail-backdrop" role="dialog" aria-modal="true" aria-label="Ping details" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="phase4-detail-sheet">
        <div className="phase4-detail-handle" />
        <div className="phase4-detail-header">
          <button type="button" onClick={close}>Close</button>
          <strong>Ping</strong>
          <button type="button" onClick={share}>Share</button>
        </div>

        <div className="phase4-detail-category">{detail.emoji || "📍"} {detail.category || "Local"}</div>
        <h1>{detail.title || (loading ? "Loading Ping…" : "Local Ping")}</h1>
        <p className="phase4-detail-body">{detail.body || (loading ? "Getting the latest details…" : "Open this Ping from the nearby feed for the full description.")}</p>

        <div className="phase4-detail-meta">
          <span>📍 {detail.place || "Nearby"}</span>
          <span>{detail.distanceMiles != null ? `${detail.distanceMiles.toFixed(1)} mi away` : "Nearby"}</span>
          <span>{relativeTime(detail.createdAt, detail.ageMinutes)}</span>
        </div>

        <div className="phase4-detail-trust">
          <div><strong>{detail.confirmations ?? 0}</strong><span>confirmed</span></div>
          <div><strong>{comments.length || detail.commentCount || 0}</strong><span>replies</span></div>
          <div><strong>{detail.createdByMe ? "Yours" : "Live"}</strong><span>{detail.live === false ? "preview" : "status"}</span></div>
        </div>

        <div className="phase4-detail-actions">
          <button type="button" className="primary" onClick={confirm} disabled={loading || detail.createdByMe}>✓ Confirm</button>
          <button type="button" onClick={share}>↗ Share</button>
          <button type="button" onClick={() => setReportOpen((value) => !value)}>⚑ Report</button>
        </div>

        <div className="phase4-expiry-note">⏱ {expiryLabel(detail.expiresAt)}</div>
        {actionMessage && <div className="phase4-action-message">{actionMessage}</div>}

        {reportOpen && (
          <div className="phase4-report-box">
            <strong>Why are you reporting this Ping?</strong>
            <select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
              <option value="incorrect">Incorrect or misleading</option>
              <option value="spam">Spam or advertising</option>
              <option value="unsafe">Unsafe or abusive</option>
              <option value="other">Other</option>
            </select>
            <div>
              <button type="button" onClick={() => setReportOpen(false)}>Cancel</button>
              <button type="button" className="danger" onClick={submitReport} disabled={reportBusy}>{reportBusy ? "Sending…" : "Send report"}</button>
            </div>
          </div>
        )}

        <div className="phase4-replies-head">
          <div><strong>Replies</strong><span>{commentLabel}</span></div>
        </div>

        <div className="phase4-replies-list">
          {comments.length ? comments.map((comment) => (
            <article key={comment.id} className="phase4-reply">
              <div className="phase4-reply-avatar">{comment.user_id === currentUserId ? "YOU" : "N"}</div>
              <div><strong>{comment.user_id === currentUserId ? "You" : "Neighbour"}</strong><span>{relativeTime(comment.created_at)}</span><p>{comment.body}</p></div>
            </article>
          )) : <div className="phase4-no-replies">No replies yet. Be the first to add something useful.</div>}
        </div>

        {uuidPattern.test(detail.id) && (
          <div className="phase4-reply-compose">
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={500} placeholder="Add a useful reply…" />
            <button type="button" onClick={submitReply} disabled={replyBusy || reply.trim().length < 2}>{replyBusy ? "Posting…" : "Reply"}</button>
          </div>
        )}
      </section>

      <style jsx global>{`
        .phase4-detail-backdrop{position:fixed;inset:0;z-index:90;background:rgba(17,25,18,.52);backdrop-filter:blur(7px);display:flex;align-items:flex-end;justify-content:center;padding:14px}
        .phase4-detail-sheet{width:min(100%,430px);max-height:94vh;overflow:auto;background:#fbfbf7;border-radius:30px 30px 22px 22px;padding:10px 18px 24px;box-shadow:0 -24px 70px rgba(17,25,18,.30);color:#172019}
        .phase4-detail-handle{width:44px;height:5px;border-radius:999px;background:#d6ddd3;margin:2px auto 12px}
        .phase4-detail-header{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center}.phase4-detail-header strong{text-align:center}.phase4-detail-header button{border:0;background:transparent;color:#5d6c61;font-weight:750;padding:8px 0}.phase4-detail-header button:last-child{justify-self:end;color:#2b6334}
        .phase4-detail-category{display:inline-flex;margin-top:20px;padding:8px 11px;border-radius:999px;background:#eef5ea;color:#3d5843;font-size:11px;font-weight:900}
        .phase4-detail-sheet h1{font-size:27px;line-height:1.08;letter-spacing:-.8px;margin:13px 0 10px}.phase4-detail-body{color:#59665d;font-size:14px;line-height:1.55;margin:0 0 15px}
        .phase4-detail-meta{display:flex;flex-wrap:wrap;gap:7px 12px;padding:12px 0;border-top:1px solid #e7ebe4;border-bottom:1px solid #e7ebe4;color:#78837b;font-size:10px;font-weight:700}
        .phase4-detail-trust{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.phase4-detail-trust div{background:#eff4ec;border-radius:16px;padding:12px 7px;text-align:center}.phase4-detail-trust strong{display:block;font-size:17px}.phase4-detail-trust span{font-size:9px;color:#718076}
        .phase4-detail-actions{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:8px}.phase4-detail-actions button{border:1px solid #dfe6dc;background:#fff;border-radius:14px;padding:11px 6px;color:#526058;font-weight:850;font-size:11px}.phase4-detail-actions button.primary{background:#183924;border-color:#183924;color:#fff}.phase4-detail-actions button:disabled{opacity:.45;cursor:not-allowed}
        .phase4-expiry-note,.phase4-action-message{margin-top:11px;border-radius:13px;padding:10px 11px;font-size:10px;line-height:1.4}.phase4-expiry-note{background:#f0f3ed;color:#68746b}.phase4-action-message{background:#eaf7e7;color:#2f6035;font-weight:750}
        .phase4-report-box{margin-top:12px;padding:13px;border-radius:16px;background:#fff3f1;border:1px solid #f2d8d3}.phase4-report-box strong{display:block;font-size:12px;margin-bottom:9px}.phase4-report-box select{width:100%;border:1px solid #e6d7d2;border-radius:11px;padding:9px;background:#fff}.phase4-report-box>div{display:flex;justify-content:flex-end;gap:7px;margin-top:9px}.phase4-report-box button{border:0;border-radius:10px;padding:8px 10px;background:#fff;font-weight:800;font-size:10px}.phase4-report-box button.danger{background:#8d3129;color:#fff}
        .phase4-replies-head{margin:22px 0 9px}.phase4-replies-head>div{display:flex;align-items:baseline;gap:8px}.phase4-replies-head strong{font-size:17px}.phase4-replies-head span{font-size:10px;color:#7b857d}
        .phase4-replies-list{display:grid;gap:9px}.phase4-reply{display:grid;grid-template-columns:38px 1fr;gap:10px;padding:12px;border-radius:16px;background:#f2f5f0}.phase4-reply-avatar{width:38px;height:38px;border-radius:13px;background:#dfeadb;display:grid;place-items:center;color:#326039;font-size:9px;font-weight:1000}.phase4-reply strong{font-size:11px}.phase4-reply span{margin-left:7px;color:#89928a;font-size:9px}.phase4-reply p{margin:5px 0 0;font-size:12px;line-height:1.45;color:#4f5d53}.phase4-no-replies{text-align:center;padding:18px;border:1px dashed #dfe5dc;border-radius:15px;color:#7a857c;font-size:11px}
        .phase4-reply-compose{position:sticky;bottom:-24px;margin:13px -18px -24px;padding:12px 18px 18px;background:linear-gradient(to top,#fbfbf7 75%,rgba(251,251,247,.82));display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.phase4-reply-compose textarea{min-height:48px;max-height:100px;resize:vertical;border:1px solid #dce4da;border-radius:14px;padding:11px;background:#fff}.phase4-reply-compose button{height:48px;border:0;border-radius:14px;background:#55d84d;color:#143318;padding:0 16px;font-weight:900}.phase4-reply-compose button:disabled{opacity:.45}
        @media(max-width:520px){.phase4-detail-backdrop{padding:0}.phase4-detail-sheet{border-radius:28px 28px 0 0;max-height:96vh}}
      `}</style>
    </div>
  );
}
