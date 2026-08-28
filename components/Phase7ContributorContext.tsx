"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type ContributorContext = {
  profile_id: string;
  display_name: string;
  helpful_pings: number;
  confirmations: number;
  member_since: string;
  reputation_points: number;
  reputation_level: string;
};

type OpenPingEvent = { id?: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null;
  if (value && typeof value === "object") return value as T;
  return null;
}

function memberLabel(value: string) {
  const joined = new Date(value).getTime();
  const days = Math.max(0, Math.floor((Date.now() - joined) / 86400000));
  if (days < 1) return "Joined today";
  if (days < 30) return `Member for ${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Member for ${months}mo`;
  const years = Math.floor(months / 12);
  return `Member for ${years}y`;
}

export default function Phase7ContributorContext() {
  const [pingId, setPingId] = useState<string | null>(null);
  const [context, setContext] = useState<ContributorContext | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#ping=")) return;
      const id = decodeURIComponent(hash.slice(6));
      if (uuidPattern.test(id)) setPingId(id);
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

  useEffect(() => {
    if (!pingId) {
      setContext(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const { data, error } = await createClient().rpc("ping_author_profile_context", { target_ping_id: pingId });
      if (cancelled) return;
      if (error) {
        console.error("Contributor context failed", error);
        setContext(null);
        return;
      }
      setContext(firstRow<ContributorContext>(data));
    };

    void load();
    return () => { cancelled = true; };
  }, [pingId]);

  useEffect(() => {
    const ensureHost = () => {
      const sheet = document.querySelector<HTMLElement>(".detail-v3-sheet");
      const trust = sheet?.querySelector<HTMLElement>(".detail-v3-trust");
      if (!sheet || !trust) {
        setHost(null);
        return;
      }

      let anchor = sheet.querySelector<HTMLElement>(".phase7-contributor-anchor");
      if (!anchor) {
        anchor = document.createElement("div");
        anchor.className = "phase7-contributor-anchor";
        sheet.insertBefore(anchor, trust);
      }
      setHost(anchor);
    };

    ensureHost();
    const observer = new MutationObserver(ensureHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const initials = useMemo(() => {
    const name = context?.display_name?.trim() || "Neighbour";
    return name.slice(0, 2).toUpperCase();
  }, [context?.display_name]);

  if (!host || !context) return null;

  return createPortal(
    <>
      <div className="phase7-contributor-card" aria-label="Contributor profile">
        <div className="phase7-contributor-avatar">{initials}</div>
        <div className="phase7-contributor-copy">
          <span>Contributor profile</span>
          <strong>{context.display_name}</strong>
          <small>{memberLabel(context.member_since)} · {context.reputation_level}</small>
        </div>
        <div className="phase7-contributor-signals">
          <div><strong>{context.helpful_pings}</strong><span>Helpful earned</span></div>
          <div><strong>{context.confirmations}</strong><span>Confirms earned</span></div>
        </div>
        <a className="phase7-profile-link" href={`/profile/${context.profile_id}`}>View profile <span>›</span></a>
      </div>
      <style jsx global>{`
        .phase7-contributor-anchor{margin:14px 0 0}.phase7-contributor-card{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:12px 13px;border:1px solid #dfe7dc;border-radius:17px;background:#f5f8f2;color:#172019}.phase7-contributor-avatar{width:42px;height:42px;border-radius:14px;background:#dfeadb;display:grid;place-items:center;color:#326039;font-size:10px;font-weight:1000}.phase7-contributor-copy>span{display:block;color:#758078;font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.45px}.phase7-contributor-copy>strong{display:block;margin-top:2px;font-size:12px}.phase7-contributor-copy>small{display:block;margin-top:2px;color:#7d877f;font-size:8px}.phase7-contributor-signals{display:flex;gap:6px}.phase7-contributor-signals div{min-width:62px;padding:7px 6px;border-radius:11px;background:#fff;text-align:center}.phase7-contributor-signals strong{display:block;font-size:12px}.phase7-contributor-signals span{display:block;margin-top:1px;color:#7a857c;font-size:7px;font-weight:750;white-space:nowrap}.phase7-profile-link{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;margin-top:1px;padding:9px 10px;border-radius:11px;background:#fff;color:#326039;text-decoration:none;font-size:9px;font-weight:900}.phase7-profile-link span{font-size:15px;line-height:1}@media(max-width:420px){.phase7-contributor-card{grid-template-columns:38px 1fr}.phase7-contributor-signals{grid-column:1/-1}.phase7-contributor-signals div{flex:1}}
      `}</style>
    </>,
    host,
  );
}
