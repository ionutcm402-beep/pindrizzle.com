"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const valid = useMemo(() => password.length >= 8 && password === confirmPassword, [password, confirmPassword]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const resolveSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session?.user) {
        setReady(true);
        setChecking(false);
        return;
      }

      const timer = window.setTimeout(async () => {
        const { data: retry } = await supabase.auth.getSession();
        if (!active) return;
        setReady(Boolean(retry.session?.user));
        setChecking(false);
      }, 1200);

      return () => window.clearTimeout(timer);
    };

    void resolveSession();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setReady(true);
        setChecking(false);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const savePassword = async () => {
    if (!valid) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setMessage("Password updated. You are signed in.");
      window.setTimeout(() => window.location.replace("/you"), 800);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reset-shell">
      <section className="reset-card">
        <div className="brand">ping<span>.</span></div>
        <h1>Choose a new password.</h1>
        <p className="intro">Use at least 8 characters. After this, normal sign in will use your email and password — no email link needed.</p>

        {checking ? (
          <div className="status">Checking your secure reset link…</div>
        ) : ready ? (
          <>
            <label>New password</label>
            <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />

            <label>Confirm new password</label>
            <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" />

            {password.length > 0 && password.length < 8 && <div className="hint">Password must be at least 8 characters.</div>}
            {confirmPassword.length > 0 && password !== confirmPassword && <div className="hint error">Passwords do not match.</div>}
            {message && <div className="status">{message}</div>}

            <button type="button" className="primary" disabled={!valid || busy} onClick={savePassword}>{busy ? "Saving…" : "Save new password"}</button>
          </>
        ) : (
          <>
            <div className="status error-box">This reset link is invalid, expired, or has already been used.</div>
            <a className="secondary" href="/you">Back to Sign in</a>
          </>
        )}
      </section>

      <style jsx global>{`
        .reset-shell{min-height:100vh;display:grid;place-items:center;background:#f5f6f0;padding:20px;color:#172019}.reset-card{width:min(100%,430px);background:#fbfbf7;border:1px solid #e3e8df;border-radius:28px;padding:26px;box-shadow:0 24px 70px rgba(20,35,23,.12)}.reset-card .brand{font-size:33px;font-weight:950;letter-spacing:-1.5px}.reset-card .brand span{color:#59d951}.reset-card h1{font-size:30px;line-height:1.08;letter-spacing:-1px;margin:26px 0 9px}.reset-card .intro{font-size:13px;line-height:1.55;color:#68746b;margin:0 0 18px}.reset-card label{display:block;font-size:10px;font-weight:900;color:#657168;margin:15px 0 6px}.reset-card input{width:100%;height:50px;border:1px solid #dde5da;border-radius:14px;background:#fff;padding:0 13px;font:inherit;outline:none}.reset-card input:focus{border-color:#61d95a;box-shadow:0 0 0 3px rgba(97,217,90,.12)}.reset-card .hint{font-size:10px;color:#68746b;margin-top:7px}.reset-card .hint.error{color:#9a4038}.reset-card .status{margin:14px 0;border-radius:14px;padding:12px;background:#eef6eb;color:#315a34;font-size:12px;font-weight:750;line-height:1.45}.reset-card .error-box{background:#f7ece9;color:#8b443c}.reset-card .primary{width:100%;border:0;border-radius:15px;padding:14px;margin-top:18px;background:#59d951;color:#123214;font-weight:950;font-size:14px}.reset-card .primary:disabled{opacity:.45}.reset-card .secondary{display:block;text-align:center;text-decoration:none;border-radius:15px;padding:14px;background:#edf1eb;color:#526057;font-weight:900}
      `}</style>
    </div>
  );
}
