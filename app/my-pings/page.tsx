"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PingStatus = "active" | "resolved" | "expired" | "removed";
type PingCategory = "alert" | "traffic" | "lost_found" | "free" | "help" | "local";
type Filter = "all" | "live" | "history";

type MyPing = {
  id: string;
  category: PingCategory;
  title: string;
  body: string;
  place_label: string | null;
  status: PingStatus;
  confirmation_count: number;
  comment_count: number;
  created_at: string;
  expires_at: string;
  updated_at: string;
  has_open_promotion: boolean;
};

const categoryLabels: Record<PingCategory, string> = {
  alert: "Alert",
  traffic: "Traffic",
  lost_found: "Lost & Found",
  free: "Free",
  help: "Help",
  local: "Local",
};

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function effectiveStatus(item: MyPing): "live" | "resolved" | "expired" {
  if (item.status === "resolved") return "resolved";
  if (item.status === "expired" || new Date(item.expires_at).getTime() <= Date.now()) return "expired";
  return "live";
}

function statusLabel(item: MyPing) {
  const status = effectiveStatus(item);
  if (status === "resolved") return "Resolved";
  if (status === "expired") return "Expired";
  return "Live";
}

export default function MyPingsPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [items, setItems] = useState<MyPing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
    return () => data.subscription.unsubscribe();
  }, [load]);

  useEffect(() => {
    if (!signedIn) return;
    const supabase = createClient();
    const channel = supabase
      .channel("my-pings-management")
      .on("postgres_changes", { event: "*", schema: "public", table: "pings" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [signedIn, load]);

  const counts = useMemo(() => {
    let live = 0;
    let history = 0;
    for (const item of items) {
      if (effectiveStatus(item) === "live") live += 1;
      else history += 1;
    }
    return { all: items.length, live, history };
  }, [items]);

  const visible = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "live") return items.filter((item) => effectiveStatus(item) === "live");
    return items.filter((item) => effectiveStatus(item) !== "live");
  }, [items, filter]);

  const resolvePing = async (id: string) => {
    setBusyId(id);
    setMessage("");
    try {
      const { error } = await createClient().rpc("resolve_own_ping", { target_ping_id: id });
      if (error) throw error;
      await load();
      window.dispatchEvent(new CustomEvent("ping:own-pings-changed"));
    } catch (error) {
      console.error("Resolve Ping failed", error);
      setMessage("That Ping could not be resolved right now.");
    } finally {
      setBusyId(null);
    }
  };

  const deletePing = async (item: MyPing) => {
    if (item.has_open_promotion) {
      setMessage("This Ping has a promotion in progress. Finish the promotion before deleting it.");
      return;
    }

    setBusyId(item.id);
    setMessage("");
    try {
      const { error } = await createClient().rpc("remove_own_ping", { target_ping_id: item.id });
      if (error) throw error;
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      setConfirmDeleteId(null);
      window.dispatchEvent(new CustomEvent("ping:own-pings-changed"));
    } catch (error) {
      console.error("Delete Ping failed", error);
      setMessage("That Ping could not be deleted right now.");
    } finally {
      setBusyId(null);
    }
  };

  const openPing = (item: MyPing) => {
    if (effectiveStatus(item) !== "live") return;
    window.dispatchEvent(new CustomEvent("ping:open-detail", { detail: { id: item.id, live: true } }));
  };

  const openAuth = () => window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to manage the Pings you create." } }));

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="my-pings-screen">
          <header className="my-pings-header">
            <a href="/you" className="my-pings-back" aria-label="Back to You">‹</a>
            <div><div className="brand small">ping<span>.</span></div><h1>My Pings</h1></div>
          </header>

          {!loading && signedIn === false ? (
            <section className="my-pings-empty">
              <div className="my-pings-empty-icon" aria-hidden="true" />
              <h2>Your Pings live here.</h2>
              <p>Sign in to see, resolve and delete the local updates you create.</p>
              <button type="button" onClick={openAuth}>Sign in / Sign up</button>
            </section>
          ) : (
            <>
              <section className="my-pings-summary" aria-label="Your Ping summary">
                <div><strong>{counts.live}</strong><span>Live</span></div>
                <div><strong>{counts.history}</strong><span>History</span></div>
                <div><strong>{counts.all}</strong><span>Total</span></div>
              </section>

              <div className="my-pings-filters" role="group" aria-label="Filter My Pings">
                <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
                <button type="button" className={filter === "live" ? "active" : ""} onClick={() => setFilter("live")}>Live</button>
                <button type="button" className={filter === "history" ? "active" : ""} onClick={() => setFilter("history")}>History</button>
              </div>

              {loading ? (
                <section className="my-pings-empty"><h2>Checking your Pings…</h2></section>
              ) : visible.length ? (
                <section className="my-pings-list">
                  {visible.map((item) => {
                    const status = effectiveStatus(item);
                    const deleting = confirmDeleteId === item.id;
                    return (
                      <article key={item.id} className={`my-ping-card ${status}`}>
                        <div className="my-ping-card-top">
                          <span className={`my-ping-category ${item.category}`}><i aria-hidden="true" />{categoryLabels[item.category]}</span>
                          <span className={`my-ping-status ${status}`}>{statusLabel(item)}</span>
                        </div>
                        <button type="button" className="my-ping-content" onClick={() => openPing(item)} disabled={status !== "live"}>
                          <h2>{item.title}</h2>
                          <p>{item.body}</p>
                          <div className="my-ping-meta">
                            <span>{item.place_label || "Nearby"}</span>
                            <span>{item.confirmation_count} confirmed</span>
                            <span>{item.comment_count} replies</span>
                          </div>
                          <small>Posted {relativeTime(item.created_at)}</small>
                        </button>

                        {item.has_open_promotion && <div className="my-ping-promotion-note">Promotion in progress</div>}

                        {!deleting ? (
                          <div className="my-ping-actions">
                            {status === "live" && <button type="button" onClick={() => openPing(item)}>Open</button>}
                            {status === "live" && <button type="button" onClick={() => void resolvePing(item.id)} disabled={busyId === item.id}>{busyId === item.id ? "Working…" : "Resolve"}</button>}
                            <button type="button" className="danger" onClick={() => setConfirmDeleteId(item.id)} disabled={busyId === item.id || item.has_open_promotion}>Delete</button>
                          </div>
                        ) : (
                          <div className="my-ping-delete-confirm" role="alert">
                            <div><strong>Delete this Ping?</strong><span>It will disappear from the community. Safety records are retained.</span></div>
                            <div>
                              <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={busyId === item.id}>Cancel</button>
                              <button type="button" className="danger" onClick={() => void deletePing(item)} disabled={busyId === item.id}>{busyId === item.id ? "Deleting…" : "Delete Ping"}</button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>
              ) : (
                <section className="my-pings-empty">
                  <div className="my-pings-empty-icon" aria-hidden="true" />
                  <h2>{filter === "live" ? "No live Pings." : filter === "history" ? "No Ping history yet." : "You haven’t posted a Ping yet."}</h2>
                  <p>{filter === "all" ? "Create a useful local update and it will appear here automatically." : "Choose another filter to see the rest of your Pings."}</p>
                  {filter === "all" && <a href="/#ping">Create a Ping</a>}
                </section>
              )}
            </>
          )}

          {message && <div className="my-pings-message" role="status">{message}</div>}
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          <a href="/"><span>⌂</span>Feed</a>
          <a href="/map"><span>⌖</span>Map</a>
          <a href="/#ping" className="compose-nav"><span>+</span>Ping</a>
          <a href="/alerts"><span>♢</span>Alerts</a>
          <a href="/you" className="active"><span>○</span>You</a>
        </nav>
      </div>
    </div>
  );
}
