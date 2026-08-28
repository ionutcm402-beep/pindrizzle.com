"use client";

import { useEffect, useState } from "react";

type InstallMode = "checking" | "installed" | "prompt" | "ios" | "manual";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function standaloneMode() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return standalone || navigatorStandalone;
}

function iosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function savedInstallPrompt() {
  return (window as Window & { __pindrizzleInstallPrompt?: BeforeInstallPromptEvent | null }).__pindrizzleInstallPrompt || null;
}

export default function PwaInstallPanel() {
  const [mode, setMode] = useState<InstallMode>("checking");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const syncMode = () => {
      if (standaloneMode()) {
        setDeferredPrompt(null);
        setMode("installed");
        return;
      }
      if (iosDevice()) {
        setDeferredPrompt(null);
        setMode("ios");
        return;
      }
      const saved = savedInstallPrompt();
      if (saved) {
        setDeferredPrompt(saved);
        setMode("prompt");
      } else {
        setDeferredPrompt(null);
        setMode("manual");
      }
    };

    const beforeInstall = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      (window as Window & { __pindrizzleInstallPrompt?: BeforeInstallPromptEvent | null }).__pindrizzleInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
      setMode("prompt");
    };

    const installAvailable = () => syncMode();
    const installed = () => {
      (window as Window & { __pindrizzleInstallPrompt?: BeforeInstallPromptEvent | null }).__pindrizzleInstallPrompt = null;
      setDeferredPrompt(null);
      setMode("installed");
      setMessage("Pindrizzle is installed on this device.");
    };

    syncMode();
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("pindrizzle:install-available", installAvailable);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("pindrizzle:installed", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("pindrizzle:install-available", installAvailable);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("pindrizzle:installed", installed);
    };
  }, []);

  const install = async () => {
    const prompt = deferredPrompt || savedInstallPrompt();
    if (!prompt) {
      setMode("manual");
      setMessage("Use your browser’s Install app or Add to Home Screen option.");
      return;
    }
    setMessage("");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      (window as Window & { __pindrizzleInstallPrompt?: BeforeInstallPromptEvent | null }).__pindrizzleInstallPrompt = null;
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") {
        setMode("installed");
        setMessage("Pindrizzle was added to this device.");
      } else {
        setMode("manual");
        setMessage("Installation was cancelled. You can install Pindrizzle later from this page or your browser menu.");
      }
    } catch {
      (window as Window & { __pindrizzleInstallPrompt?: BeforeInstallPromptEvent | null }).__pindrizzleInstallPrompt = null;
      setDeferredPrompt(null);
      setMode("manual");
      setMessage("Your browser did not open the install dialog. Use its Install app or Add to Home Screen option instead.");
    }
  };

  return (
    <div className="phase23-install-page">
      <div className="phase23-install-shell">
        <header className="phase23-install-header">
          <a href="/you" aria-label="Back to You">‹</a>
          <div><span>DROP IN DAILY</span><h1>Install Pindrizzle</h1></div>
        </header>
        <main className="phase23-install-main">
          <section className="phase23-install-hero">
            <div className="phase23-install-icon" aria-hidden="true"><i>pd</i></div>
            <div>
              <h2>Your local area, one tap away.</h2>
              <p>Install Pindrizzle on your phone or computer for direct home-screen access. It remains the same secure web app and updates automatically.</p>
            </div>
          </section>

          {mode === "checking" && <section className="phase23-install-card"><h2>Checking this device…</h2><p>Pindrizzle is checking which install method your browser supports.</p></section>}

          {mode === "installed" && (
            <section className="phase23-install-card success">
              <span className="phase23-install-status">INSTALLED</span>
              <h2>Pindrizzle is already installed.</h2>
              <p>Open it from your home screen, app launcher, dock or Start menu. You can keep using the browser version too.</p>
              <div className="phase23-install-actions"><a className="primary" href="/">Open Feed</a></div>
            </section>
          )}

          {mode === "prompt" && (
            <section className="phase23-install-card success">
              <span className="phase23-install-status">READY</span>
              <h2>This browser can install Pindrizzle directly.</h2>
              <p>The next button opens your browser’s own install confirmation. Pindrizzle does not install anything without that confirmation.</p>
              <div className="phase23-install-actions"><button type="button" className="primary" onClick={install}>Install Pindrizzle</button></div>
            </section>
          )}

          {mode === "ios" && (
            <section className="phase23-install-card">
              <span className="phase23-install-status">IPHONE / IPAD</span>
              <h2>Add Pindrizzle from Safari.</h2>
              <ol>
                <li>Open Pindrizzle in Safari if you are currently using another browser.</li>
                <li>Tap the Share button.</li>
                <li>Choose <b>Add to Home Screen</b>, then confirm Add.</li>
              </ol>
              <p>Once installed, Pindrizzle opens like an app. Web push on iPhone/iPad is available for supported home-screen web apps when you choose to enable it.</p>
            </section>
          )}

          {mode === "manual" && (
            <section className="phase23-install-card">
              <span className="phase23-install-status">BROWSER INSTALL</span>
              <h2>Use your browser’s install option.</h2>
              <p>Look for <b>Install app</b>, <b>Install Pindrizzle</b> or <b>Add to Home Screen</b> in the browser menu. On desktop Chrome or Edge, an install icon may also appear in the address bar after Pindrizzle becomes eligible.</p>
            </section>
          )}

          {message && <div className="phase23-install-message" role="status" aria-live="polite">{message}</div>}

          <section className="phase23-install-card">
            <h2>What installation changes</h2>
            <ul>
              <li>Pindrizzle gets its own home-screen or desktop app icon.</li>
              <li>It opens in a cleaner standalone window where the platform supports it.</li>
              <li>Your account, privacy controls and notification choices stay the same.</li>
              <li>Pindrizzle still requires a live connection for Feed, Map, Search, posting and Activity.</li>
            </ul>
          </section>

          <section className="phase23-install-card offline-note">
            <h2>Offline is deliberately limited.</h2>
            <p>If the network disappears, Pindrizzle shows a clear offline screen instead of serving cached nearby activity that could be old or misleading. Live local information resumes when you reconnect.</p>
          </section>

          <div className="phase23-install-footer"><a href="/">Feed</a><span>·</span><a href="/privacy">Privacy</a><span>·</span><a href="/you">You</a></div>
        </main>
      </div>
      <style jsx global>{`
        .phase23-install-page{min-height:100dvh;background:#eaf5f9;display:flex;justify-content:center;padding:24px}.phase23-install-shell{width:min(100%,680px);min-height:calc(100dvh - 48px);background:#f8fcfe;border:1px solid rgba(31,91,124,.10);border-radius:32px;box-shadow:0 24px 70px rgba(26,78,107,.14);overflow:hidden}.phase23-install-header{display:flex;gap:14px;align-items:flex-start;padding:24px 24px 18px}.phase23-install-header>a{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#123c57;text-decoration:none;font-size:28px;box-shadow:0 8px 24px rgba(31,91,124,.10)}.phase23-install-header span{display:block;color:#0a668d;font-size:10px;font-weight:950;letter-spacing:.7px}.phase23-install-header h1{margin:9px 0 0;font-size:31px;letter-spacing:-1px}.phase23-install-main{padding:0 20px 30px}.phase23-install-hero{display:grid;grid-template-columns:92px 1fr;gap:16px;align-items:center;background:linear-gradient(135deg,#0b3048,#165f7d 65%,#228fb3);color:#fff;border-radius:24px;padding:18px;margin-bottom:13px}.phase23-install-icon{width:82px;height:82px;border-radius:24px;background:linear-gradient(145deg,#70cde5,#2c92c5);display:grid;place-items:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.55)}.phase23-install-icon i{width:56px;height:56px;border-radius:17px;background:rgba(7,45,66,.88);display:grid;place-items:center;color:#fff;font-style:normal;font-size:24px;font-weight:950;text-transform:uppercase}.phase23-install-hero h2{margin:0 0 6px;font-size:22px;line-height:1.08}.phase23-install-hero p{margin:0;color:#d9edf4;font-size:11px;line-height:1.55}.phase23-install-card{background:#fff;border:1px solid rgba(31,91,124,.12);border-radius:20px;padding:17px;margin-bottom:11px}.phase23-install-card.success{background:#eaf7fb;border-color:#cfeaf4}.phase23-install-status{display:inline-flex;padding:5px 7px;border-radius:999px;background:#e9f3f7;color:#526d7c;font-size:8px;font-weight:950;letter-spacing:.5px}.phase23-install-card.success .phase23-install-status{background:#d9f1f8;color:#0d6182}.phase23-install-card h2{margin:8px 0 7px;font-size:17px;color:#17364a}.phase23-install-card p,.phase23-install-card li{color:#5d7481;font-size:12px;line-height:1.6}.phase23-install-card p{margin:6px 0}.phase23-install-card ul,.phase23-install-card ol{margin:8px 0 0;padding-left:20px}.phase23-install-actions{display:flex;gap:8px;margin-top:13px}.phase23-install-actions button,.phase23-install-actions a{min-height:46px;border:0;border-radius:14px;padding:0 17px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:12px;font-weight:950}.phase23-install-actions .primary{background:#0d5575;color:#fff}.phase23-install-message{margin:0 0 11px;padding:11px 12px;border-radius:14px;background:#e9f6fb;color:#245b74;font-size:11px;font-weight:800;line-height:1.45}.phase23-install-card.offline-note{background:#fff8eb;border-color:#eeddb5}.phase23-install-footer{display:flex;justify-content:center;gap:10px;color:#8296a1;font-size:10px;padding-top:8px}.phase23-install-footer a{color:#356a82}@media(max-width:720px){.phase23-install-page{padding:0}.phase23-install-shell{width:100%;min-height:100dvh;border-radius:0;border:0}.phase23-install-header{padding-left:17px;padding-right:17px}.phase23-install-main{padding-left:15px;padding-right:15px}}@media(max-width:420px){.phase23-install-hero{grid-template-columns:70px 1fr}.phase23-install-icon{width:64px;height:64px;border-radius:19px}.phase23-install-icon i{width:44px;height:44px;border-radius:13px;font-size:20px}.phase23-install-hero h2{font-size:19px}}
      `}</style>
    </div>
  );
}
