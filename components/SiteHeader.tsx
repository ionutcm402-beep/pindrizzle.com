"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PingIcon from "@/components/PingIcon";

const NAV_LINKS = [
  { href: "/", label: "Feed", section: "feed" },
  { href: "/map", label: "Map", section: "map" },
  { href: "/my-pings", label: "My Pins", section: "mine" },
  { href: "/alerts", label: "Activity", section: "activity" },
  { href: "/you", label: "You", section: "you" },
];

const SITE_PATHS = new Set([
  "/", "/map", "/my-pings", "/following", "/alerts", "/notifications",
  "/you", "/search", "/place", "/promote", "/business", "/privacy",
  "/cookies", "/terms", "/safety", "/install",
]);

function sectionFor(pathname: string) {
  if (pathname === "/" || pathname === "/search" || pathname === "/place") return "feed";
  if (pathname === "/map") return "map";
  if (pathname === "/my-pings" || pathname === "/following") return "mine";
  if (pathname === "/alerts" || pathname === "/notifications") return "activity";
  if (
    pathname === "/you" || pathname === "/promote" || pathname === "/business" ||
    pathname === "/privacy" || pathname === "/cookies" || pathname === "/terms" ||
    pathname === "/safety" || pathname === "/install" || pathname.startsWith("/profile/")
  ) return "you";
  return "";
}

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const visible = SITE_PATHS.has(pathname) || pathname.startsWith("/profile/");
  if (!visible) return null;

  const active = sectionFor(pathname);

  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();
    setMenuOpen(false);
    router.push(href);
  };

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
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(event) => navigate(event, link.href)}
              className={`site-nav-link${active === link.section ? " active" : ""}`}
              aria-current={active === link.section ? "page" : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="site-header-actions">
          <a
            href="/compose-start"
            onClick={(event) => navigate(event, "/compose-start")}
            className="site-cta"
            aria-label="Drop a pin"
          >
            <PingIcon name="plus" size={16} />
            <span>Drop a pin</span>
          </a>
          <button
            type="button"
            className="site-menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="site-nav-mobile" aria-label="Primary navigation">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(event) => navigate(event, link.href)}
              className={`site-nav-link${active === link.section ? " active" : ""}`}
              aria-current={active === link.section ? "page" : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
