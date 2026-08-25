"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type StatsRow = { helpful_pings: number; confirmations: number };
type BlockRow = { blocked_id: string; created_at: string };
type BlockedUser = { id: string; displayName: string; createdAt: string };

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null;
  if (value && typeof value === "object") return value as T;
  return null;
}

export default function Phase5CommunityBridge() {
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsRow | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState("");

  const loadStats = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      const activeUserId = authData.session?.user.id || null;
      setUserId(activeUserId);
      if (!activeUserId) {
        setStats(null);
        return;
      }
      const { data, error } = await supabase.rpc("my_community_stats");
      if (error) throw error;
      const row = firstRow<StatsRow>(data);
      setStats(row || { helpful_pings: 0, confirmations: 0 });
    } catch (error) {
      console.error("Community stats failed", error);
    }
  }, []);

  const loadBlockedUsers = useCallback(async () => {
    setPrivacyBusy(true);
    setPrivacyMessage("");
    try {
      const supabase = createClient();
      const { data: blockRows, error: blockError } = await supabase
        .from("blocks")
        .select("blocked_id,created_at")
        .order("created_at", { ascending: false });
      if (blockError) throw blockError;
      const rows = (blockRows || []) as BlockRow[];
      const ids = rows.map((row) => row.blocked_id);
      if (!ids.length) {
        setBlockedUsers([]);
        return;
      }
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", ids);
      if (profileError) throw profileError;
      const names = new Map((profiles || []).map((profile) => [profile.id as string, profile.display_name as string]));
      setBlockedUsers(rows.map((row) => ({
        id: row.blocked_id,
        displayName: names.get(row.blocked_id) || "Blocked neighbour",
        createdAt: row.created_at,
      })));
    } catch (error) {
      console.error("Blocked users failed", error);
      setPrivacyMessage("Blocked users could not load right now.");
    } finally {
      setPrivacyBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id || null);
      setTimeout(() => { void loadStats(); }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadStats]);

  useEffect(() => {
    const applyStats = () => {
      const row = document.querySelector<HTMLElement>(".trust-row");
      if (!row) return;
      const values = row.querySelectorAll<HTMLElement>("strong");
      if (values.length < 2) return;
      const helpful = userId ? String(stats?.helpful_pings ?? 0) : "—";
      const confirmations = userId ? String(stats?.confirmations ?? 0) : "—";
      if (values[0].textContent !== helpful) values[0].textContent = helpful;
      if (values[1].textContent !== confirmations) values[1].textContent = confirmations;
    };
    applyStats();
    const observer = new MutationObserver(applyStats);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [stats, userId]);

  useEffect(() => {
    const handleCommunityChanged = () => { void loadStats(); };
    window.addEventListener("ping:community-changed", handleCommunityChanged);
    return () => window.removeEventListener("ping:community-changed", handleCommunityChanged);
  }, [loadStats]);

  useEffect(() => {
    const handlePrivacyClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>(".settings-list button");
      if (!button || !button.textContent?.includes("Privacy & safety")) return;
      event.preventDefault();
      event.stopPropagation();
      if (!userId) {
        window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to manage privacy and blocked users." } }));
        return;
      }
      setPrivacyOpen(true);
      void loadBlockedUsers();
    };
    document.addEventListener("click", handlePrivacyClick, true);
    return () => document.removeEventListener("click", handlePrivacyClick, true);
  }, [loadBlockedUsers, userId]);

  const unblock = async (blockedId: string) => {
    setPrivacyBusy(true);
    setPrivacyMessage("");
    try {
      const { data, error } = await createClient().rpc("toggle_block_user", { target_user_id: blockedId });
      if (error) throw error;
      if (Boolean(data)) throw new Error("Expected unblock result");
      setBlockedUsers((current) => current.filter((user) => user.id !== blockedId));
      setPrivacyMessage("User unblocked. Their live Pings can appear again.");
      window.dispatchEvent(new CustomEvent("ping:community-changed", { detail: { kind: "block" } }));
      setTimeout(() => window.location.reload(), 550);
    } catch (error) {
      console.error("Unblock failed", error);
      setPrivacyMessage("That user could not be unblocked right now.");
    } finally {
      setPrivacyBusy(false);
    }
  };

  if (!privacyOpen) return null;

  return (
    <div className="phase5-privacy-backdrop" role="dialog" aria-modal="true" aria-label="Privacy and safety" onMouseDown={(event) => event.target === event.currentTarget && setPrivacyOpen(false)}>
      <section className="phase5-privacy-sheet">
        <div className="phase5-privacy-handle" />
        <header><button type="button" onClick={() => setPrivacyOpen(false)}>Close</button><strong>Privacy & safety</strong><span /></header>
        <div className="phase5-privacy-summary">
          <div>🛡️</div>
          <h2>Your location stays local.</h2>
          <p>Ping uses your location to find nearby activity. Other users do not receive your profile home coordinates, and personal Ping markers are deliberately made less precise.</p>
        </div>
        <div className="phase5-blocked-head"><strong>Blocked users</strong><span>{blockedUsers.length}</span></div>
        {privacyBusy && !blockedUsers.length ? <div className="phase5-privacy-empty">Loading blocked users…</div> : blockedUsers.length ? (
          <div className="phase5-blocked-list">
            {blockedUsers.map((user) => (
              <div key={user.id} className="phase5-blocked-user">
                <div className="phase5-blocked-avatar">{user.displayName.slice(0, 2).toUpperCase()}</div>
                <div><strong>{user.displayName}</strong><small>Blocked from your local Feed and Map</small></div>
                <button type="button" onClick={() => unblock(user.id)} disabled={privacyBusy}>Unblock</button>
              </div>
            ))}
          </div>
        ) : <div className="phase5-privacy-empty">You haven’t blocked anyone.</div>}
        {privacyMessage && <div className="phase5-privacy-message">{privacyMessage}</div>}
      </section>
      <style jsx global>{`
        .phase5-privacy-backdrop{position:fixed;inset:0;z-index:96;background:rgba(17,25,18,.54);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:14px}.phase5-privacy-sheet{width:min(100%,440px);max-height:92vh;overflow:auto;background:#fbfbf7;border-radius:30px 30px 22px 22px;padding:10px 18px 24px;box-shadow:0 -24px 70px rgba(17,25,18,.3);color:#172019}.phase5-privacy-handle{width:44px;height:5px;border-radius:999px;background:#d6ddd3;margin:2px auto 12px}.phase5-privacy-sheet header{display:grid;grid-template-columns:1fr 2fr 1fr;align-items:center}.phase5-privacy-sheet header strong{text-align:center}.phase5-privacy-sheet header button{justify-self:start;border:0;background:transparent;color:#5d6c61;font-weight:800;padding:8px 0}.phase5-privacy-summary{margin-top:16px;padding:20px;border-radius:22px;background:#edf5e9;text-align:center}.phase5-privacy-summary>div{font-size:32px}.phase5-privacy-summary h2{margin:8px 0 7px;font-size:20px}.phase5-privacy-summary p{margin:0;color:#647168;font-size:11px;line-height:1.55}.phase5-blocked-head{display:flex;align-items:center;gap:8px;margin:22px 2px 10px}.phase5-blocked-head span{min-width:23px;height:23px;border-radius:999px;background:#e6ede3;display:grid;place-items:center;font-size:10px;font-weight:900}.phase5-blocked-list{display:grid;gap:9px}.phase5-blocked-user{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:12px;border-radius:17px;background:#f1f4ef}.phase5-blocked-avatar{width:42px;height:42px;border-radius:14px;background:#dfeadb;display:grid;place-items:center;color:#326039;font-size:10px;font-weight:1000}.phase5-blocked-user strong{display:block;font-size:12px}.phase5-blocked-user small{display:block;margin-top:3px;color:#7a857c;font-size:9px}.phase5-blocked-user button{border:1px solid #d9e1d6;border-radius:11px;background:white;padding:8px 9px;font-size:9px;font-weight:850}.phase5-privacy-empty{padding:20px;border:1px dashed #dfe5dc;border-radius:16px;text-align:center;color:#788379;font-size:11px}.phase5-privacy-message{margin-top:10px;padding:10px 11px;border-radius:13px;background:#eaf7e7;color:#2f6035;font-size:10px;font-weight:750}@media(max-width:520px){.phase5-privacy-backdrop{padding:0}.phase5-privacy-sheet{border-radius:28px 28px 0 0;max-height:96vh}}
      `}</style>
    </div>
  );
}
