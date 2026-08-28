export const metadata = { title: "Page not found — Pindrizzle" };

export default function NotFoundPage() {
  return (
    <div className="pindrizzle-not-found-page">
      <main className="pindrizzle-not-found-card">
        <a className="pindrizzle-not-found-brand" href="/" aria-label="Pindrizzle home">Pindrizzle</a>
        <div className="pindrizzle-not-found-code">404</div>
        <h1>This page doesn’t exist.</h1>
        <p>The link may be old or the address may be incorrect. You can return to nearby updates or search Pindrizzle.</p>
        <div className="pindrizzle-not-found-actions">
          <a className="primary" href="/">Open Feed</a>
          <a href="/search">Search nearby</a>
          <a href="/map">Open Map</a>
        </div>
      </main>
      <style>{`
        .pindrizzle-not-found-page{min-height:100dvh;display:grid;place-items:center;padding:24px;background:#f4f8fa;color:#10202f}
        .pindrizzle-not-found-card{width:min(100%,520px);padding:42px 30px;border:1px solid #e3e8ee;border-radius:24px;background:#fff;box-shadow:0 18px 50px rgba(8,47,74,.08);text-align:center}
        .pindrizzle-not-found-brand{display:inline-flex;min-height:44px;align-items:center;color:#082f4a;font-size:18px;font-weight:800;text-decoration:none}
        .pindrizzle-not-found-code{margin-top:18px;color:#0c7187;font-size:11px;font-weight:850;letter-spacing:.18em}
        .pindrizzle-not-found-card h1{margin:9px 0 8px;color:#082f4a;font-size:30px;line-height:1.08;letter-spacing:-.04em}
        .pindrizzle-not-found-card p{max-width:410px;margin:0 auto;color:#667785;font-size:13px;line-height:1.6}
        .pindrizzle-not-found-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:22px}
        .pindrizzle-not-found-actions a{min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 15px;border:1px solid #dce5ea;border-radius:10px;background:#fff;color:#173f57;font-size:12px;font-weight:800;text-decoration:none}
        .pindrizzle-not-found-actions a.primary{border-color:#082f4a;background:#082f4a;color:#fff}
        @media(max-width:520px){.pindrizzle-not-found-page{padding:16px}.pindrizzle-not-found-card{padding:34px 20px}.pindrizzle-not-found-actions{flex-direction:column}.pindrizzle-not-found-actions a{width:100%}}
      `}</style>
    </div>
  );
}
