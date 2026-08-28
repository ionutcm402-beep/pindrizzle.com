"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
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
            Something broke on this page
          </h1>
          <p style={{ color: "#52606d", marginBottom: 16 }}>
            Pindrizzle hit an unexpected error instead of loading normally.
            This message (instead of a blank or stuck screen) is here so we
            can actually see what went wrong.
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
      </body>
    </html>
  );
}
