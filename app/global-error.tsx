"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Pindrizzle global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          role="alert"
          style={{
            maxWidth: 560,
            margin: "80px auto",
            padding: "0 20px",
            fontFamily: "system-ui, sans-serif",
            color: "#10202f",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>
            Pindrizzle couldn’t load
          </h1>
          <p style={{ color: "#52606d", margin: "0 auto 18px", maxWidth: 420, lineHeight: 1.55 }}>
            An unexpected problem stopped the website from loading. Try again, or return to Feed if the problem continues.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                minHeight: 44,
                background: "#082f4a",
                color: "#fff",
                border: "none",
                padding: "10px 18px",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
                color: "#082f4a",
                border: "1px solid #d7e0e7",
                padding: "10px 18px",
                borderRadius: 8,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Return to Feed
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
