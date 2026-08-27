"use client";

import { useEffect } from "react";

const ATTRIBUTES = ["aria-label", "title", "placeholder"] as const;

const BRAND_RULES: Array<[RegExp, string]> = [
  [/\bPing is installed\b/g, "Pindrizzle is installed"],
  [/\bInstall Ping\b/g, "Install Pindrizzle"],
  [/\bAdd Ping to\b/g, "Add Pindrizzle to"],
  [/\bSign in to Ping\b/g, "Sign in to Pindrizzle"],
  [/\bWelcome to Ping\b/g, "Welcome to Pindrizzle"],
  [/\bAllow location for Ping\b/g, "Allow location for Pindrizzle"],
  [/\bPing in your browser\b/g, "Pindrizzle in your browser"],
  [/\bPing is in closed beta\b/g, "Pindrizzle is in closed beta"],
  [/\bPing (uses|asks|will|can|does|stores|keeps|never|supports|protects|works|needs|offers|helps|shows|lets|requires|recommends|stays)\b/g, "Pindrizzle $1"],
  [/\bPing (account|app|beta|privacy|safety|settings|notifications|location|data|service|website|team|moderation|analytics)\b/g, "Pindrizzle $1"],
  [/\bPing couldn’t\b/g, "Pindrizzle couldn’t"],
  [/\bPing could not\b/g, "Pindrizzle could not"],
  [/\bPing failed\b/g, "Pindrizzle failed"],
];

const PIN_RULES: Array<[RegExp, string]> = [
  [/\bMy Pings\b/g, "My Pins"],
  [/\bFollowed Pings\b/g, "Followed Pins"],
  [/\bFollowing Pings\b/g, "Following Pins"],
  [/\bNew Ping\b/g, "New pin"],
  [/\bCreate a Ping\b/g, "Drop a pin"],
  [/\bCreate Ping\b/g, "Drop pin"],
  [/\bPost a Ping\b/g, "Drop a pin"],
  [/\bPost your Ping\b/g, "Drop your pin"],
  [/\bPromote a Ping\b/g, "Promote a pin"],
  [/\bOpen Ping\b/g, "Open pin"],
  [/\bRemove Ping\b/g, "Remove pin"],
  [/\bEdit Ping\b/g, "Edit pin"],
  [/\bKeep this Ping live\b/g, "Keep this pin live"],
  [/\bSelected Ping photo preview\b/g, "Selected pin photo preview"],
  [/\bPing category\b/g, "Pin category"],
  [/\bPing it\b/g, "Drop pin"],
  [/\bThis Ping\b/g, "This pin"],
  [/\bthis Ping\b/g, "this pin"],
  [/\bYour Ping\b/g, "Your pin"],
  [/\byour Ping\b/g, "your pin"],
  [/\bthe Ping\b/g, "the pin"],
  [/\ba Ping\b/g, "a pin"],
  [/\beach Ping\b/g, "each pin"],
  [/\bnearby Ping\b/g, "nearby pin"],
  [/\blive Pings\b/g, "live pins"],
  [/\bPings\b/g, "pins"],
  [/\bPing\b/g, "pin"],
];

function rewrite(value: string) {
  let next = value;
  for (const [pattern, replacement] of BRAND_RULES) next = next.replace(pattern, replacement);
  for (const [pattern, replacement] of PIN_RULES) next = next.replace(pattern, replacement);
  return next;
}

function isUserContent(element: Element | null) {
  if (!element) return false;
  return Boolean(element.closest(
    [
      "[data-ping-id] .ping-body",
      "[data-ping-id] h1",
      "[data-ping-id] h2",
      "[data-ping-id] h3",
      ".detail-v3-sheet h1",
      ".detail-v3-body",
      ".detail-v3-photo",
      ".my-pings-v3-card > h2",
      ".my-pings-v3-card > p",
      ".following-v3-main h2",
      ".following-v3-main > p",
      ".map-v3-card h2",
      ".activity-copy > small",
      ".phase9-ping-options button > strong",
      ".phase9-ping-options button > p",
      ".phase9-history-title span",
      ".phase9-request-history article h2",
      ".phase9-request-history article > p",
      ".phase18-actions small",
      ".phase18-card h2",
      ".phase18-sponsor strong",
      ".phase18-review-note span",
      ".comment-body",
      ".reply-body",
      ".public-profile-bio",
      "[data-user-content]",
      "input",
      "textarea",
      "[contenteditable='true']",
    ].join(","),
  ));
}

function updateTextNode(node: Text) {
  const parent = node.parentElement;
  if (isUserContent(parent)) return;
  const current = node.nodeValue || "";
  if (!current.includes("Ping")) return;
  const next = rewrite(current);
  if (next !== current) node.nodeValue = next;
}

function updateAttributes(element: Element) {
  if (isUserContent(element)) return;
  for (const attribute of ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (!current || !current.includes("Ping")) continue;
    const next = rewrite(current);
    if (next !== current) element.setAttribute(attribute, next);
  }
}

function updateSubtree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    updateTextNode(root as Text);
    return;
  }
  if (!(root instanceof Element) && root !== document.body) return;

  if (root instanceof Element) updateAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) updateTextNode(current as Text);
    else if (current instanceof Element) updateAttributes(current);
    current = walker.nextNode();
  }
}

export default function PindrizzleCopyBridge() {
  useEffect(() => {
    updateSubtree(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") updateTextNode(mutation.target as Text);
        if (mutation.type === "attributes" && mutation.target instanceof Element) updateAttributes(mutation.target);
        if (mutation.type === "childList") mutation.addedNodes.forEach(updateSubtree);
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
