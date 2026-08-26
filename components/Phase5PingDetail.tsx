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
  mediaUrl?: string;
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

type CommunityState = {
  helpful_count: number;
  helpful_by_me: boolean;
  blocked_by_me: boolean;
  hidden_by_block: boolean;
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

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null;
  if (value && typeof value === "object") return value as T;
  return null;
}

export default function Phase5PingDetail() {
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
  const [helpfulCount, setHelpfulCount] = useState(0);
  const [helpfulByMe, setHelpfulByMe] = useState(false);
  const [communityBusy, setCommunityBusy] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [hiddenByBlock, setHiddenByBlock] = useState(false);

  const requestAuth = useCallback((message: string) => {
    window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message } }));
  }, []);

  const loadLiveDetail = useCallback(async (summary: OpenPingDetail) => {
    setLoading(true);
    setActionMessage("");
    try {
      const supabase = createClient();
      const [authResult, pingResult, commentsResult, communityResult, mediaResult] = await Promise.all([
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
        supabase.rpc("ping_community_state", { target_ping_id: summary.id }),
        supabase.from("ping_media").select("storage_path").eq("ping_id", summary.id).maybeSingle(),
      ]);

      if (pingResult.error) throw pingResult.error;
      if (commentsResult.error) throw commentsResult.error;
      if (communityResult.error) throw communityResult.error;

      const typed = pingResult.data as PingRow;
      const category = categoryMeta[typed.category];
      const userId = authResult.data.session?.user.id || null;
      const community = firstRow<CommunityState>(communityResult.data) || {
        helpful_count: 0,
        helpful_by_me: false,
        blocked_by_me: false,
        hidden_by_block: false,
      };

      setCurrentUserId(userId);
      setHelpfulCount(Number(community.helpful_count || 0));
      setHelpfulByMe(Boolean(community.helpful_by_me));
      setBlockedByMe(Boolean(community.blocked_by_me));
      setHiddenByBlock(Boolean(community.hidden_by_block));

      if (community.hidden_by_block && userId !== typed.user_id) {
        setDetail({
          ...summary,
          id: typed.id,
          userId: typed.user_id,
          title: "Ping unavailable",
          body: community.blocked_by_me
            ? "You blocked this user, so their Pings are hidden from your Feed and Map."
            : "This Ping is not available to your account.",
          category: "Privacy",
          emoji: "🛡️",
          place: "Hidden",
          confirmations: 0,
          commentCount: 0,
          createdAt: typed.created_at,
          expiresAt: typed.expires_at,
          live: true,
          createdByMe: false,
          mediaUrl: undefined,
        });
        setComments([]);
        return;
      }

      let mediaUrl = summary.mediaUrl;
      const storagePath = !mediaResult.error ? (mediaResult.data as { storage_path?: string } | null)?.storage_path : undefined;
      if (storagePath) {
        const signed = await supabase.storage.from("ping-media").createSignedUrl(storagePath, 900);
        if (!signed.error && signed.data?.signedUrl) mediaUrl = signed.data.signedUrl;
      }

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
        mediaUrl,
      });
      setComments((commentsResult.data || []) as CommentRow[]);
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
    setBlockOpen(false);
    setActionMessage("");
    setHelpfulCount(0);
    setHelpfulByMe(false);
    setBlockedByMe(false);
    setHiddenByBlock(false);
    setOpen(true);
    if (uuidPattern.test(summary.id)) void loadLiveDetail(summary);
    else setCurrentUserId(null);
    try { window.history.replaceState(null, "", `#ping=${summary.id}`); } catch {}
  }, [loadLiveDetail]);

  const close = useCallback(() => {
    setOpen(false);
    setReply("");
    setReportOpen(false);
    setBlockOpen(false);
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
      .channel(`phase5-ping-detail-${detail.id}`)
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
    if (!detail?.id || !uuidPattern.test(detail.id) || hiddenByBlock) return;
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

  const toggleHelpful = async () => {
    if (!detail?.id || !uuidPattern.test(detail.id) || hiddenByBlock) return;
    if (!currentUserId) {
      requestAuth("Sign in to mark useful Pings as Helpful.");
      return;
    }
    if (detail.createdByMe) {
      setActionMessage("Neighbours decide whether your Ping was helpful.");
      return;
    }
    setCommunityBusy(true);
    try {
      const { data, error } = await createClient().rpc("toggle_ping_helpful", { target_ping_id: detail.id });
      if (error) throw error;
      const state = firstRow<{ helpful_count: number; marked: boolean }>(data);
      if (state) {
        setHelpfulCount(Number(state.helpful_count || 0));
        setHelpfulByMe(Boolean(state.marked));
        setActionMessage(state.marked ? "Marked Helpful. This strengthens useful local contributors." : "Helpful mark removed.");
      }
      window.dispatchEvent(new CustomEvent("ping:community-changed", { detail: { kind: "helpful" } }));
    } catch (error) {
      console.error("Helpful failed", error);
      setActionMessage("Helpful could not be updated right now.");
    } finally {
      setCommunityBusy(false);
    }
  };

  const submitReply = async () => {
    const text = reply.trim();
    if (!detail?.id || !uuidPattern.test(detail.id) || text.length < 2 || hiddenByBlock) return;
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

  const deleteReply = async (commentId: string) => {
    if (!currentUserId) return;
    try {
      const { error } = await createClient().from("comments").delete().eq("id", commentId).eq("user_id", currentUserId);
      if (error) throw error;
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setActionMessage("Reply deleted.");
      window.dispatchEvent(new CustomEvent("ping:community-changed", { detail: { kind: "reply" } }));
    } catch (error) {
      console.error("Delete reply failed", error);
      setActionMessage("That reply could not be deleted right now.");
    }
  };

  const share = async () => {
    if (!detail || hiddenByBlock) return;
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
    if (!detail?.id || !uuidPattern.test(detail.id) || hiddenByBlock || detail.createdByMe) return;
    if (!currentUserId) {
      requestAuth("Sign in to report a Ping.");
      return;
    }
    setReportBusy(true);
    try {
      const { error } = await createClient().rpc("report_ping", {
        target_ping_id: detail.id,
        report_reason: reportReason,
        report_details: "Reported from Ping detail sheet",
      });
      if (error) throw error;
      setReportOpen(false);
      setActionMessage("Report sent. This Ping is now hidden from your Feed and Map.");
      window.dispatchEvent(new CustomEvent("ping:community-changed", { detail: { kind: "safety" } }));
    } catch (error) {
      console.error("Report failed", error);
      setActionMessage("This report could not be sent yet.");
    } finally {
      setReportBusy(false);
    }
  };

  const toggleBlock = async () => {
    if (!detail?.userId || detail.createdByMe) return;
    if (!currentUserId) {
      requestAuth("Sign in to manage blocked users.");
      return;
    }
    setCommunityBusy(true);
    try {
      const { data, error } = await createClient().rpc("toggle_block_user", { target_user_id: detail.userId });
      if (error) throw error;
      const nowBlocked = Boolean(data);
      setBlockedByMe(nowBlocked);
      setHiddenByBlock(nowBlocked);
      setBlockOpen(false);
      setActionMessage(nowBlocked ? "User blocked. Their Pings will disappear from Feed and Map." : "User unblocked.");
      window.dispatchEvent(new CustomEvent("ping:community-changed", { detail: { kind: "block" } }));
      if (nowBlocked) {
        setTimeout(() => {
          close();
          window.location.reload();
        }, 650);
      } else if (detail) {
        await loadLiveDetail(detail);
      }
    } catch (error) {
      console.error("Block failed", error);
      setActionMessage("Block settings could not be updated right now.");
    } finally {
      setCommunityBusy(false);
    }
  };

  const commentLabel = useMemo(() => `${comments.length} ${comments.length === 1 ? "reply" : "replies"}`, [comments.length]);

  if (!open || !detail) return null;

  if (hiddenByBlock) {
    return (
      <div className="phase5-detail-backdrop" role="dialog" aria-modal="true" aria-label="Ping unavailable" onMouseDown={(event) => event.target === event.currentTarget && close()}>
        <section className="phase5-detail-sheet compact">
          <div className="phase5-detail-handle" />
          <div className="phase5-detail-header"><button type="button" onClick={close}>Close</button><strong>Ping</strong><span /></div>
          <div className="phase5-hidden-icon">🛡️</div>
          <h1>Ping unavailable</h1>
          <p className="phase5-detail-body">{blockedByMe ? "You blocked this user. Their Pings are hidden from your Feed and Map." : "This Ping is not available to your account."}</p>
          {blockedByMe && <button className="phase5-wide-button" type="button" onClick={toggleBlock} disabled={communityBusy}>{communityBusy ? "Updating…" : "Unblock user"}</button>}
        </section>
        <CommunityStyles />
      </div>
    );
  }

  return (
    <div className="phase5-detail-backdrop" role="dialog" aria-modal="true" aria-label="Ping details" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="phase5-detail-sheet">
        <div className="phase5-detail-handle" />
        <div className="phase5-detail-header">
          <button type="button" onClick={close}>Close</button>
          <strong>Ping</strong>
          <button type="button" onClick={share}>Share</button>
        </div>

        <div className="phase5-detail-category">{detail.emoji || "📍"} {detail.category || "Local"}</div>
        <h1>{detail.title || (loading ? "Loading Ping…" : "Local Ping")}</h1>
        <p className="phase5-detail-body">{detail.body || (loading ? "Getting the latest details…" : "Open this Ping from the nearby feed for the full description.")}</p>
        {detail.mediaUrl && <img className="phase13-detail-photo" src={detail.mediaUrl} alt={`Photo attached to ${detail.title || "this Ping"}`} />}

        <div className="phase5-detail-meta">
          <span>📍 {detail.place || "Nearby"}</span>
          <span>{detail.distanceMiles != null ? `${detail.distanceMiles.toFixed(1)} mi away` : "Nearby"}</span>
          <span>{relativeTime(detail.createdAt, detail.ageMinutes)}</span>
        </div>

        <div className="phase5-detail-trust">
          <div><strong>{detail.confirmations ?? 0}</strong><span>confirmed</span></div>
          <div><strong>{helpfulCount}</strong><span>helpful</span></div>
          <div><strong>{comments.length || detail.commentCount || 0}</strong><span>replies</span></div>
        </div>

        <div className="phase5-detail-actions">
          <button type="button" className="primary" onClick={confirm} disabled={loading || detail.createdByMe}>✓ Confirm</button>
          <button type="button" className={helpfulByMe ? "selected" : ""} onClick={toggleHelpful} disabled={loading || detail.createdByMe || communityBusy}>{helpfulByMe ? "★ Helpful" : "☆ Helpful"}</button>
          <button type="button" onClick={share}>↗ Share</button>
          <button type="button" onClick={() => setReportOpen((value) => !value)} disabled={detail.createdByMe}>⚑ Report</button>
        </div>

        {!detail.createdByMe && currentUserId && (
          <button className="phase5-safety-link" type="button" onClick={() => setBlockOpen((value) => !value)}>🛡️ Block this user</button>
        )}

        <div className="phase5-expiry-note">⏱ {expiryLabel(detail.expiresAt)}</div>
        {actionMessage && <div className="phase5-action-message">{actionMessage}</div>}

        {blockOpen && (
          <div className="phase5-block-box">
            <strong>Block this user?</strong>
            <p>Their Pings will disappear from your Feed and Map. They will not be notified.</p>
            <div><button type="button" onClick={() => setBlockOpen(false)}>Cancel</button><button type="button" className="danger" onClick={toggleBlock} disabled={communityBusy}>{communityBusy ? "Blocking…" : "Block user"}</button></div>
          </div>
        )}

        {reportOpen && (
          <div className="phase5-report-box">
            <strong>Why are you reporting this Ping?</strong>
            <select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
              <option value="incorrect">Incorrect or misleading</option>
              <option value="spam">Spam or advertising</option>
              <option value="unsafe">Unsafe or abusive</option>
              <option value="other">Other</option>
            </select>
            <div><button type="button" onClick={() => setReportOpen(false)}>Cancel</button><button type="button" className="danger" onClick={submitReport} disabled={reportBusy}>{reportBusy ? "Sending…" : "Send report"}</button></div>
          </div>
        )}

        <div className="phase5-replies-head"><div><strong>Replies</strong><span>{commentLabel}</span></div></div>

        <div className="phase5-replies-list">
          {comments.length ? comments.map((comment) => (
            <article key={comment.id} className="phase5-reply">
              <div className="phase5-reply-avatar">{comment.user_id === currentUserId ? "YOU" : "N"}</div>
              <div className="phase5-reply-copy">
                <div className="phase5-reply-line"><strong>{comment.user_id === currentUserId ? "You" : "Neighbour"}</strong><span>{relativeTime(comment.created_at)}</span>{comment.user_id === currentUserId && <button type="button" onClick={() => deleteReply(comment.id)}>Delete</button>}</div>
                <p>{comment.body}</p>
              </div>
            </article>
          )) : <div className="phase5-no-replies">No replies yet. Be the first to add something useful.</div>}
        </div>

        {uuidPattern.test(detail.id) && (
          <div className="phase5-reply-compose">
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={500} placeholder="Add a useful reply…" />
            <button type="button" onClick={submitReply} disabled={replyBusy || reply.trim().length < 2}>{replyBusy ? "Posting…" : "Reply"}</button>
          </div>
        )}
      </section>
      <CommunityStyles />
    </div>
  );
}

function CommunityStyles() {
  return <style jsx global>{`
    .phase5-detail-backdrop{position:fixed;inset:0;z-index:95;background:rgba(17,25,18,.54);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:14px}
    .phase5-detail-sheet{width:min(100%,440px);max-height:95vh;overflow:auto;background:#fbfbf7;border-radius:30px 30px 22px 22px;padding:10px 18px 24px;box-shadow:0 -24px 70px rgba(17,25,18,.30);color:#172019}.phase5-detail-sheet.compact{padding-bottom:28px;text-align:center}
    .phase5-detail-handle{width:44px;height:5px;border-radius:999px;background:#d6ddd3;margin:2px auto 12px}.phase5-detail-header{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center}.phase5-detail-header strong{text-align:center}.phase5-detail-header button{border:0;background:transparent;color:#5d6c61;font-weight:750;padding:8px 0}.phase5-detail-header button:last-child{justify-self:end;color:#2b6334}
    .phase5-detail-category{display:inline-flex;margin-top:20px;padding:8px 11px;border-radius:999px;background:#eef5ea;color:#3d5843;font-size:11px;font-weight:900}.phase5-detail-sheet h1{font-size:27px;line-height:1.08;letter-spacing:-.8px;margin:13px 0 10px}.phase5-detail-body{color:#59665d;font-size:14px;line-height:1.55;margin:0 0 15px}.phase13-detail-photo{display:block;width:100%;max-height:360px;object-fit:cover;border-radius:18px;margin:0 0 15px;background:#eef1eb;border:1px solid #e2e7df}
    .phase5-detail-meta{display:flex;flex-wrap:wrap;gap:7px 12px;padding:12px 0;border-top:1px solid #e7ebe4;border-bottom:1px solid #e7ebe4;color:#78837b;font-size:10px;font-weight:700}
    .phase5-detail-trust{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.phase5-detail-trust div{background:#eff4ec;border-radius:16px;padding:12px 7px;text-align:center}.phase5-detail-trust strong{display:block;font-size:17px}.phase5-detail-trust span{font-size:9px;color:#718076}
    .phase5-detail-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.phase5-detail-actions button{border:1px solid #dfe6dc;background:#fff;border-radius:14px;padding:11px 5px;color:#526058;font-weight:850;font-size:10px}.phase5-detail-actions button.primary{background:#183924;border-color:#183924;color:#fff}.phase5-detail-actions button.selected{background:#e8f7e4;border-color:#b9e7b2;color:#2f6934}.phase5-detail-actions button:disabled{opacity:.42;cursor:not-allowed}
    .phase5-safety-link{display:block;margin:10px auto 0;border:0;background:transparent;color:#7b625f;font-size:10px;font-weight:800;text-decoration:underline;text-underline-offset:3px}
    .phase5-expiry-note,.phase5-action-message{margin-top:11px;border-radius:13px;padding:10px 11px;font-size:10px;line-height:1.4}.phase5-expiry-note{background:#f0f3ed;color:#68746b}.phase5-action-message{background:#eaf7e7;color:#2f6035;font-weight:750}
    .phase5-report-box,.phase5-block-box{margin-top:12px;padding:13px;border-radius:16px;background:#fff3f1;border:1px solid #f2d8d3}.phase5-report-box strong,.phase5-block-box strong{display:block;font-size:12px;margin-bottom:7px}.phase5-block-box p{margin:0;color:#755e5a;font-size:10px;line-height:1.45}.phase5-report-box select{width:100%;border:1px solid #e6d7d2;border-radius:11px;padding:9px;background:#fff}.phase5-report-box>div,.phase5-block-box>div{display:flex;justify-content:flex-end;gap:7px;margin-top:9px}.phase5-report-box button,.phase5-block-box button{border:0;border-radius:10px;padding:8px 10px;background:#fff;font-weight:800;font-size:10px}.phase5-report-box button.danger,.phase5-block-box button.danger{background:#8d3129;color:#fff}
    .phase5-replies-head{margin:22px 0 9px}.phase5-replies-head>div{display:flex;align-items:baseline;gap:8px}.phase5-replies-head strong{font-size:17px}.phase5-replies-head span{font-size:10px;color:#7b857d}
    .phase5-replies-list{display:grid;gap:9px}.phase5-reply{display:grid;grid-template-columns:38px 1fr;gap:10px;padding:12px;border-radius:16px;background:#f2f5f0}.phase5-reply-avatar{width:38px;height:38px;border-radius:13px;background:#dfeadb;display:grid;place-items:center;color:#326039;font-size:9px;font-weight:1000}.phase5-reply-line{display:flex;align-items:center;gap:7px}.phase5-reply-line strong{font-size:11px}.phase5-reply-line span{color:#89928a;font-size:9px}.phase5-reply-line button{margin-left:auto;border:0;background:transparent;color:#8a6e68;font-size:9px;text-decoration:underline}.phase5-reply-copy p{margin:5px 0 0;font-size:12px;line-height:1.45;color:#4f5d53}.phase5-no-replies{text-align:center;padding:18px;border:1px dashed #dfe5dc;border-radius:15px;color:#7a857c;font-size:11px}
    .phase5-reply-compose{position:sticky;bottom:-24px;margin:13px -18px -24px;padding:12px 18px 18px;background:linear-gradient(to top,#fbfbf7 75%,rgba(251,251,247,.82));display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.phase5-reply-compose textarea{min-height:48px;max-height:100px;resize:vertical;border:1px solid #dce4da;border-radius:14px;padding:11px;background:#fff}.phase5-reply-compose button,.phase5-wide-button{height:48px;border:0;border-radius:14px;background:#55d84d;color:#143318;padding:0 16px;font-weight:900}.phase5-reply-compose button:disabled,.phase5-wide-button:disabled{opacity:.45}.phase5-wide-button{width:100%;margin-top:12px}.phase5-hidden-icon{font-size:38px;margin-top:24px}
    @media(max-width:520px){.phase5-detail-backdrop{padding:0}.phase5-detail-sheet{border-radius:28px 28px 0 0;max-height:97vh}.phase5-detail-actions{grid-template-columns:repeat(2,1fr)}}
  `}</style>;
}