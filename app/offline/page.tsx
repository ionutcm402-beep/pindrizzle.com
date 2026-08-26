export const metadata = { title: "Offline — Ping" };

export default function OfflinePage() {
  return (
    <div style={{ minHeight: "100dvh", background: "#eef0ea", display: "grid", placeItems: "center", padding: 20 }}>
      <main style={{ width: "min(100%, 430px)", background: "#f8f8f3", border: "1px solid #dde4da", borderRadius: 30, padding: 28, boxShadow: "0 24px 70px rgba(26,35,27,.12)", color: "#172019" }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: "#59d951", display: "grid", placeItems: "center", marginBottom: 22 }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, background: "#17351b", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 28 }}>p.</div>
        </div>
        <div style={{ color: "#2d6631", fontSize: 10, fontWeight: 950, letterSpacing: ".7px" }}>OFFLINE</div>
        <h1 style={{ margin: "8px 0 10px", fontSize: 30, lineHeight: 1.05, letterSpacing: "-1px" }}>Ping needs a connection for live local updates.</h1>
        <p style={{ margin: 0, color: "#626e65", fontSize: 13, lineHeight: 1.6 }}>We deliberately do not show an old Feed or Map as if it were current. Once you are back online, Ping will refresh nearby activity normally.</p>
        <a href="/" style={{ display: "inline-flex", minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 20, padding: "0 18px", borderRadius: 14, background: "#59d951", color: "#123214", textDecoration: "none", fontWeight: 950, fontSize: 13 }}>Try again</a>
        <small style={{ display: "block", marginTop: 18, color: "#879087", fontSize: 10, lineHeight: 1.5 }}>Posting, replies, maps, search and alerts all require a live connection.</small>
      </main>
    </div>
  );
}
