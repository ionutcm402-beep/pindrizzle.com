"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const POLISHED_PATHS = new Set(["/promote", "/business", "/search"]);
const ATTRIBUTES = ["aria-label", "title", "placeholder"] as const;

const COPY_RULES: Array<[RegExp, string]> = [
  [/^pindrizzle$/g, "Pindrizzle"],

  // Business and promotions
  [/Know what your local promotion is doing\./g, "Promotion performance"],
  [/See campaign status, spend and privacy-minimal performance\. Browser sessions are estimates, not a count of unique people\./g, "See campaign status and privacy-minimal performance. Browser sessions are estimates, not unique people."],
  [/Sign in to manage promotions\./g, "Sign in to view promotions"],
  [/Your campaign history and performance stay tied to your Pindrizzle account\./g, "View promotion history and performance for your account."],
  [/Paid so far/g, "Paid total"],
  [/\+ Promote another pin/g, "Promote another pin"],
  [/Ready to pay/g, "Approved"],
  [/Complete payment →/g, "Payment unavailable"],
  [/No promotion history yet\./g, "No promotions yet"],
  [/Promote a useful local pin to start building campaign history\./g, "Promotion requests will appear here."],
  [/Reach more people nearby\./g, "Promote a local pin"],
  [/Promoted pins stay local, are always labelled as paid placement, and keep the normal Report & Block controls\./g, "Promoted pins stay local, are clearly labelled, and keep normal Report and Block controls."],
  [/Sign in to promote a pin\./g, "Sign in to request a promotion"],
  [/Create a useful pin first, then choose how far and how long to promote it\./g, "Choose one of your live pins, then set its radius and duration."],
  [/No eligible pins right now\./g, "No eligible pins"],
  [/Create a new pin, then come back here while it still has enough time left\./g, "Create a pin and return while it is still active."],
  [/Who is promoting it\?/g, "Sponsor name"],
  [/This name appears on the paid placement\./g, "This name appears on the promoted pin."],
  [/The placement never appears outside this radius\./g, "Choose the local radius."],
  [/A promotion cannot outlive the original pin\./g, "The promotion cannot outlive the pin."],
  [/Total promotion price/g, "Promotion quote"],
  [/Submitting creates a moderation request and takes no payment\. Once approved, an unpaid request can be completed through secure Stripe Checkout\./g, "Submitting creates a moderation request. No payment is taken. Payments remain unavailable until the dedicated Pindrizzle payment account is enabled."],
  [/Promotion request submitted for [^.]+\. No payment has been taken\./g, "Promotion request submitted. No payment has been taken."],
  [/Not paid/g, "Payment unavailable"],
  [/No promotion requests yet\./g, "No promotion requests"],

  // Search
  [/Search & discover/g, "Search nearby"],
  [/Find what matters nearby/g, "Find nearby pins"],
  [/Deals, outages, traffic, Marketplace and useful local pins — never a global feed\./g, "Search active local pins within your selected radius."],
  [/Nearby search is temporarily unavailable\./g, "Nearby search is unavailable."],
  [/Location is blocked/g, "Location is off"],
  [/Search starts with your location/g, "Search nearby"],
  [/Search reuses the same Pindrizzle location permission as Feed and Map\./g, "Location is shared with Feed and Map."],
  [/Searching nearby…/g, "Searching…"],
  [/available to discover/g, "nearby"],
  [/Search couldn’t load/g, "Search is unavailable"],
  [/Quiet around here/g, "No active pins"],
  [/There are no active pins in this area right now\./g, "No active pins within this radius."],
  [/Try “road closed”, “deal”, “room”…/g, "Search nearby pins"],
];

function rewrite(value: string) {
  let next = value;
  for (const [pattern, replacement] of COPY_RULES) next = next.replace(pattern, replacement);
  return next;
}

function isProtectedContent(element: Element | null) {
  return Boolean(element?.closest("[data-user-content],[contenteditable='true'],script,style,noscript"));
}

function updateText(node: Text) {
  if (isProtectedContent(node.parentElement)) return;
  const current = node.nodeValue || "";
  const next = rewrite(current);
  if (next !== current) node.nodeValue = next;
}

function updateElement(element: Element) {
  if (isProtectedContent(element)) return;
  for (const attribute of ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    const next = rewrite(current);
    if (next !== current) element.setAttribute(attribute, next);
  }
}

function updateSubtree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    updateText(root as Text);
    return;
  }
  if (!(root instanceof Element) && root !== document.body) return;

  if (root instanceof Element) updateElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) updateText(current as Text);
    else if (current instanceof Element) updateElement(current);
    current = walker.nextNode();
  }
}

function lockPaymentLinks() {
  document.querySelectorAll<HTMLAnchorElement>(".phase18-card-actions a").forEach((link) => {
    const text = link.textContent?.trim() || "";
    if (text !== "Payment unavailable" && !text.includes("Complete payment")) return;
    link.textContent = "Payment unavailable";
    link.setAttribute("aria-disabled", "true");
    link.setAttribute("data-payment-locked", "true");
    link.removeAttribute("href");
  });
}

export default function CommercialSafetyBridge() {
  const pathname = usePathname();

  useEffect(() => {
    if (!POLISHED_PATHS.has(pathname)) return;

    const apply = (root: Node = document.body) => {
      updateSubtree(root);
      lockPaymentLinks();
    };

    apply();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") updateText(mutation.target as Text);
        if (mutation.type === "attributes" && mutation.target instanceof Element) updateElement(mutation.target);
        if (mutation.type === "childList") mutation.addedNodes.forEach((node) => apply(node));
      }
      lockPaymentLinks();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
