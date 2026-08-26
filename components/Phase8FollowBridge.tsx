"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type OpenPingEvent = { id?: string };
type PingIdentity = { user_id: string; status: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function Phase8FollowBridge() {
  const [pingId, setPingId] = useState<string | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [followed, setFollowed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#ping=")) {
        setPingId(null);
        return;
      }
      const id = decodeURIComponent(hash.slice(6));
      setPingId(uuidPattern.test(id) ? id : null);
    };

    const handleOpen = (event: Event) => {
      const id = (event as CustomEvent<OpenPingEvent>).detail?.id;
      if (id && uuidPattern.test(id)) setPingId(id);
    };

    readHash();
    window.addEventListener("ping:open-detail", handleOpen as EventListener);
    window.addEventListener("hashchange", readHash);
    return () => {
      window.removeEventListener("ping:open-detail", handleOpen as EventListener);
      window.removeEventListener("hashchange", readHash);
    };
  }, []);

  const loadState = useCallback(async () => {
    if (!pingId) {
      setOwnerId(null);
      setStatus(null);
      setFollowed(false);
      return;
    }

    try {
      const supabase = createClient();
      const [{ data: authData }, pingResult] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from("pings").select("user_id,status").eq("id", pingId).single(),
      ]);

      const userId = authData.session?.user.id || null;
      setCurrentUserId(userId);

      if (pingResult.error) {
        setOwnerId(null);
        setStatus(null);
        setFollowed(false);
        return;
      }

      const ping = pingResult.data as PingIdentity;
      setOwnerId(ping.user_id);
      setStatus(ping.status);

      if (userId && userId !== ping.user_id) {
        const { data, error } = await supabase.rpc("ping_follow_state", { target_ping_id: pingId });
        setFollowed(!error && Boolean(data));
      } else {
        setFollowed(false);
      }
    } catch (error) {
      console.error("Follow state failed", error);
    }
  }, [pingId]);

  useEffect(() => { void loadState(); }, [loadState]);

  useEffect(() => {
    const ensureHost = () => {
      const actions = document.querySelector<HTMLElement>(".phase5-detail-sheet .phase5-detail-actions");
      if (!actions || !pingId) {
        if (host) host.classList.remove("phase8-follow-enabled");
        setHost(null);
        return;
      }
      actions.classList.add("phase8-follow-enabled");
      setHost(actions);
    };

    ensureHost();
    const observer = new MutationObserver(ensureHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelector<HTMLElement>(".phase5-detail-actions.phase8-follow-enabled")?.classList.remove("phase8-follow-enabled");
    };
  }, [pingId]);

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user.id || null);
      setTimeout(() => void loadState(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadState]);

  const toggleFollow = async () => {
    if (!pingId || busy) return;
    if (!currentUserId) {
      window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to follow this Ping and get its outcome." } }));
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await createClient().rpc("toggle_follow_ping", { target_ping_id: pingId });
      if (error) throw error;
      const next = Boolean(data);
      setFollowed(next);
      window.dispatchEvent(new CustomEvent("ping:follow-changed", { detail: { pingId, followed: next } }));
    } catch (error) {
      console.error("Follow toggle failed", error);
    } finally {
      setBusy(false);
    }
  };

  const resolvePing = async () => {
    if (!pingId || !currentUserId || currentUserId !== ownerId || busy) return;
    if (!window.confirm("Mark this Ping as resolved? It will leave the live Feed and followers will be told the outcome.")) return;

    setBusy(true);
    try {
      const { error } = await createClient().rpc("resolve_own_ping", { target_ping_id: pingId });
      if (error) throw error;
      window.dispatchEvent(new CustomEvent("ping:community-changed", { detail: { kind: "resolved", pingId } }));
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      window.location.reload();
    } catch (error) {
      console.error("Resolve Ping failed", error);
      window.alert("This Ping could not be resolved right now.");
      setBusy(false);
    }
  };

  if (!host || !pingId || status !== "active" || !ownerId) return null;

  const mine = currentUserId === ownerId;

  return createPortal(
    <>
      {mine ? (
        <button className="phase8-follow-action phase8-resolve" type="button" onClick={() => void resolvePing()} disabled={busy}>
          {busy ? "…" : "✓ Resolve"}
        </button>
      ) : (
        <button className={`phase8-follow-action ${followed ? "selected" : ""}`} type="button" onClick={() => void toggleFollow()} disabled={busy}>
          {busy ? "…" : followed ? "★ Following" : "☆ Follow"}
        </button>
      )}
      <style jsx global>{`
        .phase5-detail-actions.phase8-follow-enabled{grid-template-columns:repeat(5,1fr)}
        .phase5-detail-actions .phase8-follow-action{border-color:#cfe1ca;background:#f4faef;color:#35643b}
        .phase5-detail-actions .phase8-follow-action.selected{background:#dff3d9;border-color:#a8dca0;color:#285f30}
        .phase5-detail-actions .phase8-follow-action.phase8-resolve{background:#edf5e9;border-color:#c9dfc4;color:#32613a}
        @media(max-width:520px){.phase5-detail-actions.phase8-follow-enabled{grid-template-columns:repeat(2,1fr)}}
      `}</style>
    </>,
    host,
  );
}
