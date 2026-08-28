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
    return <div className="phase25-beta-finished"><main><p>Checking Pindrizzle access…</p></main><style jsx>{styles}</style></div>;
  }

  if (stage === "closed_beta") return <BetaPanel />;

  return (
    <div className="phase25-beta-finished">
      <main>
        <span>PUBLIC ACCESS</span>
        <h1>Pindrizzle has moved beyond closed beta.</h1>
        <p>Invites are no longer required. You can create an account and participate directly in the local community.</p>
        <div><a href="/">Open Pindrizzle</a><a href="/you">Your account</a></div>
      </main>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .phase25-beta-finished{min-height:100dvh;background:linear-gradient(180deg,#eef9fc,#f8fbfc);display:grid;place-items:center;padding:24px;color:#102b3b}
  main{width:min(100%,520px);background:rgba(255,255,255,.92);border:1px solid rgba(70,165,205,.18);border-radius:26px;padding:28px;box-shadow:0 18px 50px rgba(22,58,77,.10);backdrop-filter:blur(18px)}
  span{display:block;font-size:9px;font-weight:950;letter-spacing:.8px;color:#147ca7;margin-bottom:8px}
  h1{font-size:32px;line-height:1.05;letter-spacing:-1px;margin:0 0 10px}
  p{font-size:12px;line-height:1.6;color:#607a88;margin:0}
  div>div{display:flex;gap:9px;margin-top:20px;flex-wrap:wrap}
  a{border-radius:13px;background:#0e3850;color:#fff;text-decoration:none;padding:12px 14px;font-size:10px;font-weight:900}
  a+a{background:#eaf6fa;color:#174b63}
`;
