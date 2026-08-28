"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const routeNames: Record<string, string> = {
  "/": "Feed",
  "/map": "Map",
  "/search": "Search",
  "/place": "Local area",
  "/my-pings": "My Pins",
  "/alerts": "Activity",
  "/notifications": "Notification settings",
  "/following": "Following pins",
  "/you": "Your profile",
  "/compose-start": "Drop a pin",
  "/promote": "Promote a pin",
  "/business": "Promoter dashboard",
  "/moderation": "Moderation",
  "/moderation/promotions": "Promotion moderation",
  "/moderation/compliance": "Compliance moderation",
  "/moderation/beta": "Closed beta moderation",
  "/moderation/launch": "Launch readiness",
  "/privacy": "Privacy Notice",
  "/cookies": "Browser Storage",
  "/terms": "Terms of Use",
  "/safety": "Safety and Complaints",
  "/install": "Install Pindrizzle",
  "/offline": "Offline",
  "/beta": "Closed Beta",
  "/reset-password": "Reset password",
  "/ops": "Operations",
};

function visibleDialogs() {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'))
    .filter((dialog) => dialog.offsetParent !== null || getComputedStyle(dialog).position === "fixed");
}

function focusableInside(dialog: HTMLElement) {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[role="button"],[tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
}

export default function Phase21AccessibilityBridge() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState("");
  const detailPreviousFocus = useRef<HTMLElement | null>(null);

  const label = useMemo(() => {
    if (pathname.startsWith("/profile/")) return "Public profile";
    return routeNames[pathname] || "Pindrizzle";
  }, [pathname]);

  useEffect(() => {
    document.title = `${label} — Pindrizzle`;

    const main = document.querySelector<HTMLElement>("main");
    if (main) {
      main.id = "ping-primary-content";
      if (!main.hasAttribute("tabindex")) main.tabIndex = -1;
    }

    document.querySelectorAll<HTMLElement>('nav[aria-label="Primary navigation"] .active').forEach((item) => {
      item.setAttribute("aria-current", "page");
    });
    document.querySelectorAll<HTMLElement>('nav[aria-label="Primary navigation"] a:not(.active),nav[aria-label="Primary navigation"] button:not(.active)').forEach((item) => {
      item.removeAttribute("aria-current");
    });
    document.querySelectorAll<HTMLElement>('nav[aria-label="Primary navigation"] a > span,nav[aria-label="Primary navigation"] button > span').forEach((icon) => {
      icon.setAttribute("aria-hidden", "true");
    });

    const timer = window.setTimeout(() => setAnnouncement(`${label} loaded`), 80);
    return () => window.clearTimeout(timer);
  }, [label, pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const dialogs = visibleDialogs();
      const topDialog = dialogs[dialogs.length - 1];

      if (topDialog && event.key === "Tab") {
        const focusable = focusableInside(topDialog);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!topDialog.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
          return;
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
          return;
        }
      }

      if (topDialog && event.key === "Escape") {
        if (topDialog.classList.contains("password-auth-backdrop") || topDialog.classList.contains("first-run-backdrop")) return;
        const controls = Array.from(topDialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
        const closeButton = controls.find((button) => /^(close|cancel)$/i.test(button.textContent?.trim() || ""));
        if (closeButton) {
          event.preventDefault();
          closeButton.click();
          return;
        }
      }

      if (event.key === " ") {
        const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[role="button"]') : null;
        if (!target || target.tagName === "BUTTON" || target.tagName === "A") return;
        event.preventDefault();
        target.click();
      }
    };

    const preparePingDetail = () => {
      detailPreviousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.setTimeout(() => {
        const dialog = document.querySelector<HTMLElement>(".phase5-detail-backdrop[role=dialog]");
        const heading = dialog?.querySelector<HTMLElement>("h1");
        if (!dialog || !heading) return;
        heading.id = "phase5-detail-title";
        heading.tabIndex = -1;
        dialog.setAttribute("aria-labelledby", heading.id);
        dialog.removeAttribute("aria-label");
        const message = dialog.querySelector<HTMLElement>(".phase5-action-message");
        if (message) {
          message.setAttribute("role", "status");
          message.setAttribute("aria-live", "polite");
        }
        const reply = dialog.querySelector<HTMLTextAreaElement>(".phase5-reply-compose textarea");
        if (reply && !reply.getAttribute("aria-label")) reply.setAttribute("aria-label", "Write a reply");
        const reportReason = dialog.querySelector<HTMLSelectElement>(".phase5-report-box select");
        if (reportReason && !reportReason.getAttribute("aria-label")) reportReason.setAttribute("aria-label", "Report reason");
        heading.focus({ preventScroll: true });
      }, 0);
    };

    const restoreDetailFocus = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target?.closest(".phase5-detail-backdrop")) return;
      const button = target.closest<HTMLButtonElement>("button");
      if (button && /^(close)$/i.test(button.textContent?.trim() || "")) {
        window.setTimeout(() => detailPreviousFocus.current?.focus(), 0);
      }
    };

    window.addEventListener("ping:open-detail", preparePingDetail as EventListener);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", restoreDetailFocus);
    return () => {
      window.removeEventListener("ping:open-detail", preparePingDetail as EventListener);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", restoreDetailFocus);
    };
  }, []);

  const skipToContent = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const main = document.querySelector<HTMLElement>("#ping-primary-content") || document.querySelector<HTMLElement>("main");
    if (!main) return;
    event.preventDefault();
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: "start" });
  };

  return (
    <>
      <a className="phase21-skip-link" href="#ping-primary-content" onClick={skipToContent}>Skip to main content</a>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </>
  );
}
