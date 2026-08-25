"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthRecovery() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error_code");
    const description = params.get("error_description");
    if (code === "otp_expired" || params.get("error") === "access_denied") {
      setErrorMessage(description?.replace(/\+/g, " ") || "This sign-in link has expired or was already used.");
    }
  }, []);

  if (!errorMessage) return null;

  const resend = async () => {
    if (!email.includes("@")) return;
    setBusy(true);
    setStatus("");
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setStatus("Fresh link sent. Use only the newest Ping email.");
    } catch {
      setStatus("We could not send a fresh link yet. Please try again shortly.");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    const clean = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, "", clean);
    setErrorMessage(null);
  };

  return (
    <div className="auth-recovery-backdrop" role="dialog" aria-modal="true" aria-label="Sign-in link expired">
      <div className="auth-recovery-card">
        <div className="auth-recovery-icon">✉️</div>
        <h2>That sign-in link didn’t work.</h2>
        <p>{errorMessage}</p>
        <p className="auth-recovery-note">Magic links are one-time use. Request a fresh one and open only the newest Ping email.</p>
        <label>Email address</label>
        <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        {status && <div className="auth-recovery-status">{status}</div>}
        <button className="auth-recovery-primary" disabled={busy || !email.includes("@")} onClick={resend}>
          {busy ? "Sending…" : "Send a fresh sign-in link"}
        </button>
        <button className="auth-recovery-secondary" onClick={close}>Back to Ping</button>
      </div>
      <style jsx global>{`
        .auth-recovery-backdrop{position:fixed;inset:0;z-index:300;background:rgba(18,25,19,.5);backdrop-filter:blur(7px);display:grid;place-items:center;padding:18px}.auth-recovery-card{width:min(100%,410px);background:#fbfbf7;border-radius:27px;padding:25px;box-shadow:0 24px 70px rgba(17,25,18,.28);color:#172019}.auth-recovery-icon{font-size:31px}.auth-recovery-card h2{font-size:25px;letter-spacing:-.65px;margin:13px 0 8px}.auth-recovery-card p{font-size:13px;line-height:1.5;color:#606a62;margin:0 0 10px}.auth-recovery-note{background:#f1f4ef;border-radius:14px;padding:11px!important}.auth-recovery-card label{display:block;font-size:11px;font-weight:850;color:#68726a;margin:16px 0 7px}.auth-recovery-card input{width:100%;height:48px;border:1px solid #dfe5dd;border-radius:15px;background:#fff;padding:0 13px;outline:none}.auth-recovery-card input:focus{border-color:#62d95b;box-shadow:0 0 0 3px rgba(98,217,91,.12)}.auth-recovery-status{margin:10px 0 0;padding:10px;border-radius:12px;background:#eef6eb;color:#315a34;font-size:11px;font-weight:750}.auth-recovery-primary,.auth-recovery-secondary{width:100%;border:0;border-radius:15px;padding:14px;font-weight:900;margin-top:12px}.auth-recovery-primary{background:#59d951;color:#123214}.auth-recovery-primary:disabled{opacity:.55}.auth-recovery-secondary{background:#edf1eb;color:#526057;margin-top:8px}@media(max-width:520px){.auth-recovery-backdrop{align-items:end;padding:0}.auth-recovery-card{border-radius:28px 28px 0 0}}
      `}</style>
    </div>
  );
}
