"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import PingIcon from "@/components/PingIcon";

function roleForText(text: string) {
  const value = text.trim().toLowerCase();
  if (value === "feed") return "feed";
  if (value === "map") return "map";
  if (value === "ping") return "compose";
  if (value.startsWith("alerts")) return "alerts";
  if (value === "you") return "you";
  return "";
}

function roleIsActive(role: string, pathname: string) {
  if (role === "feed") return pathname === "/";
  if (role === "map") return pathname === "/map";
  if (role === "alerts") return pathname === "/alerts" || pathname === "/notifications";
  if (role === "you") return pathname === "/you";
  return false;
}

export default function Phase25PrimaryNavigationBridge() {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let retries = 0;
    let timer = 0;
    const attach = () => {
      if (disposed) return;
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Primary navigation"]');
      if (!nav) {
        if (retries++ < 12) timer = window.setTimeout(attach, 80);
        return;
      }
      nav.dataset.pingPrimaryNav = "true";
      Array.from(nav.children).forEach((child) => {
        const element = child as HTMLElement;
        if (element.dataset.pingNavRole === "mine") return;
        const role = roleForText(element.textContent || "");
        if (!role) return;
        element.dataset.pingNavRole = role;
        if (roleIsActive(role, pathname)) element.dataset.pingNavActive = "true";
        else delete element.dataset.pingNavActive;
      });
      setTarget(nav);
    };
    attach();
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
      const nav = document.querySelector<HTMLElement>('nav[data-ping-primary-nav="true"]');
      if (nav) {
        delete nav.dataset.pingPrimaryNav;
        Array.from(nav.children).forEach((child) => {
          const element = child as HTMLElement;
          if (element.dataset.pingNavRole !== "mine") {
            delete element.dataset.pingNavRole;
            delete element.dataset.pingNavActive;
          }
        });
      }
      setTarget(null);
    };
  }, [pathname]);

  return (
    <>
      {target && createPortal(
        <a href="/my-pings" data-ping-nav-role="mine" data-ping-nav-active={pathname === "/my-pings" ? "true" : undefined}>
          <PingIcon name="activity" />
          <span className="ping-nav-label">My Pings</span>
        </a>,
        target,
      )}
      <style jsx global>{`
        nav[data-ping-primary-nav="true"]{position:fixed!important;z-index:120!important;left:50%!important;right:auto!important;bottom:max(12px,env(safe-area-inset-bottom))!important;transform:translateX(-50%)!important;width:min(calc(100% - 28px),444px)!important;height:66px!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;padding:5px 7px!important;border:1px solid rgba(16,19,17,.08)!important;border-radius:22px!important;background:rgba(255,255,255,.96)!important;box-shadow:0 12px 34px rgba(16,25,18,.09)!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;overflow:visible!important}
        nav[data-ping-primary-nav="true"]>[data-ping-nav-role]{position:relative!important;min-width:0!important;height:100%!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;border:0!important;background:transparent!important;color:var(--ping-muted-2)!important;text-decoration:none!important;font-size:8.5px!important;font-weight:720!important;line-height:1!important;padding:0!important;margin:0!important;box-shadow:none!important}
        nav[data-ping-primary-nav="true"]>[data-ping-nav-role] svg{width:19px!important;height:19px!important;display:block!important;color:currentColor!important}
        nav[data-ping-primary-nav="true"]>[data-ping-nav-role="feed"]{order:1!important}nav[data-ping-primary-nav="true"]>[data-ping-nav-role="map"]{order:2!important}nav[data-ping-primary-nav="true"]>[data-ping-nav-role="mine"]{order:3!important}nav[data-ping-primary-nav="true"]>[data-ping-nav-role="alerts"]{order:4!important}nav[data-ping-primary-nav="true"]>[data-ping-nav-role="you"]{order:5!important}
        nav[data-ping-primary-nav="true"]>[data-ping-nav-active="true"],nav[data-ping-primary-nav="true"]>.active{color:var(--ping-accent-ink)!important}
        nav[data-ping-primary-nav="true"]>[data-ping-nav-role="compose"]{position:absolute!important;right:10px!important;top:-48px!important;width:auto!important;height:40px!important;min-height:40px!important;display:flex!important;flex-direction:row!important;gap:6px!important;padding:0 14px!important;border-radius:999px!important;background:var(--ping-ink)!important;color:#fff!important;box-shadow:0 10px 24px rgba(16,19,17,.16)!important;font-size:10px!important;font-weight:780!important;z-index:3!important}
        nav[data-ping-primary-nav="true"]>[data-ping-nav-role="compose"]>span{width:18px!important;height:18px!important;display:grid!important;place-items:center!important;border:0!important;border-radius:0!important;background:transparent!important;color:inherit!important;font-size:18px!important;line-height:1!important}nav[data-ping-primary-nav="true"]>[data-ping-nav-role="compose"]>span:before{display:none!important}nav[data-ping-primary-nav="true"]>[data-ping-nav-role="compose"] svg{width:17px!important;height:17px!important}
        nav[data-ping-primary-nav="true"]>[data-ping-nav-role="alerts"] i{position:absolute!important;top:4px!important;right:calc(50% - 18px)!important}.ping-nav-label{display:block;white-space:nowrap}
        @media(max-width:350px){nav[data-ping-primary-nav="true"]{width:calc(100% - 18px)!important}.ping-nav-label{font-size:7.5px}}
      `}</style>
    </>
  );
}
