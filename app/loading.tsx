export default function Loading() {
  return (
    <main className="phase26-route-state" aria-busy="true" aria-live="polite">
      <section className="phase26-route-card">
        <div className="phase26-route-brand">ping<span>.</span></div>
        <span className="phase26-route-kicker">LOADING NEARBY</span>
        <h1>Getting the local view ready.</h1>
        <p>Ping is loading the real activity for this screen. No sample posts are inserted while you wait.</p>
        <div className="phase26-loading-lines" aria-hidden="true">
          <span className="phase26-loading-line" />
          <span className="phase26-loading-line" />
          <span className="phase26-loading-line" />
        </div>
      </section>
    </main>
  );
}
