export const metadata = { title: "Offline — Pindrizzle" };

const reconnectScript = `
(() => {
  const returnOnline = () => window.location.replace("/");
  if (navigator.onLine) {
    returnOnline();
    return;
  }
  window.addEventListener("online", returnOnline, { once: true });
})();
`;

export default function OfflinePage() {
  return (
    <div className="pindrizzle-offline-page">
      <script dangerouslySetInnerHTML={{ __html: reconnectScript }} />
      <main className="pindrizzle-offline-moment">
        <div className="brand">Pindrizzle</div>
        <span className="pindrizzle-offline-icon" aria-hidden="true"><i /></span>
        <div className="pindrizzle-offline-eyebrow">OFFLINE</div>
        <h1>Pindrizzle needs a connection for live local updates.</h1>
        <p>We deliberately do not show an old Feed or Map as if it were current. When your connection returns, Pindrizzle will take you back to fresh nearby activity automatically.</p>
        <a href="/" className="pd-button-primary">Try again</a>
        <small>Posting, replies, maps, search and Activity all require a live connection.</small>
      </main>
      <style>{`
        .pindrizzle-offline-page{min-height:100dvh;display:grid;place-items:center;padding:var(--pd-space-3);background:var(--pd-canvas);color:var(--pd-text)}
        .pindrizzle-offline-moment{width:min(100%,430px);display:grid;justify-items:center;gap:var(--pd-space-2);padding:var(--pd-space-5) var(--pd-space-4);text-align:center}
        .pindrizzle-offline-moment .brand{align-items:center!important;margin-bottom:var(--pd-space-3)}
        .pindrizzle-offline-icon{width:64px;height:64px;display:grid;place-items:center;border-radius:20px;background:var(--pd-aqua-100);box-shadow:inset 0 0 0 1px rgba(37,189,200,.14),var(--pd-elevation-1)}
        .pindrizzle-offline-icon i{width:26px;height:26px;border:2px solid var(--pd-blue-600);border-radius:50% 50% 50% 7px;transform:rotate(-45deg);position:relative}
        .pindrizzle-offline-icon i:after{content:"";position:absolute;width:8px;height:8px;border:2px solid var(--pd-aqua-500);border-radius:50%;left:7px;top:7px}
        .pindrizzle-offline-eyebrow{margin-top:var(--pd-space-2);color:#0c7187;font-size:9px;font-weight:800;letter-spacing:.14em}
        .pindrizzle-offline-moment h1{max-width:360px;margin:0;color:var(--pd-ink-950);font-size:28px;line-height:1.1;letter-spacing:-.045em}
        .pindrizzle-offline-moment p{max-width:360px;margin:0;color:var(--pd-text-2);font-size:13px;line-height:1.6}
        .pindrizzle-offline-moment .pd-button-primary{margin-top:var(--pd-space-3)}
        .pindrizzle-offline-moment small{display:block;max-width:340px;margin-top:var(--pd-space-2);color:var(--pd-muted);font-size:10px;line-height:1.5}
      `}</style>
    </div>
  );
}
