"use client";

import { useCallback, useEffect, useState } from "react";
import Phase16PushSettings from "@/components/Phase16PushSettings";
import PingIcon, { type PingIconName } from "@/components/PingIcon";
import { createClient } from "@/lib/supabase/client";

type Preferences = {
  replies_enabled: boolean;
  confirmations_enabled: boolean;
  helpful_enabled: boolean;
};

const defaults: Preferences = {
  replies_enabled: true,
  confirmations_enabled: true,
  helpful_enabled: true,
};

export default function NotificationSettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof Preferences | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      const user = authData.session?.user || null;
      setUserId(user?.id || null);
      setEmail(user?.email || null);
      if (!user) {
        setPreferences(defaults);
        return;
      }
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("replies_enabled,confirmations_enabled,helpful_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      setPreferences(data ? (data as Preferences) : defaults);
    } catch (error) {
      console.error("Notification preferences failed", error);
      setMessage("Your notification settings could not load right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id || null);
      setEmail(session?.user.email || null);
      setTimeout(() => void load(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const openAuth = () => {
    window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to manage your Pindrizzle notifications." } }));
  };

  const toggle = async (key: keyof Preferences) => {
    if (!userId || saving) return;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setSaving(key);
    setMessage("");
    try {
      const { error } = await createClient().from("notification_preferences").upsert({
        user_id: userId,
        ...next,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      setMessage("Saved.");
    } catch (error) {
      console.error("Save notification preference failed", error);
      setPreferences(preferences);
      setMessage("That setting could not be saved. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  const rows: Array<{ key: keyof Preferences; icon: PingIconName; title: string; body: string }> = [
    { key: "replies_enabled", icon: "replies", title: "Replies", body: "When someone replies to your pin or a pin you joined." },
    { key: "confirmations_enabled", icon: "confirmations", title: "Confirmations", body: "When another neighbour confirms one of your pins." },
    { key: "helpful_enabled", icon: "helpful", title: "Helpful", body: "When someone marks one of your pins Helpful." },
  ];

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="notification-settings-screen">
          <header className="notification-settings-header">
            <a href="/you" className="notification-settings-back" aria-label="Back to You"><PingIcon name="back" size={18}/></a>
            <div>
              <div className="brand small">pindrizzle</div>
              <h1>Notifications</h1>
            </div>
          </header>

          {!userId && !loading ? (
            <section className="notification-settings-empty">
              <span className="notification-settings-empty-icon"><PingIcon name="alerts" size={26}/></span>
              <h2>Choose what deserves your attention.</h2>
              <p>Sign in to control which community events appear in Activity.</p>
              <button type="button" onClick={openAuth}>Sign in / Sign up</button>
            </section>
          ) : (
            <>
              <section className="notification-settings-intro">
                <strong>Useful activity only.</strong>
                <p>These controls affect Pindrizzle’s in-app Activity, live badges and any push notifications you enable. Security emails such as password resets are always kept separate.</p>
              </section>

              <Phase16PushSettings userId={userId} authLoading={loading} />

              <section className="notification-settings-list" aria-label="Notification preferences">
                {rows.map((row) => {
                  const enabled = preferences[row.key];
                  return (
                    <button key={row.key} type="button" className="notification-setting-row" onClick={() => toggle(row.key)} disabled={loading || saving !== null}>
                      <span className="notification-setting-icon"><PingIcon name={row.icon} size={20}/></span>
                      <span className="notification-setting-copy"><strong>{row.title}</strong><small>{row.body}</small></span>
                      <span className={`notification-switch ${enabled ? "on" : "off"}`} role="switch" aria-checked={enabled} aria-label={`${row.title} ${enabled ? "on" : "off"}`}><i /></span>
                    </button>
                  );
                })}
              </section>

              <section className="notification-settings-note">
                <strong>What Pindrizzle will not do</strong>
                <p>No “we miss you” spam, follower alerts or engagement bait. Notifications are tied to real community actions.</p>
              </section>

              {email && <div className="notification-settings-account">Settings for <strong>{email}</strong></div>}
              {message && <div className="notification-settings-message">{message}</div>}
            </>
          )}
        </main>
      </div>

      <style jsx global>{`
        .notification-settings-screen{min-height:100%;padding:0 var(--pd-space-3) calc(96px + env(safe-area-inset-bottom));color:var(--pd-text)}
        .notification-settings-header{display:flex;gap:var(--pd-space-2);align-items:flex-start;padding:var(--pd-space-4) 0 var(--pd-space-3)}
        .notification-settings-header h1{margin:var(--pd-space-2) 0 0;font-size:30px;letter-spacing:-.045em;color:var(--pd-ink-950)}
        .notification-settings-back{width:44px;height:44px;flex:0 0 44px;border-radius:var(--pd-radius-pill);display:grid;place-items:center;text-decoration:none;color:var(--pd-ink-800);background:rgba(255,255,255,.82);border:1px solid var(--pd-line);box-shadow:none}
        .notification-settings-intro,.notification-settings-note,.notification-settings-list{border:1px solid var(--pd-line);border-radius:var(--pd-radius-card);background:rgba(255,255,255,.94);box-shadow:var(--pd-elevation-1)}
        .notification-settings-intro{padding:var(--pd-space-3);margin-bottom:var(--pd-space-3);background:linear-gradient(135deg,var(--pd-aqua-100),rgba(255,255,255,.94))}
        .notification-settings-intro strong{font-size:13px}.notification-settings-intro p{margin:var(--pd-space-1) 0 0;color:var(--pd-muted);font-size:11px;line-height:1.5}
        .notification-settings-list{display:grid;overflow:hidden;margin-top:var(--pd-space-3)}
        .notification-setting-row{width:100%;min-height:68px;border:0;border-bottom:1px solid var(--pd-line);background:transparent;padding:var(--pd-space-2) var(--pd-space-3);display:grid;grid-template-columns:44px 1fr auto;gap:var(--pd-space-2);align-items:center;text-align:left;color:var(--pd-text)}
        .notification-setting-row:last-child{border-bottom:0}.notification-setting-row:disabled{opacity:.72}
        .notification-setting-icon{width:44px;height:44px;border-radius:var(--pd-radius-control);background:var(--pd-aqua-100);color:var(--pd-ink-800);display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(37,189,200,.12)}
        .notification-setting-copy strong{display:block;font-size:12px}.notification-setting-copy small{display:block;margin-top:var(--pd-space-1);color:var(--pd-muted);font-size:9px;line-height:1.4}
        .notification-switch{width:44px;height:26px;border-radius:var(--pd-radius-pill);padding:3px;display:flex;align-items:center;transition:.18s ease}.notification-switch.off{background:var(--pd-silver-300);justify-content:flex-start}.notification-switch.on{background:var(--pd-aqua-500);justify-content:flex-end}.notification-switch i{display:block;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(8,43,73,.16)}
        .notification-settings-note{margin-top:var(--pd-space-3);padding:var(--pd-space-3)}.notification-settings-note strong{font-size:11px}.notification-settings-note p{margin:var(--pd-space-1) 0 0;color:var(--pd-muted);font-size:10px;line-height:1.5}
        .notification-settings-account,.notification-settings-message{text-align:center;margin-top:var(--pd-space-3);color:var(--pd-muted);font-size:9px}.notification-settings-message{color:#0b6a82;font-weight:800}
        .notification-settings-empty{display:grid;justify-items:center;gap:var(--pd-space-2);padding:var(--pd-space-5) var(--pd-space-4);border:1px solid var(--pd-line);background:rgba(255,255,255,.94);border-radius:var(--pd-radius-card);box-shadow:var(--pd-elevation-1);text-align:center}
        .notification-settings-empty-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:16px;background:var(--pd-aqua-100);color:#0c7187}.notification-settings-empty h2{font-size:20px;margin:0;color:var(--pd-ink-950)}.notification-settings-empty p{font-size:11px;color:var(--pd-muted);line-height:1.5;margin:0;max-width:320px}.notification-settings-empty button{min-height:44px;border:1px solid var(--pd-ink-900);border-radius:var(--pd-radius-pill);background:var(--pd-ink-900);color:#fff;padding:0 var(--pd-space-3);font-weight:var(--pd-action-weight);margin-top:var(--pd-space-2)}
      `}</style>
    </div>
  );
}
