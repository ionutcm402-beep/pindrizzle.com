"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Ping route error", error);
  }, [error]);

  return (
    <main className="phase26-route-state">
      <section className="phase26-route-card" role="alert">
        <div className="phase26-route-brand">ping<span>.</span></div>
        <span className="phase26-route-kicker">TEMPORARY PROBLEM</span>
        <h1>This screen didn’t load cleanly.</h1>
        <p>Your account and Pings have not been changed. Try this screen again, or return to the Feed.</p>
        <div className="phase26-route-actions">
          <button type="button" className="primary" onClick={reset}>Try again</button>
          <a href="/">Back to Feed</a>
        </div>
      </section>
    </main>
  );
}
