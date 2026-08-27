"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "recovery";
type ReleaseStage = "closed_beta" | "public";

export default function PasswordAuthOverlay() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [releaseStage, setReleaseStage] = useState<ReleaseStage>("closed_beta");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [contextMessage, setContextMessage] = useState("");
  const sheetRef = useRef<HTMLElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(false);

  const isClosedBeta = releaseStage !== "public";
  const passwordValid = password.length >= 8;
  const emailValid = email.includes("@") && email.includes(".");
  const normalizedInvite = inviteCode.trim().toUpperCase();
  const inviteValid = /^PING-[A-Z0-9]{10,32}$/.test(normalizedInvite);
  const canSubmit = useMemo(() => {
    if (mode === "recovery") return emailValid;
    if (mode === "signup") return emailValid && passwordValid && password === confirmPassword && (!isClosedBeta || inviteValid) && ageConfirmed && termsConfirmed;
    return emailValid && passwordValid;
  }, [mode, emailValid, passwordValid, password, confirmPassword, isClosedBeta, inviteValid, ageConfirmed, termsConfirmed]);

  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
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
        if (window.location.pathname === "/reset-password") return;
        const fragment = window.location.hash || "";
        window.location.replace(`/reset-password${fragment}`);
        return;
      }
      if (session?.user && event === "SIGNED_IN") {
        setOpen(false);
        setPassword("");
        setConfirmPassword("");
        setAgeConfirmed(false);
        setTermsConfirmed(false);
        setContextMessage("");
      }
    });

    return () => {
      window.removeEventListener("ping:auth-needed", authNeeded as EventListener);
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const supabase = createClient();
    void supabase.rpc("public_release_stage").then((result) => {
      if (!active) return;
      const value = Array.isArray(result.data) ? result.data[0] : result.data;
      setReleaseStage(!result.error && value === "public" ? "public" : "closed_beta");
    });
    return () => { active = false; };
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setMessage("");
    setContextMessage("");
    setPassword("");
    setConfirmPassword("");
    setInviteCode("");
    setAgeConfirmed(false);
    setTermsConfirmed(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => emailRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])') || []).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, close]);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        setOpen(false);
      } else if (mode === "signup") {
        if (isClosedBeta) {
          try { localStorage.setItem("ping-beta-pending-invite", normalizedInvite); } catch {}
        } else {
          try { localStorage.removeItem("ping-beta-pending-invite"); } catch {}
        }

        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              age_13_plus_declared: true,
              ping_terms_version: "2026-08-26",
              ping_privacy_notice_version: "2026-08-26",
              ping_closed_beta_signup: isClosedBeta,
              ping_release_stage: releaseStage,
            },
          },
        });
        if (error) throw error;

        if (data.session) {
          if (isClosedBeta) {
            const redeem = await supabase.rpc("redeem_beta_invite", { invite_code: normalizedInvite });
            if (redeem.error) {
              setMessage("Your account was created, but that beta invite could not be activated. Open Closed beta from You to try another invite.");
            } else {
              try { localStorage.removeItem("ping-beta-pending-invite"); } catch {}
              window.dispatchEvent(new Event("ping:beta-refresh"));
              setOpen(false);
            }
          } else {
            setOpen(false);
          }
        } else {
          const identities = data.user?.identities;
          if (Array.isArray(identities) && identities.length === 0) {
            try { localStorage.removeItem("ping-beta-pending-invite"); } catch {}
            setMessage("This email already has a Pindrizzle account. Choose Sign in and use your password.");
          } else if (isClosedBeta) {
            setMessage("Check your email to confirm your new Pindrizzle account. Your beta invite will activate when you return and sign in on this browser.");
          } else {
            setMessage("Check your email to confirm your new Pindrizzle account, then return here to sign in.");
          }
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage("Password reset email sent. Open the newest email to choose a new password.");
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Authentication failed.";
      if (/invalid login credentials/i.test(text)) setMessage("Email or password is incorrect. Use Forgot password? if you need to reset it.");
      else if (/already registered|already exists/i.test(text)) setMessage("This email already has a Pindrizzle account. Choose Sign in instead.");
      else if (/rate limit|too many requests|429/i.test(text)) setMessage("Email delivery is temporarily rate-limited. Normal password sign-in still works without sending an email.");
      else setMessage(text);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
    setInviteCode("");
    setAgeConfirmed(false);
    setTermsConfirmed(false);
    window.setTimeout(() => emailRef.current?.focus(), 0);
  };

  if (!open) return null;
  const heading = mode === "signup" ? (isClosedBeta ? "Join the Pindrizzle closed beta." : "Create your Pindrizzle account.") : mode === "recovery" ? "Reset your password." : "Welcome back.";
  const signupCopy = isClosedBeta
    ? "New accounts currently need a beta invite. Pindrizzle accounts are for people aged 13 or over, and your email is never shown publicly."
    : "Create an account to post, confirm, reply and follow useful local updates. Pindrizzle accounts are for people aged 13 or over, and your email is never shown publicly.";

  return (
    <>
      <div className="password-auth-backdrop" role="dialog" aria-modal="true" aria-labelledby="password-auth-title">
        <section className="password-auth-sheet" ref={sheetRef}>
          <div className="password-auth-handle" aria-hidden="true" />
          <div className="password-auth-header"><button type="button" onClick={close} disabled={busy}>Cancel</button><strong>Pindrizzle</strong><span /></div>
          {(mode === "signin" || mode === "signup") && <div className="password-auth-tabs" aria-label="Account mode"><button type="button" aria-pressed={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => switchMode("signin")}>Sign in</button><button type="button" aria-pressed={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Sign up</button></div>}

          <h2 id="password-auth-title">{heading}</h2>
          {contextMessage && mode === "signin" && <p className="password-auth-context">{contextMessage}</p>}
          <p className="password-auth-copy">{mode === "signup" ? signupCopy : mode === "recovery" ? "Enter your email and we’ll send a secure password reset link." : "Sign in with your email and password."}</p>

          <label htmlFor="password-auth-email">Email address</label>
          <input ref={emailRef} id="password-auth-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />

          {mode !== "recovery" && <><label htmlFor="password-auth-password">Password</label><input id="password-auth-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" aria-invalid={password.length > 0 && !passwordValid} aria-describedby={password.length > 0 && !passwordValid ? "password-auth-password-hint" : undefined} /></>}

          {mode === "signup" && <>
            <label htmlFor="password-auth-confirm">Confirm password</label>
            <input id="password-auth-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" aria-invalid={confirmPassword.length > 0 && password !== confirmPassword} aria-describedby={confirmPassword.length > 0 && password !== confirmPassword ? "password-auth-confirm-hint" : undefined} />
            {isClosedBeta && <>
              <label htmlFor="password-auth-invite">Beta invite code</label>
              <input id="password-auth-invite" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="PING-…" autoCapitalize="characters" autoCorrect="off" aria-invalid={inviteCode.length > 0 && !inviteValid} aria-describedby={inviteCode.length > 0 && !inviteValid ? "password-auth-invite-hint" : undefined} />
              {inviteCode.length > 0 && !inviteValid && <div id="password-auth-invite-hint" className="password-auth-hint error">Enter the full beta invite code.</div>}
            </>}
            <div className="password-auth-declarations"><label className="password-auth-check" htmlFor="password-auth-age"><input id="password-auth-age" type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} /><span>I confirm I am 13 or older.</span></label><label className="password-auth-check" htmlFor="password-auth-terms"><input id="password-auth-terms" type="checkbox" checked={termsConfirmed} onChange={(event) => setTermsConfirmed(event.target.checked)} /><span>I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms</a> and have read the <a href="/privacy" target="_blank" rel="noreferrer">Privacy Notice</a>.</span></label></div>
          </>}

          {password.length > 0 && password.length < 8 && mode !== "recovery" && <div id="password-auth-password-hint" className="password-auth-hint">Password must be at least 8 characters.</div>}
          {confirmPassword.length > 0 && password !== confirmPassword && <div id="password-auth-confirm-hint" className="password-auth-hint error">Passwords do not match.</div>}
          {message && <div className="password-auth-message" role="status" aria-live="polite">{message}</div>}
          <button type="button" className="password-auth-primary" disabled={busy || !canSubmit} onClick={submit} aria-busy={busy}>{busy ? "Please wait…" : mode === "signup" ? (isClosedBeta ? "Create beta account" : "Create account") : mode === "recovery" ? "Send password reset" : "Sign in"}</button>
          {mode === "signin" && <button type="button" className="password-auth-link" onClick={() => switchMode("recovery")}>Forgot password?</button>}
          {mode === "recovery" && <button type="button" className="password-auth-link" onClick={() => switchMode("signin")}>Back to Sign in</button>}
          <div className="password-auth-note">{isClosedBeta ? "Closed beta · public browsing remains open." : "Public access · local participation is open."}</div>
        </section>
      </div>
      <style jsx global>{`
        .password-auth-backdrop{position:fixed;inset:0;z-index:500;background:rgba(17,25,18,.55);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:14px}.password-auth-sheet{width:min(100%,430px);max-height:calc(100dvh - 28px);overflow:auto;background:#fbfbf7;border-radius:30px 30px 22px 22px;padding:10px 20px 24px;color:#172019;box-shadow:0 -24px 70px rgba(17,25,18,.3)}.password-auth-handle{width:44px;height:5px;border-radius:999px;background:#d5ddd3;margin:2px auto 12px}.password-auth-header{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center}.password-auth-header strong{text-align:center}.password-auth-header button{justify-self:start;border:0;background:transparent;color:#68756b;font-weight:800;padding:8px 0}.password-auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#edf2ea;padding:5px;border-radius:15px;margin:18px 0}.password-auth-tabs button{border:0;border-radius:11px;padding:10px;background:transparent;color:#66736a;font-weight:850}.password-auth-tabs button.active{background:#fff;color:#183924;box-shadow:0 3px 12px rgba(22,45,27,.08)}.password-auth-sheet h2{font-size:26px;letter-spacing:-.7px;margin:16px 0 7px}.password-auth-copy,.password-auth-context{font-size:12px;line-height:1.5;color:#68746b}.password-auth-context{background:#eef6eb;color:#315a34;padding:10px 11px;border-radius:13px;font-weight:750}.password-auth-sheet label{display:block;font-size:10px;font-weight:900;color:#657168;margin:14px 0 6px}.password-auth-sheet input{width:100%;height:48px;border:1px solid #dde5da;border-radius:14px;background:#fff;padding:0 13px;outline:none;font:inherit}.password-auth-sheet input:focus{border-color:#61d95a;box-shadow:0 0 0 3px rgba(97,217,90,.12)}.password-auth-declarations{display:grid;gap:8px;margin-top:14px}.password-auth-sheet label.password-auth-check{display:grid;grid-template-columns:24px 1fr;gap:9px;align-items:start;margin:0;padding:10px 11px;border:1px solid #e0e6dd;border-radius:13px;background:#f7f9f5;color:#59655d;font-size:11px;font-weight:750;line-height:1.45}.password-auth-sheet .password-auth-check input{width:20px;height:20px;min-height:20px;margin:1px 0 0;padding:0;border-radius:5px;accent-color:#3fac43}.password-auth-check a{color:#315f36;text-underline-offset:2px}.password-auth-hint{margin-top:7px;color:#68746b;font-size:10px}.password-auth-hint.error{color:#9a4038}.password-auth-message{margin-top:12px;border-radius:13px;padding:11px;background:#eef6eb;color:#315a34;font-size:11px;line-height:1.45;font-weight:750}.password-auth-primary{width:100%;border:0;border-radius:15px;padding:14px;margin-top:16px;background:#59d951;color:#123214;font-weight:950;font-size:14px}.password-auth-primary:disabled{opacity:.48}.password-auth-link{display:block;margin:12px auto 0;border:0;background:transparent;color:#3c6641;font-weight:850;text-decoration:underline;text-underline-offset:3px}.password-auth-note{text-align:center;margin-top:16px;color:#657067;font-size:10px}@media(max-width:520px){.password-auth-backdrop{padding:0}.password-auth-sheet{border-radius:28px 28px 0 0;padding-bottom:max(28px,calc(18px + env(safe-area-inset-bottom)));max-height:100dvh}}
      `}</style>
    </>
  );
}
