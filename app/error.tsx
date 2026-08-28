"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Pindrizzle page error:", error);
  }, [error]);

  return (
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
        This page couldn’t load
      </h1>
      <p style={{ color: "#52606d", margin: "0 auto 18px", maxWidth: 420, lineHeight: 1.55 }}>
        Pindrizzle hit a temporary problem. Try the page again, or return to Feed if the problem continues.
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
  );
}
