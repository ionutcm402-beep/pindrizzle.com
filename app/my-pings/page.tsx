"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PingIcon, { type PingIconName } from "@/components/PingIcon";
import styles from "./my-pings.module.css";

type PingStatus = "active" | "resolved" | "expired" | "removed";
type PingCategory = "alert" | "traffic" | "lost_found" | "free" | "help" | "local";
type MyPing = {
  id: string;
  title: string;
  body: string;
  category: PingCategory;
  status: PingStatus;
  place_label: string | null;
  confirmation_count: number;
  comment_count: number;
  created_at: string;
  expires_at: string;
  updated_at: string;
  has_open_promotion: boolean;
};

const tabs: Array<{ value: PingStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
  { value: "expired", label: "Expired" },
  { value: "removed", label: "Removed" },
];

const categoryMeta: Record<PingCategory, { label: string; icon: PingIconName }> = {
  alert: { label: "Alert", icon: "alert" },
  traffic: { label: "Traffic", icon: "traffic" },
  lost_found: { label: "Lost & Found", icon: "lostFound" },
  free: { label: "Free", icon: "free" },
  help: { label: "Help", icon: "help" },
  local: { label: "Local", icon: "local" },
};

function effectiveStatus(item: MyPing): PingStatus {
  if (item.status === "active" && new Date(item.expires_at).getTime() <= Date.now()) return "expired";
  return item.status;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(value));
}

function expiryLabel(item: MyPing) {
  const status = effectiveStatus(item);
  if (status === "expired") return `Expired ${relativeTime(item.expires_at)}`;
  if (status !== "active") return status === "resolved" ? "Resolved" : "Removed";
  const ms = new Date(item.expires_at).getTime() - Date.now();
  const hours = Math.max(1, Math.ceil(ms / 3600000));
  return hours < 24 ? `Expires in ${hours}h` : `Expires in ${Math.ceil(hours / 24)}d`;
}

function emptyCopy(status: PingStatus) {
  if (status === "active") return "Your live local updates will appear here after you post them.";
  if (status === "resolved") return "When you mark a situation resolved, it will be kept here as part of your history.";
  if (status === "expired") return "Pings that reach their expiry time will be kept here for you.";
  return "Removed Pings stay in your private history so moderation and audit records remain intact.";
}

function errorText(value: unknown) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value) {
    return String((value as { message?: unknown }).message || "");
  }
  return "";
}

export default function MyPingsPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [items, setItems] = useState<MyPing[]>([]);
  const [selected, setSelected] = useState<PingStatus>("active");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session?.user) {
        setSignedIn(false);
        setItems([]);
        return;
      }
      setSignedIn(true);
      const { data, error } = await supabase.rpc("my_pings");
      if (error) throw error;
      setItems((data || []) as MyPing[]);
    } catch (error) {
      console.error("My Pings failed", error);
      setMessage("Your Pings could not load right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => window.setTimeout(() => void load(), 0));
    const onFocus = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  const normalized = useMemo(() => items.map((item) => ({ ...item, status: effectiveStatus(item) })), [items]);
  const counts = useMemo(() => normalized.reduce<Record<PingStatus, number>>((acc, item) => { acc[item.status] += 1; return acc; }, { active: 0, resolved: 0, expired: 0, removed: 0 }), [normalized]);
  const visibleItems = useMemo(() => normalized.filter((item) => item.status === selected), [normalized, selected]);

  const resolvePing = async (id: string) => {
    setBusyId(id);
    setMessage("");
    try {
      const { error } = await createClient().rpc("resolve_own_ping", { target_ping_id: id });
      if (error) throw error;
      setItems((current) => current.map((item) => item.id === id ? { ...item, status: "resolved" } : item));
      setMessage("Ping marked resolved.");
    } catch (error) {
      console.error("Resolve Ping failed", error);
      setMessage("That Ping could not be resolved right now.");
    } finally {
      setBusyId(null);
    }
  };

  const removePing = async (id: string) => {
    setBusyId(id);
    setMessage("");
    try {
      const { error } = await createClient().rpc("remove_own_ping", { target_ping_id: id });
      if (error) throw error;
      setItems((current) => current.map((item) => item.id === id ? { ...item, status: "removed", has_open_promotion: false } : item));
      setConfirmRemoveId(null);
      setMessage("Ping removed from community views. Its audit history is preserved.");
    } catch (error) {
      console.error("Remove Ping failed", error);
      const text = errorText(error).toLowerCase();
      setMessage(text.includes("promotion") ? "This Ping has a promotion in progress. Finish that promotion before removing it." : "That Ping could not be removed right now.");
    } finally {
      setBusyId(null);
    }
  };

  const openAuth = () => window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to manage your Pings." } }));
  const openLivePing = (id: string) => window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { id, live: true } }));

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className={styles.screen}>
          <header className={styles.header}>
            <a href="/you" className={styles.back} aria-label="Back to You">‹</a>
            <div><div className="brand small">ping<span>.</span></div><h1>My Pings</h1><p>Manage what you’ve shared locally.</p></div>
          </header>

          {!loading && signedIn === false ? (
            <section className={styles.empty}><span><PingIcon name="activity" size={25} /></span><h2>Your Pings live here.</h2><p>Sign in to see and manage the local updates you’ve posted.</p><button type="button" onClick={openAuth}>Sign in / Sign up</button></section>
          ) : (
            <>
              <div className={styles.tabs} role="tablist" aria-label="My Ping status">
                {tabs.map((tab) => <button type="button" key={tab.value} role="tab" aria-selected={selected === tab.value} className={selected === tab.value ? styles.selectedTab : ""} onClick={() => setSelected(tab.value)}><span>{tab.label}</span><b>{counts[tab.value]}</b></button>)}
              </div>

              {loading ? (
                <section className={styles.empty}><h2>Checking your Pings…</h2></section>
              ) : visibleItems.length ? (
                <section className={styles.list} aria-live="polite">
                  {visibleItems.map((item) => {
                    const meta = categoryMeta[item.category];
                    const expanded = expandedId === item.id;
                    const confirming = confirmRemoveId === item.id;
                    return (
                      <article key={item.id} className={`${styles.card} ${styles[item.status]}`}>
                        <div className={styles.cardTop}>
                          <span className={styles.category}><i><PingIcon name={meta.icon} size={17} /></i>{meta.label}</span>
                          <span className={styles.status}>{item.status === "active" ? "LIVE" : item.status.toUpperCase()}</span>
                        </div>
                        <h2>{item.title}</h2>
                        <p className={expanded ? styles.bodyExpanded : styles.body}>{item.body}</p>
                        <div className={styles.meta}>
                          <span><PingIcon name="location" size={14} />{item.place_label || "Approximate area"}</span>
                          <span><PingIcon name="confirmations" size={14} />{item.confirmation_count}</span>
                          <span><PingIcon name="replies" size={14} />{item.comment_count}</span>
                        </div>
                        <div className={styles.timeRow}><span>Posted {relativeTime(item.created_at)}</span><span>{expiryLabel(item)}</span></div>
                        {item.has_open_promotion && <div className={styles.promotionNote}><PingIcon name="promote" size={14} /><span>Promotion in progress — removal is unavailable until it finishes.</span></div>}

                        <div className={styles.actions}>
                          <button type="button" onClick={() => setExpandedId(expanded ? null : item.id)}>{expanded ? "Less" : "Details"}</button>
                          {item.status === "active" && <button type="button" onClick={() => openLivePing(item.id)}>Open Ping</button>}
                          {item.status === "active" && <button type="button" className={styles.resolve} onClick={() => void resolvePing(item.id)} disabled={busyId === item.id}><PingIcon name="check" size={15} />{busyId === item.id ? "Working…" : "Resolve"}</button>}
                          {item.status !== "removed" && <button type="button" className={styles.remove} onClick={() => setConfirmRemoveId(confirming ? null : item.id)} disabled={busyId === item.id || item.has_open_promotion} aria-disabled={item.has_open_promotion}><PingIcon name="remove" size={15} />Remove</button>}
                        </div>

                        {confirming && !item.has_open_promotion && (
                          <div className={styles.confirmRemove} role="alert">
                            <div><strong>Remove this Ping?</strong><p>It disappears from normal community views, but replies, reports and audit history are preserved.</p></div>
                            <div><button type="button" onClick={() => setConfirmRemoveId(null)}>Keep</button><button type="button" onClick={() => void removePing(item.id)} disabled={busyId === item.id}>{busyId === item.id ? "Removing…" : "Remove"}</button></div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>
              ) : (
                <section className={styles.empty}><span><PingIcon name={selected === "active" ? "activity" : selected === "resolved" ? "check" : selected === "expired" ? "clock" : "remove"} size={25} /></span><h2>No {selected} Pings.</h2><p>{emptyCopy(selected)}</p>{selected === "active" && <a href="/#ping">Create a Ping</a>}</section>
              )}
            </>
          )}

          {message && <div className={styles.message} role="status">{message}</div>}
        </main>

        <nav className={styles.bottomNav} aria-label="Primary navigation">
          <a href="/"><PingIcon name="feed" />Feed</a>
          <a href="/map"><PingIcon name="map" />Map</a>
          <a href="/#ping" className={styles.compose}><span><PingIcon name="plus" /></span>Ping</a>
          <a href="/alerts"><PingIcon name="alerts" />Alerts</a>
          <a href="/you" className={styles.active}><PingIcon name="user" />You</a>
        </nav>
      </div>
    </div>
  );
}
