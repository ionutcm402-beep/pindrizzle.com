"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PingIcon from "@/components/PingIcon";

type BlockRow = { blocked_id: string; created_at: string };
type BlockedUser = { id: string; displayName: string; createdAt: string };
type HiddenRow = { ping_id: string; created_at: string };
type HiddenPing = { id: string; title: string; createdAt: string };

export default function PrivacySafetyCenter() {
  const [open, setOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [hiddenPings, setHiddenPings] = useState<HiddenPing[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadSafetyData = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session?.user) {
        setOpen(false);
        window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to manage privacy, reports and blocked users." } }));
        return;
      }

      const [blockResult, hideResult, reportResult] = await Promise.all([
        supabase.from("blocks").select("blocked_id,created_at").order("created_at", { ascending: false }),
        supabase.from("ping_hides").select("ping_id,created_at").order("created_at", { ascending: false }),
        supabase.from("reports").select("id", { count: "exact", head: true }),
      ]);

      if (blockResult.error) throw blockResult.error;
      if (hideResult.error) throw hideResult.error;
      if (reportResult.error) throw reportResult.error;

      const blockRows = (blockResult.data || []) as BlockRow[];
      const blockedIds = blockRows.map((row) => row.blocked_id);
      if (blockedIds.length) {
        const { data: profiles, error } = await supabase.from("profiles").select("id,display_name").in("id", blockedIds);
        if (error) throw error;
        const names = new Map((profiles || []).map((profile) => [profile.id as string, profile.display_name as string]));
        setBlockedUsers(blockRows.map((row) => ({ id: row.blocked_id, displayName: names.get(row.blocked_id) || "Blocked neighbour", createdAt: row.created_at })));
      } else {
        setBlockedUsers([]);
      }

      const hideRows = (hideResult.data || []) as HiddenRow[];
      const hiddenIds = hideRows.map((row) => row.ping_id);
      if (hiddenIds.length) {
        const { data: pings, error } = await supabase.from("pings").select("id,title").in("id", hiddenIds);
        if (error) throw error;
        const titles = new Map((pings || []).map((ping) => [ping.id as string, ping.title as string]));
        setHiddenPings(hideRows.map((row) => ({ id: row.ping_id, title: titles.get(row.ping_id) || "Reported pin", createdAt: row.created_at })));
      } else {
        setHiddenPings([]);
      }

      setReportCount(reportResult.count || 0);
    } catch (error) {
      console.error("Safety Center failed", error);
      setMessage("Safety settings could not load right now.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const openSafetyCenter = () => {
      setOpen(true);
      void loadSafetyData();
    };
    window.addEventListener("ping:open-privacy", openSafetyCenter);
    return () => window.removeEventListener("ping:open-privacy", openSafetyCenter);
  }, [loadSafetyData]);

  const unblock = async (blockedId: string) => {
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await createClient().rpc("toggle_block_user", { target_user_id: blockedId });
      if (error) throw error;
      if (Boolean(data)) throw new Error("Expected unblock result");
      setBlockedUsers((current) => current.filter((user) => user.id !== blockedId));
      setMessage("User unblocked. Their live pins can appear again.");
      window.dispatchEvent(new CustomEvent("ping:community-changed", { detail: { kind: "block" } }));
      window.setTimeout(() => window.location.reload(), 550);
    } catch (error) {
      console.error("Unblock failed", error);
      setMessage("That user could not be unblocked right now.");
    } finally {
      setBusy(false);
    }
  };

  const unhide = async (pingId: string) => {
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await createClient().rpc("unhide_ping", { target_ping_id: pingId });
      if (error) throw error;
      if (!Boolean(data)) throw new Error("Pin was not hidden");
      setHiddenPings((current) => current.filter((ping) => ping.id !== pingId));
      setMessage("Pin unhidden. Your report remains submitted for review.");
      window.dispatchEvent(new CustomEvent("ping:community-changed", { detail: { kind: "safety" } }));
    } catch (error) {
      console.error("Unhide failed", error);
      setMessage("That pin could not be unhidden right now.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="phase5-privacy-backdrop" role="dialog" aria-modal="true" aria-label="Privacy and safety" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section className="phase5-privacy-sheet">
        <div className="phase5-privacy-handle" />
        <header><button type="button" onClick={() => setOpen(false)}>Close</button><strong>Safety Center</strong><span /></header>

        <div className="phase5-privacy-summary">
          <div><PingIcon name="shield" size={28}/></div>
          <div><h2>You control what reaches you.</h2><p>Blocking hides a person. Reporting hides that pin for you immediately and sends the report for review. Reports do not automatically remove a neighbour’s pin for everyone.</p></div>
        </div>

        <div className="phase7-safety-stats">
          <div><strong>{blockedUsers.length}</strong><span>Blocked</span></div>
          <div><strong>{hiddenPings.length}</strong><span>Hidden pins</span></div>
          <div><strong>{reportCount}</strong><span>Reports</span></div>
        </div>

        <div className="phase5-blocked-head"><strong>Reported & hidden pins</strong><span>{hiddenPings.length}</span></div>
        {busy && !hiddenPings.length ? <div className="phase5-privacy-empty">Loading Safety Center…</div> : hiddenPings.length ? (
          <div className="phase5-blocked-list">
            {hiddenPings.map((ping) => (
              <div key={ping.id} className="phase5-blocked-user">
                <div className="phase5-blocked-avatar"><PingIcon name="review" size={17}/></div>
                <div><strong>{ping.title}</strong><small>Hidden from your Feed and Map</small></div>
                <button type="button" onClick={() => unhide(ping.id)} disabled={busy}>Unhide</button>
              </div>
            ))}
          </div>
        ) : <div className="phase5-privacy-empty">You haven’t hidden any reported pins.</div>}

        <div className="phase5-blocked-head"><strong>Blocked users</strong><span>{blockedUsers.length}</span></div>
        {blockedUsers.length ? (
          <div className="phase5-blocked-list">
            {blockedUsers.map((user) => (
              <div key={user.id} className="phase5-blocked-user">
                <div className="phase5-blocked-avatar">{user.displayName.slice(0, 2).toUpperCase()}</div>
                <div><strong>{user.displayName}</strong><small>Blocked from your local Feed and Map</small></div>
                <button type="button" onClick={() => unblock(user.id)} disabled={busy}>Unblock</button>
              </div>
            ))}
          </div>
        ) : <div className="phase5-privacy-empty">You haven’t blocked anyone.</div>}

        <div className="phase7-safety-note"><strong>Location privacy</strong><p>Private is the default when you drop a pin and stores a privacy-safe approximate map point. Exact location becomes public only when you deliberately choose Exact for that pin.</p></div>
        {message && <div className="phase5-privacy-message">{message}</div>}
      </section>
      <style jsx global>{`
        .phase5-privacy-backdrop{position:fixed;inset:0;z-index:96;background:rgba(17,25,18,.54);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:14px}.phase5-privacy-sheet{width:min(100%,440px);max-height:92vh;overflow:auto;background:#fbfbf7;border-radius:30px 30px 22px 22px;padding:10px 18px 24px;box-shadow:0 -24px 70px rgba(17,25,18,.3);color:#172019}.phase5-privacy-handle{width:44px;height:5px;border-radius:999px;background:#d6ddd3;margin:2px auto 12px}.phase5-privacy-sheet header{display:grid;grid-template-columns:1fr 2fr 1fr;align-items:center}.phase5-privacy-sheet header strong{text-align:center}.phase5-privacy-sheet header button{justify-self:start;border:0;background:transparent;color:#5d6c61;font-weight:800;padding:8px 0}.phase5-privacy-summary{margin-top:16px;padding:20px;border-radius:22px;background:#edf5e9;text-align:left;display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:start}.phase5-privacy-summary>div:first-child{width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:#fff;color:#0b7198}.phase5-privacy-summary h2{margin:2px 0 7px;font-size:20px}.phase5-privacy-summary p{margin:0;color:#647168;font-size:11px;line-height:1.55}.phase7-safety-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.phase7-safety-stats div{background:#f1f4ef;border-radius:15px;padding:12px 6px;text-align:center}.phase7-safety-stats strong{display:block;font-size:18px}.phase7-safety-stats span{display:block;margin-top:3px;color:#758077;font-size:8px;font-weight:800}.phase5-blocked-head{display:flex;align-items:center;gap:8px;margin:22px 2px 10px}.phase5-blocked-head span{min-width:23px;height:23px;border-radius:999px;background:#e6ede3;display:grid;place-items:center;font-size:10px;font-weight:900}.phase5-blocked-list{display:grid;gap:9px}.phase5-blocked-user{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:12px;border-radius:17px;background:#f1f4ef}.phase5-blocked-avatar{width:42px;height:42px;border-radius:14px;background:#dfeadb;display:grid;place-items:center;color:#326039;font-size:10px;font-weight:1000}.phase5-blocked-user strong{display:block;font-size:12px}.phase5-blocked-user small{display:block;margin-top:3px;color:#7a857c;font-size:9px}.phase5-blocked-user button{border:1px solid #d9e1d6;border-radius:11px;background:white;padding:8px 9px;font-size:9px;font-weight:850}.phase5-privacy-empty{padding:20px;border:1px dashed #dfe5dc;border-radius:16px;text-align:center;color:#788379;font-size:11px}.phase7-safety-note{margin-top:20px;padding:14px 15px;border-radius:16px;background:#f4f6f2}.phase7-safety-note strong{font-size:11px}.phase7-safety-note p{margin:5px 0 0;color:#707b72;font-size:9px;line-height:1.5}.phase5-privacy-message{margin-top:10px;padding:10px 11px;border-radius:13px;background:#eaf7e7;color:#2f6035;font-size:10px;font-weight:750}@media(max-width:520px){.phase5-privacy-backdrop{padding:0}.phase5-privacy-sheet{border-radius:28px 28px 0 0;max-height:96vh}}
      `}</style>
    </div>
  );
}
