"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function Phase18BusinessShortcut() {
  const [host, setHost] = useState<Element | null>(null);

  useEffect(() => {
    setHost(document.querySelector(".phase9-promote-intro"));
  }, []);

  if (!host) return null;

  return createPortal(
    <a className="phase18-business-shortcut" href="/business">
      <span>▦</span>
      <div><strong>Promoter dashboard</strong><small>Campaign status, spend and performance</small></div>
      <b>›</b>
      <style jsx global>{`
        .phase18-business-shortcut{display:grid;grid-template-columns:34px 1fr auto;gap:9px;align-items:center;margin-top:12px;padding:10px 11px;border-radius:14px;background:#fff;color:#263029;text-decoration:none;border:1px solid #dce5d9}.phase18-business-shortcut>span{width:34px;height:34px;border-radius:11px;background:#e9f4e5;display:grid;place-items:center;color:#326038;font-size:15px}.phase18-business-shortcut strong,.phase18-business-shortcut small{display:block}.phase18-business-shortcut strong{font-size:10px}.phase18-business-shortcut small{margin-top:2px;color:#7b867d;font-size:7.5px}.phase18-business-shortcut>b{font-size:18px;color:#647068}
      `}</style>
    </a>,
    host,
  );
}
