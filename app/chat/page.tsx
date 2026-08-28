"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getPingLocationSilently,
  requestPingLocation,
  type PingCoordinates,
  type PingLocationState,
} from "@/lib/ping-location";
import {
  readPingRadius,
  subscribePingLocalPreferences,
  writePingRadius,
} from "@/lib/ping-local-preferences";
import type { Radius } from "@/lib/ping-categories";

const PAGE_SIZE = 40;
const MAX_MESSAGE_LENGTH = 500;
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const CHAT_RADII: Radius[] = [0.5, 1, 3, 5];

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "dangerous", label: "Threats or dangerous content" },
  { value: "privacy", label: "Personal information / privacy" },
  { value: "csam", label: "Child sexual abuse material" },
  { value: "incorrect", label: "Misleading / incorrect" },
  { value: "other", label: "Other" },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]["value"];

type ChatMessage = {
  id: string;
  author_id: string;
  display_name: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  distance_meters: number;
};

type ModerationNotice = {
  message_id: string;
  message_excerpt: string;
  moderation_reason: string;
  moderated_at: string;
};

type RealtimePayload = {
  new?: { id?: string };
  old?: { id?: string };
};

function radiusMeters(radius: Radius) {
  return Math.round(radius * 1609.344);
}

function radiusLabel(radius: Radius) {
  return `${radius} ${radius === 1 ? "mile" : "miles"}`;
}

function relativeTime(value: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join("") || "N").toUpperCase();
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const merged = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => merged.set(message.id, message));
  return Array.from(merged.values()).sort((a, b) => {
    const time = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return time || a.id.localeCompare(b.id);
  });
}

function productEvent(eventType: "chat_message_sent" | "chat_message_reported" | "chat_user_blocked") {
  window.dispatchEvent(new CustomEvent("ping:product-event", { detail: { eventType } }));
}

function friendlySendError(error: unknown) {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : "";
  if (message.includes("CHAT_RATE_LIMIT:")) return "Wait a few seconds before sending another message.";
  if (/repeat the same message/i.test(message)) return "Please do not repeat the same message.";
  if (/context instead of sending only/i.test(message)) return message;
  return "Your message could not be sent. Try again.";
}

export default function ChatPage() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [radius, setRadius] = useState<Radius>(1);
  const [locationState, setLocationState] = useState<PingLocationState>("checking");
  const [coordinates, setCoordinates] = useState<PingCoordinates | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [notices, setNotices] = useState<ModerationNotice[]>([]);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [clock, setClock] = useState(Date.now());

  const listRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const nearBottomRef = useRef(true);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setRadius(readPingRadius());
    return subscribePingLocalPreferences((next) => setRadius(next.radius));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user.id || null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUserId(session?.user.id || null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setCoordinates(null);
      setLocationState("idle");
      return;
    }
    let cancelled = false;
    setLocationState("checking");
    void getPingLocationSilently().then((result) => {
      if (cancelled) return;
      setLocationState(result.state);
      setCoordinates(result.coordinates);
    });
    const onLocation = (event: Event) => {
      const next = (event as CustomEvent<PingCoordinates>).detail;
      if (!next) return;
      setCoordinates(next);
      setLocationState("granted");
    };
    window.addEventListener("ping:location-changed", onLocation as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("ping:location-changed", onLocation as EventListener);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotices([]);
      return;
    }
    let cancelled = false;
    void createClient().rpc("my_chat_moderation_notices", { result_limit: 5 }).then(({ data, error: noticeError }) => {
      if (!cancelled && !noticeError) setNotices((data || []) as ModerationNotice[]);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const scrollToBottom = useCallback((smooth = false) => {
    window.requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) return;
      list.scrollTo({ top: list.scrollHeight, behavior: smooth ? "smooth" : "auto" });
      nearBottomRef.current = true;
    });
  }, []);

  const fetchPage = useCallback(async (before?: ChatMessage | null) => {
    if (!coordinates || !userId) return [] as ChatMessage[];
    const { data, error: queryError } = await createClient().rpc("nearby_chat_messages", {
      viewer_lat: coordinates.lat,
      viewer_lng: coordinates.lng,
      radius_meters: radiusMeters(radius),
      before_created_at: before?.created_at || null,
      before_id: before?.id || null,
      result_limit: PAGE_SIZE,
    });
    if (queryError) throw queryError;
    return (data || []) as ChatMessage[];
  }, [coordinates, radius, userId]);

  const loadInitial = useCallback(async (showFailure = true) => {
    if (!coordinates || !userId) return;
    setLoading(true);
    setError("");
    try {
      const newestFirst = await fetchPage(null);
      setMessages([...newestFirst].reverse());
      setHasMore(newestFirst.length === PAGE_SIZE);
      nearBottomRef.current = true;
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => scrollToBottom(false)));
    } catch (loadError) {
      console.error("Local Chat load failed", loadError);
      if (showFailure) setError("Local Chat could not load nearby messages. Try again.");
    } finally {
      setLoading(false);
    }
  }, [coordinates, fetchPage, scrollToBottom, userId]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || !messagesRef.current.length) return;
    const list = listRef.current;
    const oldHeight = list?.scrollHeight || 0;
    const oldTop = list?.scrollTop || 0;
    setLoadingOlder(true);
    try {
      const oldest = messagesRef.current[0];
      const newestFirst = await fetchPage(oldest);
      setMessages((current) => mergeMessages([...newestFirst].reverse(), current));
      setHasMore(newestFirst.length === PAGE_SIZE);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const currentList = listRef.current;
        if (!currentList) return;
        currentList.scrollTop = currentList.scrollHeight - oldHeight + oldTop;
      }));
    } catch (loadError) {
      console.error("Older Local Chat messages failed", loadError);
      setFeedback("Older messages could not load. Try again in a moment.");
    } finally {
      setLoadingOlder(false);
    }
  }, [fetchPage, hasMore, loadingOlder]);

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    if (userId && coordinates) void loadInitial();
  }, [coordinates, loadInitial, radius, userId]);

  useEffect(() => {
    if (!userId || !coordinates) return;
    const supabase = createClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let refreshTimer: number | null = null;

    const refreshChangedMessage = async (payload: RealtimePayload) => {
      const changedId = payload.new?.id || payload.old?.id;
      if (!changedId) return;
      try {
        const latest = await fetchPage(null);
        const changed = latest.find((message) => message.id === changedId) || null;
        const alreadyVisible = messagesRef.current.some((message) => message.id === changedId);

        setMessages((current) => {
          if (!changed) return current.filter((message) => message.id !== changedId);
          return mergeMessages(current, [changed]);
        });

        if (changed && !alreadyVisible) {
          setLiveAnnouncement(`${changed.display_name} posted a new Local Chat message.`);
          if (nearBottomRef.current) window.requestAnimationFrame(() => scrollToBottom(true));
        }
      } catch (realtimeError) {
        console.error("Local Chat realtime refresh failed", realtimeError);
      }
    };

    void (async () => {
      const scope = await supabase.rpc("chat_set_viewer_scope", {
        viewer_lat: coordinates.lat,
        viewer_lng: coordinates.lng,
        radius_meters: radiusMeters(radius),
      });
      if (disposed || scope.error) return;

      channel = supabase
        .channel(`pindrizzle-local-chat-${userId}-${radius}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, (rawPayload) => {
          if (refreshTimer) window.clearTimeout(refreshTimer);
          const payload = rawPayload as unknown as RealtimePayload;
          refreshTimer = window.setTimeout(() => void refreshChangedMessage(payload), 80);
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setFeedback("Live Chat updates were interrupted. Refresh if new messages stop appearing.");
          }
        });
    })();

    const heartbeat = window.setInterval(() => {
      void supabase.rpc("chat_set_viewer_scope", {
        viewer_lat: coordinates.lat,
        viewer_lng: coordinates.lng,
        radius_meters: radiusMeters(radius),
      });
    }, 5 * 60 * 1000);

    return () => {
      disposed = true;
      window.clearInterval(heartbeat);
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [coordinates, fetchPage, radius, scrollToBottom, userId]);

  const requestLocation = useCallback(async () => {
    setLocationState("requesting");
    setError("");
    const result = await requestPingLocation();
    setLocationState(result.state);
    setCoordinates(result.coordinates);
    if (!result.coordinates) {
      setError(result.state === "denied"
        ? "Location is off. Allow location for Pindrizzle in your browser settings, then try again."
        : "Your location could not be found. Try again.");
    }
  }, []);

  const send = async () => {
    const body = draft.trim();
    if (!body || !coordinates || !userId || sending) return;
    setSending(true);
    setFeedback("");
    try {
      const { error: sendError } = await createClient().rpc("post_chat_message", {
        message_body: body,
        viewer_lat: coordinates.lat,
        viewer_lng: coordinates.lng,
        radius_meters: radiusMeters(radius),
      });
      if (sendError) throw sendError;
      setDraft("");
      productEvent("chat_message_sent");
      await loadInitial(false);
      scrollToBottom(true);
    } catch (sendError) {
      console.error("Local Chat send failed", sendError);
      setFeedback(friendlySendError(sendError));
    } finally {
      setSending(false);
    }
  };

  const submitReport = async () => {
    if (!reportTarget || reportBusy) return;
    setReportBusy(true);
    setFeedback("");
    try {
      const targetId = reportTarget.id;
      const { error: reportError } = await createClient().rpc("report_chat_message", {
        target_chat_message_id: targetId,
        report_reason: reportReason,
        report_details: reportDetails.trim(),
      });
      if (reportError) throw reportError;
      setMessages((current) => current.filter((message) => message.id !== targetId));
      setReportTarget(null);
      setReportDetails("");
      setReportReason("spam");
      setFeedback("Report sent. That message is hidden from your Local Chat while the case is reviewed.");
      productEvent("chat_message_reported");
    } catch (reportError) {
      console.error("Local Chat report failed", reportError);
      setFeedback("That report could not be sent. Try again.");
    } finally {
      setReportBusy(false);
    }
  };

  const blockUser = async (message: ChatMessage) => {
    if (message.author_id === userId) return;
    if (!window.confirm(`Block ${message.display_name}? Their pins and Local Chat messages will be hidden from you.`)) return;
    setFeedback("");
    try {
      const { data, error: blockError } = await createClient().rpc("toggle_block_user", {
        target_user_id: message.author_id,
      });
      if (blockError) throw blockError;
      const blocked = Boolean(data);
      if (!blocked) {
        setFeedback("That user is no longer blocked.");
        await loadInitial(false);
        return;
      }
      setMessages((current) => current.filter((item) => item.author_id !== message.author_id));
      setFeedback(`${message.display_name} is blocked. Their pins and Local Chat messages are hidden from you.`);
      productEvent("chat_user_blocked");
    } catch (blockError) {
      console.error("Local Chat block failed", blockError);
      setFeedback("That user could not be blocked right now.");
    }
  };

  const saveEdit = async (message: ChatMessage) => {
    const body = editBody.trim();
    if (!body || body.length > MAX_MESSAGE_LENGTH || editBusy) return;
    setEditBusy(true);
    try {
      const { error: editError } = await createClient()
        .from("chat_messages")
        .update({ body })
        .eq("id", message.id)
        .eq("author_id", userId);
      if (editError) throw editError;
      setMessages((current) => current.map((item) => item.id === message.id
        ? { ...item, body, edited_at: new Date().toISOString() }
        : item));
      setEditingId(null);
      setEditBody("");
      setFeedback("Message updated.");
    } catch (editError) {
      console.error("Local Chat edit failed", editError);
      setFeedback("That message can only be edited during the first 5 minutes.");
    } finally {
      setEditBusy(false);
    }
  };

  const deleteOwn = async (message: ChatMessage) => {
    if (!window.confirm("Remove this Local Chat message?")) return;
    try {
      const { error: deleteError } = await createClient()
        .from("chat_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", message.id)
        .eq("author_id", userId);
      if (deleteError) throw deleteError;
      setMessages((current) => current.filter((item) => item.id !== message.id));
      setFeedback("Message removed.");
    } catch (deleteError) {
      console.error("Local Chat delete failed", deleteError);
      setFeedback("That message can only be removed during the first 5 minutes.");
    }
  };

  const onListScroll = () => {
    const list = listRef.current;
    if (!list) return;
    nearBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
    if (list.scrollTop < 80 && hasMore && !loadingOlder) void loadOlder();
  };

  const renderedMessages = useMemo(() => messages.map((message, index) => {
    const previous = messages[index - 1];
    const grouped = Boolean(
      previous
      && previous.author_id === message.author_id
      && new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() <= GROUP_WINDOW_MS
    );
    const mine = message.author_id === userId;
    const recentOwn = mine && clock - new Date(message.created_at).getTime() <= GROUP_WINDOW_MS;
    return { message, grouped, mine, recentOwn };
  }), [clock, messages, userId]);

  const canParticipate = Boolean(userId && coordinates && locationState === "granted");
  const countWarning = draft.length >= 400;

  return (
    <main className="chat-screen">
      <div className="sr-only" aria-live="polite" aria-atomic="true">{liveAnnouncement}</div>

      <section className="chat-intro">
        <div>
          <span>LOCAL CHAT</span>
          <h1>Talk to people nearby.</h1>
          <p>A public group conversation for people within your selected radius. Local Chat is not a private-message service.</p>
        </div>
        <label className="chat-radius">
          <span>Radius</span>
          <select value={radius} onChange={(event) => writePingRadius(Number(event.target.value) as Radius)} aria-label="Local Chat radius">
            {CHAT_RADII.map((value) => <option key={value} value={value}>{value} mi</option>)}
          </select>
        </label>
      </section>

      {notices.length > 0 && (
        <section className="chat-moderation-notices" aria-label="Moderation notices">
          <strong>A Local Chat message was removed.</strong>
          {notices.slice(0, 2).map((notice) => (
            <div key={`${notice.message_id}-${notice.moderated_at}`}>
              <p><b>Reason:</b> {notice.moderation_reason}</p>
              <small>{relativeTime(notice.moderated_at, clock)} · “{notice.message_excerpt}”</small>
            </div>
          ))}
          <a href="/safety#moderation-appeals">Understand the rules or appeal a moderation decision</a>
        </section>
      )}

      {!authReady ? (
        <section className="chat-state"><strong>Opening Local Chat…</strong><p>Checking your account.</p></section>
      ) : !userId ? (
        <section className="chat-state">
          <strong>Sign in to join Local Chat</strong>
          <p>Chat messages are public to signed-in people within the selected nearby radius.</p>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to use Local Chat." } }))}>Sign in</button>
        </section>
      ) : !coordinates ? (
        <section className="chat-state">
          <strong>{locationState === "checking" || locationState === "requesting" ? "Checking your nearby area…" : "Location is needed for Local Chat"}</strong>
          <p>Pindrizzle uses your location to decide which radius chat you can see. Chat messages store an approximate area point, not your precise device coordinate.</p>
          {locationState !== "checking" && locationState !== "requesting" && <button type="button" onClick={() => void requestLocation()}>Enable location</button>}
          {error && <p className="chat-state-error">{error}</p>}
        </section>
      ) : (
        <section className="chat-room" aria-label={`Local Chat within ${radiusLabel(radius)}`}>
          <header className="chat-room-head">
            <div><span className="chat-live-dot" aria-hidden="true" /><strong>{radiusLabel(radius)} Local Chat</strong></div>
            <small>{messages.length ? `${messages.length}${hasMore ? "+" : ""} loaded` : "Public group chat"}</small>
          </header>

          {feedback && (
            <div className="chat-feedback" role="status">
              <span>{feedback}</span>
              <button type="button" onClick={() => setFeedback("")} aria-label="Dismiss message">×</button>
            </div>
          )}

          <div className="chat-message-list" ref={listRef} onScroll={onListScroll} role="log" aria-label="Local Chat messages">
            {loadingOlder && <div className="chat-history-status">Loading older messages…</div>}
            {!loadingOlder && hasMore && <button type="button" className="chat-load-older" onClick={() => void loadOlder()}>Load older messages</button>}

            {loading && !messages.length ? (
              <div className="chat-empty"><strong>Loading nearby conversation…</strong><p>Getting the latest Local Chat messages.</p></div>
            ) : error && !messages.length ? (
              <div className="chat-empty"><strong>Local Chat couldn’t load</strong><p>{error}</p><button type="button" onClick={() => void loadInitial()}>Try again</button></div>
            ) : !messages.length ? (
              <div className="chat-empty"><strong>Quiet within {radiusLabel(radius)}</strong><p>No Local Chat messages yet. You can be the first to start a useful nearby conversation.</p></div>
            ) : renderedMessages.map(({ message, grouped, mine, recentOwn }) => (
              <article key={message.id} className={`chat-message${mine ? " mine" : ""}${grouped ? " grouped" : ""}`}>
                {!grouped && <div className="chat-avatar" aria-hidden="true">{initials(message.display_name)}</div>}
                <div className="chat-message-content">
                  {!grouped && (
                    <div className="chat-message-meta">
                      <strong>{mine ? "You" : message.display_name}</strong>
                      <span>{relativeTime(message.created_at, clock)}{message.edited_at ? " · edited" : ""}</span>
                    </div>
                  )}

                  {editingId === message.id ? (
                    <div className="chat-edit-box">
                      <textarea value={editBody} maxLength={MAX_MESSAGE_LENGTH} onChange={(event) => setEditBody(event.target.value)} aria-label="Edit Local Chat message" />
                      <div>
                        <small>{editBody.length}/{MAX_MESSAGE_LENGTH}</small>
                        <button type="button" onClick={() => { setEditingId(null); setEditBody(""); }}>Cancel</button>
                        <button type="button" onClick={() => void saveEdit(message)} disabled={editBusy || !editBody.trim()}>{editBusy ? "Saving…" : "Save"}</button>
                      </div>
                    </div>
                  ) : <p>{message.body}</p>}

                  {editingId !== message.id && (
                    <div className="chat-message-actions">
                      {mine ? (
                        recentOwn ? <>
                          <button type="button" onClick={() => { setEditingId(message.id); setEditBody(message.body); }}>Edit</button>
                          <button type="button" onClick={() => void deleteOwn(message)}>Remove</button>
                        </> : null
                      ) : <>
                        <button type="button" onClick={() => { setReportTarget(message); setReportReason("spam"); setReportDetails(""); }}>Report</button>
                        <button type="button" onClick={() => void blockUser(message)}>Block user</button>
                      </>}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

          <footer className="chat-composer">
            <div className="chat-guideline">Be respectful. No harassment, spam, or sharing others’ personal info. <a href="/safety#chat-guidelines">Read full guidelines</a>.</div>
            <div className="chat-compose-row">
              <label className="sr-only" htmlFor="local-chat-message">Local Chat message</label>
              <textarea
                id="local-chat-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Message your local area…"
                rows={2}
                disabled={!canParticipate || sending}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <button type="button" onClick={() => void send()} disabled={!draft.trim() || sending || !canParticipate}>{sending ? "Sending…" : "Send"}</button>
            </div>
            <div className={`chat-character-count${countWarning ? " warning" : ""}`} aria-live="polite">{draft.length}/{MAX_MESSAGE_LENGTH}</div>
          </footer>
        </section>
      )}

      {reportTarget && (
        <div className="chat-report-backdrop" role="dialog" aria-modal="true" aria-labelledby="chat-report-title" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !reportBusy) setReportTarget(null);
        }}>
          <section className="chat-report-sheet">
            <header>
              <button type="button" onClick={() => setReportTarget(null)} disabled={reportBusy}>Cancel</button>
              <strong id="chat-report-title">Report message</strong>
              <span />
            </header>
            <p>Report “{reportTarget.body.slice(0, 120)}{reportTarget.body.length > 120 ? "…" : ""}” from {reportTarget.display_name}.</p>
            <label>
              Reason
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value as ReportReason)}>
                {REPORT_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
              </select>
            </label>
            {reportReason === "csam" && (
              <div className="chat-csam-warning">
                <strong>Priority child-safety report</strong>
                <span>Use this category only for suspected child sexual abuse material or exploitation. It is surfaced for immediate human review.</span>
              </div>
            )}
            <label>
              Extra context <span>optional</span>
              <textarea value={reportDetails} maxLength={500} onChange={(event) => setReportDetails(event.target.value)} placeholder="What should the moderator know?" />
            </label>
            <button type="button" className="chat-report-submit" onClick={() => void submitReport()} disabled={reportBusy}>{reportBusy ? "Sending…" : "Send report"}</button>
          </section>
        </div>
      )}

      <style jsx global>{`
        .chat-screen{width:100%;color:var(--site-text,#10202f)}
        .chat-intro{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:18px;padding:20px 22px;border:1px solid var(--site-border,#e3e8ee);border-radius:18px;background:#fff}.chat-intro>div{min-width:0}.chat-intro>div>span{display:block;color:#0b7187;font-size:10px;font-weight:850;letter-spacing:.11em}.chat-intro h1{margin:6px 0 7px;font-size:30px;line-height:1.05;letter-spacing:-.04em;text-align:left}.chat-intro p{max-width:620px;margin:0;color:#617080;font-size:13px;line-height:1.55;text-align:left}.chat-radius{display:grid;gap:5px;flex:0 0 auto}.chat-radius>span{font-size:10px;font-weight:800;color:#607080}.chat-radius select{min-width:105px;min-height:44px;border:1px solid var(--site-border,#e3e8ee);border-radius:10px;background:#f7f9fb;padding:0 10px;color:var(--site-text,#10202f);font-weight:750}
        .chat-moderation-notices{display:grid;gap:7px;margin-bottom:14px;padding:14px 16px;border:1px solid #f0c6a8;border-radius:15px;background:#fff8f0}.chat-moderation-notices>strong{font-size:13px}.chat-moderation-notices div{padding-top:7px;border-top:1px solid rgba(167,91,42,.12)}.chat-moderation-notices p{margin:0;font-size:11px;line-height:1.45}.chat-moderation-notices small{display:block;margin-top:3px;color:#78695e;font-size:9px}.chat-moderation-notices a{width:max-content;max-width:100%;min-height:44px;display:inline-flex;align-items:center;color:#0b7187;font-size:10px;font-weight:800}
        .chat-state{display:grid;justify-items:start;gap:8px;padding:28px;border:1px solid var(--site-border,#e3e8ee);border-radius:18px;background:#fff}.chat-state strong{font-size:19px}.chat-state p{max-width:560px;margin:0;color:#617080;font-size:12px;line-height:1.55;text-align:left}.chat-state button,.chat-empty button{min-height:44px;border:0;border-radius:10px;background:#082f4a;color:#fff;padding:0 16px;font-weight:800}.chat-state-error{color:#9f3f38!important}
        .chat-room{height:min(72vh,760px);min-height:560px;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;overflow:hidden;border:1px solid var(--site-border,#e3e8ee);border-radius:20px;background:#fff;box-shadow:0 12px 34px rgba(8,47,74,.07)}.chat-room-head{min-height:54px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 18px;border-bottom:1px solid #edf0f3}.chat-room-head>div{display:flex;align-items:center;gap:8px}.chat-room-head strong{font-size:13px}.chat-room-head small{color:#71808e;font-size:9px}.chat-live-dot{width:8px;height:8px;border-radius:50%;background:#25bdc8;box-shadow:0 0 0 4px rgba(37,189,200,.11)}
        .chat-feedback{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:#eef8fb;color:#174358;font-size:10px;font-weight:700}.chat-feedback button{width:44px;height:44px;margin:-8px -8px -8px 0;border:0;background:transparent;color:#526a78;font-size:20px}
        .chat-message-list{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 18px 18px;scrollbar-gutter:stable;-webkit-overflow-scrolling:touch}.chat-history-status{text-align:center;color:#788693;font-size:9px;padding:8px}.chat-load-older{min-height:44px;display:block;margin:0 auto 10px;border:0;background:transparent;color:#0b7187;font-size:10px;font-weight:800}.chat-empty{min-height:260px;display:grid;place-items:start;align-content:center;gap:8px;max-width:430px;margin:0 auto;text-align:left}.chat-empty strong{font-size:19px}.chat-empty p{margin:0;color:#667684;font-size:12px;line-height:1.55;text-align:left}
        .chat-message{display:grid;grid-template-columns:40px minmax(0,1fr);gap:10px;padding:7px 0}.chat-message.grouped{padding-top:1px}.chat-message.grouped .chat-message-content{grid-column:2}.chat-avatar{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:#eaf4f6;color:#0b6074;font-size:10px;font-weight:900}.chat-message.mine .chat-avatar{background:#eaf0f8;color:#214f73}.chat-message-content{min-width:0}.chat-message-meta{display:flex;align-items:baseline;gap:8px;margin-bottom:3px}.chat-message-meta strong{font-size:11px}.chat-message-meta span{color:#89949d;font-size:8px}.chat-message-content>p{width:fit-content;max-width:min(620px,92%);margin:0;padding:10px 12px;border-radius:4px 14px 14px 14px;background:#f1f5f7;color:#21313d;font-size:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left}.chat-message.mine .chat-message-content>p{background:#eaf3fb}.chat-message-actions{display:flex;gap:2px;margin-top:2px}.chat-message-actions button{min-height:44px;border:0;background:transparent;color:#70808d;padding:0 8px;font-size:9px;font-weight:760}.chat-message-actions button:hover{color:#0b7187}
        .chat-edit-box{display:grid;gap:7px}.chat-edit-box textarea{width:min(620px,100%);min-height:76px;resize:vertical;border:1px solid #bfcbd4;border-radius:12px;padding:10px;font-size:12px}.chat-edit-box>div{display:flex;align-items:center;justify-content:flex-end;gap:6px}.chat-edit-box small{margin-right:auto;color:#768692}.chat-edit-box button{min-height:44px;border:1px solid var(--site-border,#e3e8ee);border-radius:9px;background:#fff;padding:0 12px;font-size:10px;font-weight:780}.chat-edit-box button:last-child{background:#082f4a;color:#fff;border-color:#082f4a}
        .chat-composer{padding:12px 14px 10px;border-top:1px solid #e8edf0;background:#fbfcfd}.chat-guideline{margin-bottom:8px;color:#687783;font-size:9px;line-height:1.4;text-align:left}.chat-guideline a{color:#0b7187;font-weight:800}.chat-compose-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}.chat-compose-row textarea{width:100%;min-height:52px;max-height:132px;resize:vertical;border:1px solid #cfd8df;border-radius:13px;background:#fff;padding:10px 12px;color:#152734;font-size:12px;line-height:1.45;outline:none}.chat-compose-row textarea:focus{border-color:#25a8bc;box-shadow:0 0 0 3px rgba(37,189,200,.12)}.chat-compose-row button{min-width:76px;min-height:52px;border:0;border-radius:12px;background:#082f4a;color:#fff;padding:0 14px;font-size:11px;font-weight:850}.chat-compose-row button:disabled{opacity:.45}.chat-character-count{margin-top:4px;text-align:right;color:#89949d;font-size:8px}.chat-character-count.warning{color:#a75b2a;font-weight:800}
        .chat-report-backdrop{position:fixed;inset:0;z-index:520;display:flex;align-items:flex-end;justify-content:center;padding:14px;background:rgba(8,25,38,.52);backdrop-filter:blur(8px)}.chat-report-sheet{width:min(100%,460px);max-height:calc(100dvh - 28px);overflow:auto;border-radius:24px 24px 18px 18px;background:#fff;padding:14px 18px 20px;color:#10202f;box-shadow:0 -20px 60px rgba(8,25,38,.22)}.chat-report-sheet header{display:grid;grid-template-columns:1fr 2fr 1fr;align-items:center}.chat-report-sheet header strong{text-align:center;font-size:13px}.chat-report-sheet header button{min-height:44px;justify-self:start;border:0;background:transparent;color:#617080;font-size:10px;font-weight:800}.chat-report-sheet>p{margin:12px 0;color:#5e6e7b;font-size:11px;line-height:1.5}.chat-report-sheet label{display:grid;gap:6px;margin-top:12px;color:#344753;font-size:10px;font-weight:800}.chat-report-sheet label>span{font-weight:500;color:#84919a}.chat-report-sheet select,.chat-report-sheet textarea{width:100%;border:1px solid #d3dbe1;border-radius:11px;background:#fff;padding:10px;font-size:11px;color:#10202f}.chat-report-sheet select{min-height:44px}.chat-report-sheet textarea{min-height:90px;resize:vertical}.chat-csam-warning{display:grid;gap:3px;margin-top:10px;padding:11px 12px;border:1px solid #e9a7a1;border-radius:11px;background:#fff2f1}.chat-csam-warning strong{color:#9b2c25;font-size:10px}.chat-csam-warning span{color:#7d4945;font-size:9px;line-height:1.45}.chat-report-submit{width:100%;min-height:48px;margin-top:14px;border:0;border-radius:11px;background:#082f4a;color:#fff;font-size:11px;font-weight:850}
        @media(max-width:720px){.chat-screen{padding-top:14px!important}.chat-intro{align-items:stretch;flex-direction:column;padding:16px}.chat-intro h1{font-size:25px}.chat-radius{grid-template-columns:auto 1fr;align-items:center}.chat-radius select{width:100%}.chat-room{height:72dvh;min-height:520px;border-radius:16px}.chat-message-list{padding-left:12px;padding-right:12px}.chat-composer{padding-left:10px;padding-right:10px}.chat-message{grid-template-columns:36px minmax(0,1fr);gap:8px}.chat-avatar{width:36px;height:36px;border-radius:11px}.chat-message-content>p{max-width:96%}.chat-report-backdrop{padding:0}.chat-report-sheet{border-radius:24px 24px 0 0;max-height:94dvh}}
        @media(max-height:650px){.chat-room{min-height:470px;height:78dvh}}
      `}</style>
    </main>
  );
}
