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

export default function PwaInstallPanel() {
  const [mode, setMode] = useState<InstallMode>("checking");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (standaloneMode()) {
      setMode("installed");
    } else if (iosDevice()) {
      setMode("ios");
    } else {
      setMode("manual");
    }

    const beforeInstall = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setDeferredPrompt(promptEvent);
      setMode("prompt");
    };

    const installed = () => {
      setDeferredPrompt(null);
      setMode("installed");
      setMessage("Ping is installed on this device.");
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    setMessage("");
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") {
        setMode("installed");
        setMessage("Ping was added to this device.");
      } else {
        setMode("manual");
        setMessage("Installation was cancelled. You can install Ping later from this page or your browser menu.");
      }
    } catch {
      setMode("manual");
      setMessage("Your browser did not open the install dialog. Use its Install app or Add to Home Screen option instead.");
    }
  };

  return (
    <div className="phase23-install-page">
      <div className="phase23-install-shell">
        <header className="phase23-install-header">
          <a href="/you" aria-label="Back to You">‹</a>
          <div><span>KEEP PING CLOSE</span><h1>Install Ping</h1></div>
        </header>
        <main className="phase23-install-main">
          <section className="phase23-install-hero">
            <div className="phase23-install-icon" aria-hidden="true"><i>p.</i></div>
            <div>
              <h2>Local updates, one tap away.</h2>
              <p>Install Ping on your phone or computer for a standalone app window and direct home-screen access. It is still the same secure web app and updates automatically.</p>
            </div>
          </section>

          {mode === "checking" && <section className="phase23-install-card"><h2>Checking this device…</h2><p>Ping is checking which install method your browser supports.</p></section>}

          {mode === "installed" && (
            <section className="phase23-install-card success">
              <span className="phase23-install-status">INSTALLED</span>
              <h2>Ping is already installed.</h2>
              <p>Open it from your home screen, app launcher, dock or Start menu. You can keep using the browser version too.</p>
              <div className="phase23-install-actions"><a className="primary" href="/">Open Feed</a></div>
            </section>
          )}

          {mode === "prompt" && (
            <section className="phase23-install-card success">
              <span className="phase23-install-status">READY</span>
              <h2>This browser can install Ping directly.</h2>
              <p>The next button opens your browser’s own install confirmation. Ping does not install anything without that confirmation.</p>
              <div className="phase23-install-actions"><button type="button" className="primary" onClick={install}>Install Ping</button></div>
            </section>
          )}

          {mode === "ios" && (
            <section className="phase23-install-card">
              <span className="phase23-install-status">IPHONE / IPAD</span>
              <h2>Add Ping from Safari.</h2>
              <ol>
                <li>Open Ping in Safari if you are currently using another browser.</li>
                <li>Tap the Share button.</li>
                <li>Choose <b>Add to Home Screen</b>, then confirm Add.</li>
              </ol>
              <p>Once installed, Ping opens like an app. Web push on iPhone/iPad is available for supported home-screen web apps when you choose to enable it.</p>
            </section>
          )}

          {mode === "manual" && (
            <section className="phase23-install-card">
              <span className="phase23-install-status">BROWSER INSTALL</span>
              <h2>Use your browser’s install option.</h2>
              <p>Look for <b>Install app</b>, <b>Install Ping</b> or <b>Add to Home Screen</b> in the browser menu. On desktop Chrome or Edge, an install icon may also appear in the address bar after Ping becomes eligible.</p>
            </section>
          )}

          {message && <div className="phase23-install-message" role="status" aria-live="polite">{message}</div>}

          <section className="phase23-install-card">
            <h2>What installation changes</h2>
            <ul>
              <li>Ping gets its own home-screen or desktop app icon.</li>
              <li>It opens in a cleaner standalone window where the platform supports it.</li>
              <li>Your account, privacy controls and notification choices stay the same.</li>
              <li>Ping still requires a live connection for Feed, Map, Search, posting and Alerts.</li>
            </ul>
          </section>

          <section className="phase23-install-card offline-note">
            <h2>Offline is deliberately limited.</h2>
            <p>If the network disappears, Ping shows a clear offline screen instead of serving cached nearby activity that could be old or misleading. Live local information resumes when you reconnect.</p>
          </section>

          <div className="phase23-install-footer"><a href="/">Feed</a><span>·</span><a href="/privacy">Privacy</a><span>·</span><a href="/you">You</a></div>
        </main>
      </div>
      <style jsx global>{`
        .phase23-install-page{min-height:100dvh;background:#eceee8;display:flex;justify-content:center;padding:24px}.phase23-install-shell{width:min(100%,680px);min-height:calc(100dvh - 48px);background:#f8f8f3;border:1px solid rgba(21,24,21,.08);border-radius:32px;box-shadow:0 24px 70px rgba(26,35,27,.12);overflow:hidden}.phase23-install-header{display:flex;gap:14px;align-items:flex-start;padding:24px 24px 18px}.phase23-install-header>a{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#223129;text-decoration:none;font-size:28px;box-shadow:0 8px 24px rgba(31,41,32,.08)}.phase23-install-header span{display:block;color:#2f6934;font-size:10px;font-weight:950;letter-spacing:.6px}.phase23-install-header h1{margin:9px 0 0;font-size:31px;letter-spacing:-1px}.phase23-install-main{padding:0 20px 30px}.phase23-install-hero{display:grid;grid-template-columns:92px 1fr;gap:16px;align-items:center;background:linear-gradient(135deg,#17251a,#283a2b);color:#fff;border-radius:24px;padding:18px;margin-bottom:13px}.phase23-install-icon{width:82px;height:82px;border-radius:24px;background:#59d951;display:grid;place-items:center}.phase23-install-icon i{width:56px;height:56px;border-radius:17px;background:#17351b;display:grid;place-items:center;color:#fff;font-style:normal;font-size:31px;font-weight:950}.phase23-install-hero h2{margin:0 0 6px;font-size:22px;line-height:1.08}.phase23-install-hero p{margin:0;color:#d3ddd4;font-size:11px;line-height:1.55}.phase23-install-card{background:#fff;border:1px solid #e4e9e1;border-radius:20px;padding:17px;margin-bottom:11px}.phase23-install-card.success{background:#eef7ea;border-color:#d2e9cd}.phase23-install-status{display:inline-flex;padding:5px 7px;border-radius:999px;background:#e9efe6;color:#526057;font-size:8px;font-weight:950;letter-spacing:.5px}.phase23-install-card.success .phase23-install-status{background:#d9f2d4;color:#306734}.phase23-install-card h2{margin:8px 0 7px;font-size:17px;color:#202b22}.phase23-install-card p,.phase23-install-card li{color:#5d695f;font-size:12px;line-height:1.6}.phase23-install-card p{margin:6px 0}.phase23-install-card ul,.phase23-install-card ol{margin:8px 0 0;padding-left:20px}.phase23-install-actions{display:flex;gap:8px;margin-top:13px}.phase23-install-actions button,.phase23-install-actions a{min-height:46px;border:0;border-radius:14px;padding:0 17px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:12px;font-weight:950}.phase23-install-actions .primary{background:#59d951;color:#123214}.phase23-install-message{margin:0 0 11px;padding:11px 12px;border-radius:14px;background:#eef7ea;color:#315b35;font-size:11px;font-weight:800;line-height:1.45}.phase23-install-card.offline-note{background:#fff7e8;border-color:#eeddb5}.phase23-install-footer{display:flex;justify-content:center;gap:10px;color:#879087;font-size:10px;padding-top:8px}.phase23-install-footer a{color:#48684c}@media(max-width:720px){.phase23-install-page{padding:0}.phase23-install-shell{width:100%;min-height:100dvh;border-radius:0;border:0}.phase23-install-header{padding-left:17px;padding-right:17px}.phase23-install-main{padding-left:15px;padding-right:15px}}@media(max-width:420px){.phase23-install-hero{grid-template-columns:70px 1fr}.phase23-install-icon{width:64px;height:64px;border-radius:19px}.phase23-install-icon i{width:44px;height:44px;border-radius:13px;font-size:25px}.phase23-install-hero h2{font-size:19px}}
      `}</style>
    </div>
  );
}
