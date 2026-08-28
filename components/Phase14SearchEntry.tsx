"use client";

import { usePathname, useRouter } from "next/navigation";
import PingIcon from "@/components/PingIcon";

export default function Phase14SearchEntry() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname !== "/") return null;

  return (
    <>
      <button
        type="button"
        className="phase14-search-entry"
        aria-label="Search nearby pins"
        onClick={() => router.push("/search")}
      >
        <PingIcon name="search" size={20}/>
      </button>
      <style jsx global>{`
        .phase14-search-entry{position:fixed;z-index:34;top:48px;left:calc(50% + 150px);width:42px;height:42px;border:0;border-radius:50%;background:#fff;color:#304136;box-shadow:0 8px 24px rgba(31,41,32,.10);display:grid;place-items:center}.phase14-search-entry:active{transform:scale(.96)}
        @media(max-width:520px){.phase14-search-entry{top:20px;left:auto;right:20px}}
      `}</style>
    </>
  );
}
