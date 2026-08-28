export default function Loading() {
  return (
    <main
      aria-live="polite"
      aria-busy="true"
      style={{
        minHeight: "55vh",
        display: "grid",
        placeItems: "center",
        padding: "48px 20px",
        color: "#10202f",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            margin: "0 auto 14px",
            border: "3px solid #dce6ec",
            borderTopColor: "#082f4a",
            borderRadius: "50%",
            animation: "pindrizzle-loading-spin .8s linear infinite",
          }}
        />
        <strong style={{ display: "block", fontSize: 15 }}>Loading Pindrizzle…</strong>
        <span style={{ display: "block", marginTop: 5, color: "#667784", fontSize: 12 }}>
          Getting the latest page ready.
        </span>
      </div>
      <style>{`@keyframes pindrizzle-loading-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){div[aria-hidden="true"]{animation:none!important}}`}</style>
    </main>
  );
}
