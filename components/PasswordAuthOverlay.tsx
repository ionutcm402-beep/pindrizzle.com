"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "recovery" | "new-password";

export default function PasswordAuthOverlay() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [contextMessage, setContextMessage] = useState("");

  const passwordValid = password.length >= 8;
  const emailValid = email.includes("@") && email.includes(".");
  const canSubmit = useMemo(() => {
    if (mode === "recovery") return emailValid;
    if (mode === "new-password") return passwordValid && password === confirmPassword;
    if (mode === "signup") return emailValid && passwordValid && password === confirmPassword;
    return emailValid && passwordValid;
  }, [mode, emailValid, passwordValid, password, confirmPassword]);

  useEffect(() => {
    const patchLegacyCopy = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".settings-list button"));
      const signIn = buttons.find((button) => button.querySelector("strong")?.textContent?.trim() === "Sign in");
      const small = signIn?.querySelector("small");
      if (small) small.textContent = "Email + password";
    };

    const detectLegacySheet = () => {
      patchLegacyCopy();
      const legacy = document.querySelector<HTMLElement>('.composer-backdrop[aria-label="Sign in to Ping"]');
      if (legacy) setOpen(true);
    };

    detectLegacySheet();
    const observer = new MutationObserver(detectLegacySheet);
    observer.observe(document.body, { childList: true, subtree: true });

    const authNeeded = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setContextMessage(detail?.message || "Sign in to continue.");
      setMode("signin");
      setMessage("");
      setOpen(true);
    };
    window.addEventListener("ping:auth-needed", authNeeded as EventListener);

    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("new-password");
        setMessage("Choose a new password for your Ping account.");
        setOpen(true);
        return;
      }
      if (session?.user && event === "SIGNED_IN") {
        setOpen(false);
        setPassword("");
        setConfirmPassword("");
      }
    });

    return () => {
      observer.disconnect();
      window.removeEventListener("ping:auth-needed", authNeeded as EventListener);
      data.subscription.unsubscribe();
    };
  }, []);

  const closeLegacy = () => {
    const legacy = document.querySelector<HTMLElement>('.composer-backdrop[aria-label="Sign in to Ping"]');
    legacy?.querySelector<HTMLButtonElement>(".composer-header button")?.click();
  };

  const close = () => {
    closeLegacy();
    setOpen(false);
    setMessage("");
    setContextMessage("");
    setPassword("");
    setConfirmPassword("");
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMessage("");
    const supabase = createClient();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setMessage("Signed in.");
        closeLegacy();
        setOpen(false);
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          setMessage("Account created. You are signed in.");
          closeLegacy();
          setOpen(false);
        } else {
          setMessage("Account created. Check your email once to confirm the address, then sign in with your password.");
        }
      } else if (mode === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage("Password reset email sent. Open the newest Ping email and choose a new password.");
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Password updated. You can now use normal Sign in.");
        setMode("signin");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Authentication failed.";
      if (/invalid login credentials/i.test(text)) {
        setMessage("Email or password is incorrect. If this account was created with a magic link, use Set / reset password once.");
      } else if (/already registered/i.test(text)) {
        setMessage("This email already has a Ping account. Choose Sign in, or Set / reset password if it was created with a magic link.");
      } else if (/rate limit/i.test(text)) {
        setMessage("Email sending is temporarily rate-limited. Password sign-in will not need email after the account is set up.");
      } else {
        setMessage(text);
      }
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  };

  if (!open) return <style jsx global>{`.composer-backdrop[aria-label="Sign in to Ping"]{display:none!important}`}</style>;

  const heading = mode === "signup" ? "Create your Ping account." : mode === "recovery" ? "Set or reset your password." : mode === "new-password" ? "Choose your new password." : "Welcome back.";

  return (
    <>
      <style jsx global>{`.composer-backdrop[aria-label="Sign in to Ping"]{display:none!important}`}</style>
      <div className="password-auth-backdrop" role="dialog" aria-modal="true" aria-label="Ping account">
        <section className="password-auth-sheet">
          <div className="password-auth-handle" />
          <div className="password-auth-header">
            <button type="button" onClick={close}>Cancel</button>
            <strong>Ping</strong>
            <span />
          </div>

          {(mode === "signin" || mode === "signup") && (
            <div className="password-auth-tabs">
              <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => switchMode("signin")}>Sign in</button>
              <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Sign up</button>
            </div>
          )}

          <h2>{heading}</h2>
          {contextMessage && mode === "signin" && <p className="password-auth-context">{contextMessage}</p>}
          <p className="password-auth-copy">
            {mode === "signup"
              ? "Create an account once, then use your email and password whenever you return."
              : mode === "recovery"
                ? "Use this if your account was originally created with a magic link, or if you forgot your password."
                : mode === "new-password"
                  ? "Use at least 8 characters. After this, normal password sign-in will work."
                  : "Sign in with your email and password. No email link is needed for normal sign-in."}
          </p>

          {mode !== "new-password" && (
            <>
              <label>Email address</label>
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </>
          )}

          {mode !== "recovery" && (
            <>
              <label>Password</label>
              <input type="password" autoComplete={mode === "signup" || mode === "new-password" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
            </>
          )}

          {(mode === "signup" || mode === "new-password") && (
            <>
              <label>Confirm password</label>
              <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" />
            </>
          )}

          {password.length > 0 && password.length < 8 && mode !== "recovery" && <div className="password-auth-hint">Password must be at least 8 characters.</div>}
          {confirmPassword.length > 0 && password !== confirmPassword && <div className="password-auth-hint error">Passwords do not match.</div>}
          {message && <div className="password-auth-message">{message}</div>}

          <button type="button" className="password-auth-primary" disabled={busy || !canSubmit} onClick={submit}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "recovery" ? "Send password reset" : mode === "new-password" ? "Save new password" : "Sign in"}
          </button>

          {mode === "signin" && <button type="button" className="password-auth-link" onClick={() => switchMode("recovery")}>Set / reset password</button>}
          {mode === "recovery" && <button type="button" className="password-auth-link" onClick={() => switchMode("signin")}>Back to Sign in</button>}

          <div className="password-auth-note">Your email is never shown publicly.</div>
        </section>
      </div>

      <style jsx global>{`
        .password-auth-backdrop{position:fixed;inset:0;z-index:500;background:rgba(17,25,18,.55);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:14px}.password-auth-sheet{width:min(100%,430px);background:#fbfbf7;border-radius:30px 30px 22px 22px;padding:10px 20px 24px;color:#172019;box-shadow:0 -24px 70px rgba(17,25,18,.3)}.password-auth-handle{width:44px;height:5px;border-radius:999px;background:#d5ddd3;margin:2px auto 12px}.password-auth-header{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center}.password-auth-header strong{text-align:center}.password-auth-header button{justify-self:start;border:0;background:transparent;color:#68756b;font-weight:800;padding:8px 0}.password-auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#edf2ea;padding:5px;border-radius:15px;margin:18px 0}.password-auth-tabs button{border:0;border-radius:11px;padding:10px;background:transparent;color:#66736a;font-weight:850}.password-auth-tabs button.active{background:#fff;color:#183924;box-shadow:0 3px 12px rgba(22,45,27,.08)}.password-auth-sheet h2{font-size:26px;letter-spacing:-.7px;margin:16px 0 7px}.password-auth-copy,.password-auth-context{font-size:12px;line-height:1.5;color:#68746b}.password-auth-context{background:#eef6eb;color:#315a34;padding:10px 11px;border-radius:13px;font-weight:750}.password-auth-sheet label{display:block;font-size:10px;font-weight:900;color:#657168;margin:14px 0 6px}.password-auth-sheet input{width:100%;height:48px;border:1px solid #dde5da;border-radius:14px;background:#fff;padding:0 13px;outline:none;font:inherit}.password-auth-sheet input:focus{border-color:#61d95a;box-shadow:0 0 0 3px rgba(97,217,90,.12)}.password-auth-hint{margin-top:7px;color:#68746b;font-size:10px}.password-auth-hint.error{color:#9a4038}.password-auth-message{margin-top:12px;border-radius:13px;padding:11px;background:#eef6eb;color:#315a34;font-size:11px;line-height:1.45;font-weight:750}.password-auth-primary{width:100%;border:0;border-radius:15px;padding:14px;margin-top:16px;background:#59d951;color:#123214;font-weight:950;font-size:14px}.password-auth-primary:disabled{opacity:.48}.password-auth-link{display:block;margin:12px auto 0;border:0;background:transparent;color:#3c6641;font-weight:850;text-decoration:underline;text-underline-offset:3px}.password-auth-note{text-align:center;margin-top:16px;color:#899289;font-size:9px}@media(max-width:520px){.password-auth-backdrop{padding:0}.password-auth-sheet{border-radius:28px 28px 0 0;padding-bottom:28px}}
      `}</style>
    </>
  );
}
