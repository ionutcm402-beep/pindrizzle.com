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
    <div
      style={{
        maxWidth: 560,
        margin: "80px auto",
        padding: "0 20px",
        fontFamily: "system-ui, sans-serif",
        color: "#10202f",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>
        This page hit an error
      </h1>
      <p style={{ color: "#52606d", marginBottom: 16 }}>
        Instead of staying blank or stuck loading, here's what actually
        went wrong:
      </p>
      <pre
        style={{
          background: "#f2f5f8",
          padding: 12,
          borderRadius: 8,
          fontSize: 13,
          overflowX: "auto",
          whiteSpace: "pre-wrap",
        }}
      >
        {error.message || "Unknown error"}
      </pre>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          marginTop: 16,
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
    </div>
  );
}
