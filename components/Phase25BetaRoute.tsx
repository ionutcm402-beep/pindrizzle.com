"use client";

import { useEffect, useState } from "react";
import BetaPanel from "@/components/BetaPanel";
import { createClient } from "@/lib/supabase/client";

type ReleaseStage = "checking" | "closed_beta" | "public";

export default function Phase25BetaRoute() {
  const [stage, setStage] = useState<ReleaseStage>("checking");

  useEffect(() => {
    let active = true;
    void createClient().rpc("public_release_stage").then((result) => {
      if (!active) return;
      const value = Array.isArray(result.data) ? result.data[0] : result.data;
      setStage(!result.error && value === "public" ? "public" : "closed_beta");
    });
    return () => { active = false; };
  }, []);

  if (stage === "checking") {
    return <div className="phase25-beta-finished"><main><p>Checking Ping access…</p></main><style jsx>{styles}</style></div>;
  }

  if (stage === "closed_beta") return <BetaPanel />;

  return (
    <div className="phase25-beta-finished">
      <main>
        <span>PUBLIC ACCESS</span>
        <h1>Ping has moved beyond closed beta.</h1>
        <p>Invites are no longer required. You can create an account and participate directly in the local community.</p>
        <div><a href="/">Open Ping</a><a href="/you">Your account</a></div>
      </main>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .phase25-beta-finished{min-height:100dvh;background:#e9ece6;display:grid;place-items:center;padding:24px;color:#172019}
  main{width:min(100%,520px);background:#f9faf6;border:1px solid #dfe5dc;border-radius:26px;padding:28px;box-shadow:0 18px 50px rgba(31,41,32,.08)}
  span{display:block;font-size:9px;font-weight:950;letter-spacing:.8px;color:#2f6b34;margin-bottom:8px}
  h1{font-size:32px;line-height:1.05;letter-spacing:-1px;margin:0 0 10px}
  p{font-size:12px;line-height:1.6;color:#657067;margin:0}
  div>div{display:flex;gap:9px;margin-top:20px;flex-wrap:wrap}
  a{border-radius:13px;background:#183924;color:#fff;text-decoration:none;padding:12px 14px;font-size:10px;font-weight:900}
  a+a{background:#eef2eb;color:#29452d}
`;
