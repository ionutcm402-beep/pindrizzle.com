"use client";

import { useCallback, useEffect, useState } from "react";
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
    window.dispatchEvent(new CustomEvent("ping:auth-needed", { detail: { message: "Sign in to manage your Ping notifications." } }));
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

  const rows: Array<{ key: keyof Preferences; icon: string; title: string; body: string }> = [
    { key: "replies_enabled", icon: "💬", title: "Replies", body: "When someone replies to your Ping or a Ping you joined." },
    { key: "confirmations_enabled", icon: "✓", title: "Confirmations", body: "When another neighbour confirms one of your Pings." },
    { key: "helpful_enabled", icon: "★", title: "Helpful", body: "When someone marks one of your Pings Helpful." },
  ];

  return (
    <div className="page-shell">
      <div className="app-shell">
        <main className="notification-settings-screen">
          <header className="notification-settings-header">
            <a href="/you" className="notification-settings-back" aria-label="Back to You">‹</a>
            <div>
              <div className="brand small">ping<span>.</span></div>
              <h1>Notifications</h1>
            </div>
          </header>

          {!userId && !loading ? (
            <section className="notification-settings-empty">
              <div>🔔</div>
              <h2>Choose what deserves your attention.</h2>
              <p>Sign in to control which community events appear in Alerts.</p>
              <button type="button" onClick={openAuth}>Sign in / Sign up</button>
            </section>
          ) : (
            <>
              <section className="notification-settings-intro">
                <strong>Useful activity only.</strong>
                <p>These controls affect Ping’s in-app Alerts and live badges. Security emails such as password resets are always kept separate.</p>
              </section>

              <section className="notification-settings-list" aria-label="Notification preferences">
                {rows.map((row) => {
                  const enabled = preferences[row.key];
                  return (
                    <button key={row.key} type="button" className="notification-setting-row" onClick={() => toggle(row.key)} disabled={loading || saving !== null}>
                      <span className="notification-setting-icon">{row.icon}</span>
                      <span className="notification-setting-copy"><strong>{row.title}</strong><small>{row.body}</small></span>
                      <span className={`notification-switch ${enabled ? "on" : "off"}`} role="switch" aria-checked={enabled} aria-label={`${row.title} ${enabled ? "on" : "off"}`}><i /></span>
                    </button>
                  );
                })}
              </section>

              <section className="notification-settings-note">
                <strong>What Ping will not do</strong>
                <p>No “we miss you” spam, follower alerts or engagement bait. Phase 6 notifications are tied to real community actions.</p>
              </section>

              {email && <div className="notification-settings-account">Settings for <strong>{email}</strong></div>}
              {message && <div className="notification-settings-message">{message}</div>}
            </>
          )}
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          <a href="/"><span>⌂</span>Feed</a>
          <a href="/map"><span>⌖</span>Map</a>
          <a href="/#ping" className="compose-nav"><span>+</span>Ping</a>
          <a href="/alerts"><span>♢</span>Alerts</a>
          <a href="/you" className="active"><span>○</span>You</a>
        </nav>
      </div>

      <style jsx global>{`
        .notification-settings-screen{min-height:100%;padding:0 18px 110px}.notification-settings-header{display:flex;gap:14px;align-items:flex-start;padding:24px 4px 18px}.notification-settings-header h1{font-size:30px;letter-spacing:-1px;margin:16px 0 0}.notification-settings-back{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;text-decoration:none;color:#233329;background:#fff;box-shadow:0 8px 24px rgba(31,41,32,.08);font-size:29px;line-height:1}.notification-settings-intro{padding:18px;border-radius:20px;background:#eef5eb;margin:4px 0 13px}.notification-settings-intro strong{font-size:13px}.notification-settings-intro p{margin:6px 0 0;color:#647168;font-size:11px;line-height:1.5}.notification-settings-list{display:grid;gap:9px}.notification-setting-row{width:100%;border:1px solid #e2e8df;background:#fff;border-radius:19px;padding:13px;display:grid;grid-template-columns:44px 1fr auto;gap:11px;align-items:center;text-align:left;color:#172019}.notification-setting-row:disabled{opacity:.72}.notification-setting-icon{width:44px;height:44px;border-radius:14px;background:#eff5ed;display:grid;place-items:center;font-size:18px}.notification-setting-copy strong{display:block;font-size:12px}.notification-setting-copy small{display:block;margin-top:4px;color:#748077;font-size:9px;line-height:1.4}.notification-switch{width:45px;height:26px;border-radius:999px;padding:3px;display:flex;align-items:center;transition:.18s ease}.notification-switch.off{background:#dfe5dc;justify-content:flex-start}.notification-switch.on{background:#59d951;justify-content:flex-end}.notification-switch i{display:block;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(22,35,24,.16)}.notification-settings-note{margin-top:14px;padding:16px;border-radius:18px;border:1px solid #e5eae2;background:#fbfbf7}.notification-settings-note strong{font-size:11px}.notification-settings-note p{margin:5px 0 0;color:#6b766d;font-size:10px;line-height:1.5}.notification-settings-account,.notification-settings-message{text-align:center;margin-top:12px;color:#7c867d;font-size:9px}.notification-settings-message{color:#3d683f;font-weight:800}.notification-settings-empty{margin-top:18px;padding:30px 21px;border:1px solid #e4e9e1;background:#fff;border-radius:24px;text-align:center}.notification-settings-empty>div{font-size:28px}.notification-settings-empty h2{font-size:20px;margin:10px 0 7px}.notification-settings-empty p{font-size:11px;color:#6a756c;line-height:1.5}.notification-settings-empty button{border:0;border-radius:14px;background:#59d951;color:#153718;padding:13px 18px;font-weight:950;margin-top:10px}.bottom-nav a{height:100%;border:0;background:transparent;color:#8a928b;font-size:10px;font-weight:800;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;position:relative;text-decoration:none}.bottom-nav a>span{font-size:22px;line-height:1}.bottom-nav a.active{color:#1f5420}.bottom-nav a.compose-nav{color:#1f5420}
      `}</style>
    </div>
  );
}
