"use client";

import { usePathname } from "next/navigation";

export default function Phase14SearchEntry() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <>
      <button
        type="button"
        className="phase14-search-entry"
        aria-label="Search nearby Pings"
        onClick={() => window.location.assign("/search")}
      >
        ⌕
      </button>
      <style jsx global>{`
        .phase14-search-entry{position:fixed;z-index:34;top:48px;left:calc(50% + 150px);width:42px;height:42px;border:0;border-radius:50%;background:#fff;color:#304136;box-shadow:0 8px 24px rgba(31,41,32,.10);font-size:22px;font-weight:900;display:grid;place-items:center}
        .phase14-search-entry:active{transform:scale(.96)}
        @media(max-width:520px){.phase14-search-entry{top:20px;left:auto;right:20px}}
      `}</style>
    </>
  );
}
