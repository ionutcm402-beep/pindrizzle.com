"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PingIcon from "@/components/PingIcon";

const APP_PATHS = new Set([
  "/",
  "/map",
  "/my-pings",
  "/following",
  "/alerts",
  "/notifications",
  "/you",
  "/search",
  "/place",
  "/promote",
  "/business",
  "/privacy",
  "/safety",
  "/install",
]);

function isAppPath(pathname: string) {
  return APP_PATHS.has(pathname) || pathname.startsWith("/profile/");
}

function sectionFor(pathname: string) {
  if (pathname === "/" || pathname === "/search" || pathname === "/place") return "feed";
  if (pathname === "/map") return "map";
  if (pathname === "/my-pings" || pathname === "/following") return "mine";
  if (pathname === "/alerts" || pathname === "/notifications") return "activity";
  if (
    pathname === "/you" ||
    pathname === "/promote" ||
    pathname === "/business" ||
    pathname === "/privacy" ||
    pathname === "/safety" ||
    pathname === "/install" ||
    pathname.startsWith("/profile/")
  ) return "you";
  return "";
}

export default function Phase25PrimaryNavigationBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const visible = isAppPath(pathname);
  const active = sectionFor(pathname);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    document.body.dataset.pingGlobalNavActive = "true";
    return () => { delete document.body.dataset.pingGlobalNavActive; };
  }, [visible, pathname]);

  useEffect(() => {
    if (!visible) return;
    const sync = () => setComposerOpen(Boolean(document.querySelector(".composer-backdrop")));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [visible, pathname]);

  if (!visible) return null;

  const itemClass = (section: string) => `ping-global-nav-item${active === section ? " active" : ""}`;
  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();
    router.push(href);
  };
  const dropPin = () => router.push("/?compose=1#ping");
  const showCompose = active !== "you" && !composerOpen;

  return <>
    {showCompose && <button type="button" className="ping-global-compose" onClick={dropPin} aria-label="Drop a pin"><PingIcon name="plus" size={18}/><span>Pin</span></button>}
    {!composerOpen && <nav className="ping-global-nav" data-ping-global-nav="true" aria-label="Primary navigation">
      <a href="/" onClick={(event) => navigate(event, "/")} className={itemClass("feed")} aria-current={active === "feed" ? "page" : undefined}><PingIcon name="feed" size={21}/><span>Feed</span></a>
      <a href="/map" onClick={(event) => navigate(event, "/map")} className={itemClass("map")} aria-current={active === "map" ? "page" : undefined}><PingIcon name="map" size={21}/><span>Map</span></a>
      <a href="/my-pings" onClick={(event) => navigate(event, "/my-pings")} className={itemClass("mine")} aria-current={active === "mine" ? "page" : undefined}><PingIcon name="myPings" size={21}/><span>My Pins</span></a>
      <a href="/alerts" onClick={(event) => navigate(event, "/alerts")} className={itemClass("activity")} data-ping-nav-role="activity" aria-current={active === "activity" ? "page" : undefined}><PingIcon name="alerts" size={21}/><span>Activity</span></a>
      <a href="/you" onClick={(event) => navigate(event, "/you")} className={itemClass("you")} aria-current={active === "you" ? "page" : undefined}><PingIcon name="user" size={21}/><span>You</span></a>
    </nav>}
    <style jsx global>{`
      body[data-ping-global-nav-active="true"] nav[aria-label="Primary navigation"]:not([data-ping-global-nav="true"]){display:none!important}
      body[data-ping-global-nav-active="true"] .screen-content{padding-bottom:max(108px,calc(94px + env(safe-area-inset-bottom)))}
      .ping-global-nav{position:fixed;z-index:150;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(calc(100% - 28px),444px);height:70px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:stretch;padding:6px 8px;border:1px solid rgba(16,19,17,.09);border-radius:22px;background:rgba(255,255,255,.97);box-shadow:0 14px 38px rgba(16,25,18,.11);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%)}
      .ping-global-nav-item{position:relative;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;border-radius:13px;color:#7d847f;text-decoration:none;font-size:9px;font-weight:720;line-height:1}
      .ping-global-nav-item svg{display:block;color:currentColor}.ping-global-nav-item span{display:block;white-space:nowrap}.ping-global-nav-item.active{color:var(--ping-accent-ink)}.ping-global-nav-item:active{background:var(--ping-surface-soft)}
      .ping-global-nav-item .ping-global-unread{position:absolute;top:5px;left:calc(50% + 7px);min-width:16px;height:16px;display:grid;place-items:center;border:2px solid #fff;border-radius:999px;background:var(--ping-danger);color:#fff;padding:0 3px;font-size:7px;font-style:normal;font-weight:850;line-height:1}
      .ping-global-compose{position:fixed;z-index:151;right:max(20px,calc((100vw - 444px)/2 + 12px));bottom:max(92px,calc(80px + env(safe-area-inset-bottom)));min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 16px;border:0;border-radius:999px;background:var(--ping-ink);color:#fff;box-shadow:0 12px 28px rgba(16,19,17,.18);font-size:11px;font-weight:780;cursor:pointer}.ping-global-compose:active{transform:scale(.97)}
      @media(max-width:350px){.ping-global-nav{width:calc(100% - 18px);padding-left:4px;padding-right:4px}.ping-global-nav-item{font-size:8px}.ping-global-compose{right:14px}}
      @media(min-width:521px){.ping-global-compose{right:calc(50% - 210px)}}
    `}</style>
  </>;
}
