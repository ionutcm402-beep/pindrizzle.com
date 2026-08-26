export default function NotFound() {
  return (
    <main className="phase26-route-state">
      <section className="phase26-route-card">
        <div className="phase26-route-brand">ping<span>.</span></div>
        <span className="phase26-route-kicker">NOT FOUND</span>
        <h1>That Ping page isn’t here.</h1>
        <p>It may have expired, been removed, or the link may be incomplete. The live Feed is the safest place to continue.</p>
        <div className="phase26-route-actions">
          <a className="primary" href="/">Open Feed</a>
          <a href="/map">Open Map</a>
        </div>
      </section>
    </main>
  );
}
