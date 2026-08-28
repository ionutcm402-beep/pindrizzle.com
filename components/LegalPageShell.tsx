import type { ReactNode } from "react";

const legalLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Storage" },
  { href: "/terms", label: "Terms" },
  { href: "/safety", label: "Safety" },
];

export default function LegalPageShell({
  title,
  kicker,
  active,
  children,
}: {
  title: string;
  kicker: string;
  active: "privacy" | "cookies" | "terms" | "safety";
  children: ReactNode;
}) {
  return (
    <div className="legal-page">
      <div className="legal-shell">
        <header className="legal-head">
          <a className="legal-back" href="/you" aria-label="Back to You">‹</a>
          <div>
            <span className="legal-kicker">{kicker}</span>
            <h1>{title}</h1>
            <p className="legal-updated">Updated 28 August 2026</p>
          </div>
        </header>
        <nav className="legal-nav" aria-label="Privacy and legal navigation">
          {legalLinks.map((link) => (
            <a key={link.href} className={active === link.href.slice(1) ? "active" : ""} href={link.href}>{link.label}</a>
          ))}
        </nav>
        <main className="legal-content">{children}</main>
        <footer className="legal-footer">
          These pages describe Pindrizzle’s current website controls and closed-beta preparation. Final operator/contact and launch-specific legal details must be completed before public launch.
        </footer>
      </div>
    </div>
  );
}
