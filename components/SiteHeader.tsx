"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PingIcon from "@/components/PingIcon";

const NAV_LINKS = [
  { href: "/", label: "Map", section: "map" },
  { href: "/feed", label: "Feed", section: "feed" },
  { href: "/chat", label: "Chat", section: "chat" },
  { href: "/my-pings", label: "My Pins", section: "mine" },
  { href: "/alerts", label: "Activity", section: "activity" },
  { href: "/you", label: "You", section: "you" },
];

const SITE_PATHS = new Set([
  "/", "/map", "/feed", "/chat", "/my-pings", "/following", "/alerts", "/notifications",
  "/you", "/search", "/place", "/promote", "/business", "/privacy",
  "/cookies", "/terms", "/safety", "/install",
]);

function sectionFor(pathname: string) {
  if (pathname === "/" || pathname === "/map" || pathname === "/search" || pathname === "/place") return "map";
  if (pathname === "/feed") return "feed";
  if (pathname === "/chat") return "chat";
  if (pathname === "/my-pings" || pathname === "/following") return "mine";
  if (pathname === "/alerts" || pathname === "/notifications") return "activity";
  if (
    pathname === "/you" || pathname === "/promote" || pathname === "/business" ||
    pathname === "/privacy" || pathname === "/cookies" || pathname === "/terms" ||
    pathname === "/safety" || pathname === "/install" || pathname.startsWith("/profile/")
  ) return "you";
  return "";
}

function shouldUseBrowserNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activityUnread, setActivityUnread] = useState(0);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      window.setTimeout(() => menuButtonRef.current?.focus(), 0);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    const updateUnread = (event: Event) => {
      const count = Number((event as CustomEvent<{ count?: number }>).detail?.count || 0);
      setActivityUnread(Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0);
    };
    window.addEventListener("pindrizzle:activity-unread", updateUnread as EventListener);
    return () => window.removeEventListener("pindrizzle:activity-unread", updateUnread as EventListener);
  }, []);

  const visible = SITE_PATHS.has(pathname) || pathname.startsWith("/profile/");
  if (!visible) return null;

  const active = sectionFor(pathname);
  const unreadLabel = activityUnread > 99 ? "99+" : String(activityUnread);

  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (shouldUseBrowserNavigation(event)) return;
    event.preventDefault();
    setMenuOpen(false);
    router.push(href);
  };

  const openComposer = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (shouldUseBrowserNavigation(event)) return;
    event.preventDefault();
    setMenuOpen(false);
    if (pathname === "/") {
      window.dispatchEvent(new Event("ping:compose-request"));
      return;
    }
    router.push("/#ping");
  };

  const renderNavLink = (link: (typeof NAV_LINKS)[number]) => (
    <a
      key={link.href}
      href={link.href}
      onClick={(event) => navigate(event, link.href)}
      className={`site-nav-link${active === link.section ? " active" : ""}`}
      aria-current={active === link.section ? "page" : undefined}
    >
      <span>{link.label}</span>
      {link.section === "activity" && activityUnread > 0 && (
        <span
          className="site-nav-unread"
          aria-label={`${activityUnread} unread activity ${activityUnread === 1 ? "item" : "items"}`}
        >
          {unreadLabel}
        </span>
      )}
    </a>
  );

  return (
    <header className="site-header" data-site-header="true">
      <div className="site-header-row">
        <a
          href="/"
          className="site-logo"
          onClick={(event) => navigate(event, "/")}
          aria-label="Pindrizzle home"
        >
          <PingIcon name="feed" size={20} />
          <span>Pindrizzle</span>
        </a>

        <nav className="site-nav" aria-label="Primary navigation">
          {NAV_LINKS.map(renderNavLink)}
        </nav>

        <div className="site-header-actions">
          <a
            href="/#ping"
            onClick={openComposer}
            className="site-cta"
            aria-label="Drop a pin"
          >
            <PingIcon name="plus" size={16} />
            <span>Drop a pin</span>
          </a>
          <button
            ref={menuButtonRef}
            type="button"
            className="site-menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-controls="site-primary-navigation-mobile"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="site-primary-navigation-mobile" className="site-nav-mobile" aria-label="Primary navigation">
          {NAV_LINKS.map(renderNavLink)}
        </nav>
      )}
    </header>
  );
}
