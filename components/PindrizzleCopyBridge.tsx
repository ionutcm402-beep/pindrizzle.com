"use client";

import { useEffect } from "react";

const ATTRIBUTES = ["aria-label", "title", "placeholder"] as const;

const FACT_RULES: Array<[RegExp, string]> = [
  [
    /Ping stores only an approximate neighbourhood-scale point for public Pings\. Your browser’s original GPS coordinate is not published as the Ping location\./g,
    "Private pins store an approximate neighbourhood-scale point. If you explicitly choose Exact, the selected point is public. Your browser location is never silently published as a pin location.",
  ],
];

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
  [/\bPing it\b/g, "Publish"],
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

const POLISH_RULES: Array<[RegExp, string]> = [
  // Feed and location
  [/Real updates near you, ordered by usefulness\./g, "Nearby updates, ranked by relevance."],
  [/Live local data is temporarily unavailable\./g, "Nearby updates are unavailable."],
  [/Your local feed starts with location\./g, "Turn on location to see nearby pins."],
  [/We couldn’t load nearby pins\./g, "Nearby pins are unavailable."],
  [/Enable location once and Pindrizzle will reuse that permission across Feed and Map\./g, "Location is used for Feed and Map. Your exact browser position is not published."],
  [/Try again shortly\./g, "Try again in a moment."],
  [/1 useful pin exist within ([0-9.]+) miles\./g, "1 pin is available within $1 miles."],
  [/([0-9]+) useful pins exist within ([0-9.]+) miles\./g, "$1 pins are available within $2 miles."],
  [/No nearby listings match these Marketplace filters right now\./g, "No nearby listings match these filters."],
  [/Nothing active has been reported in this category nearby right now\./g, "No active pins in this category nearby."],
  [/Quiet within ([0-9.]+) (mile|miles)\./g, "Quiet within $1 $2"],
  [/Turn on location once/g, "Turn on location"],
  [/One permission powers Feed, Map and local posting\. Your exact position is never published\./g, "Location is used for Feed, Map and local posting. Your exact browser position is not published."],
  [/Location is blocked/g, "Location is off"],
  [/Allow location for pin in your browser settings, then try again\./g, "Allow location for Pindrizzle in your browser settings, then try again."],

  // Composer
  [/What should people nearby know\?/g, "Share something useful nearby"],
  [/Business posts are self-identified for now\. Pindrizzle will not call them verified until a verification system exists\./g, "Business posts are self-identified and are not shown as verified."],
  [/Use the link when the full listing already lives on another website\. Pindrizzle stays the local discovery layer\./g, "Add a link when the full listing is hosted elsewhere."],
  [/What kind of deal\?/g, "Deal type"],
  [/Short headline/g, "Headline"],
  [/Useful detail/g, "Details"],
  [/What should neighbours know\?/g, "Add a clear headline"],
  [/Price, stock, where you saw it and anything people should know…/g, "Add the price, availability and location."],
  [/Key details people nearby need before they open the full listing…/g, "Add the details people need before opening the listing."],
  [/Keep it clear and useful…/g, "Add the details people need."],
  [/Marketplace listings can stay discoverable for up to 30 days\. Resolve them earlier when sold, rented or no longer wanted\./g, "Marketplace listings can stay live for up to 30 days. Resolve them when they are no longer available."],
  [/Pindrizzle recommends shorter lifetimes for traffic, parking and alerts, and longer ones for Lost & Found\./g, "Shorter durations suit traffic, parking and alerts. Lost & Found can stay live longer."],
  [/Your browser location is snapped to an approximate public area before publishing\./g, "New pins use an approximate public area by default."],
  [/Posting…/g, "Publishing…"],
  [/Sign in once to post useful pins nearby\./g, "Sign in to publish a pin."],
  [/Sign in to confirm useful pins near you\./g, "Sign in to confirm a nearby pin."],
  [/Sign in to publish this pin\./g, "Sign in to publish a pin."],

  // Map
  [/Location is off for pin\./g, "Location is off."],
  [/Turn on location to use Feed and Map\./g, "Turn on location to use Feed and Map."],
  [/Allow it for pin in your browser settings, then try again\./g, "Allow location in your browser settings, then try again."],
  [/We could not get your location right now\./g, "Location is unavailable."],
  [/Checking nearby pins…/g, "Loading nearby pins…"],
  [/Live Pindrizzle data could not load right now\./g, "Nearby pins are unavailable."],
  [/Your local map/g, "See what’s nearby"],
  [/One location permission powers Feed and Map\. Pindrizzle never publishes your exact browser coordinates\./g, "Location powers Feed and Map. Your exact browser position is not published."],
  [/Nothing active here\./g, "No active pins"],
  [/No Marketplace listings match these shared filters/g, "No Marketplace listings match these filters."],
  [/No live pins inside ([0-9.]+) mi right now\./g, "No active pins within $1 mi."],
  [/No ([A-Za-z &]+) pins inside ([0-9.]+) mi right now\./g, "No $1 pins within $2 mi."],
  [/What do you want to see\?/g, "Choose what to show"],
  [/These filters also update Feed\./g, "Changes also apply to Feed."],

  // My Pins
  [/What you’ve shared, what is still live, and what has finished\./g, "Manage the pins you’ve published."],
  [/Your pins live here\./g, "Sign in to see your pins"],
  [/Sign in to see and manage the local updates you’ve posted\./g, "View, edit and resolve the pins you’ve published."],
  [/Your pins didn’t load\./g, "Your pins are unavailable"],
  [/Your pins could not load right now\. Check your connection and try again\./g, "Your pins are unavailable. Check your connection and try again."],
  [/Checking your pins…/g, "Loading your pins…"],
  [/Your live local pins will appear here after you post them\./g, "Pins you publish appear here."],
  [/Pins you mark resolved stay here as part of your history\./g, "Resolved pins stay here for your records."],
  [/Pins that reach their expiry time stay here for you\./g, "Expired pins stay here for your records."],
  [/Removed pins stay in your private history so moderation and audit records remain intact\./g, "Removed pins stay in your private history."],
  [/No (active|resolved|expired|removed) pins\./g, "No $1 pins"],
  [/Pin marked resolved\. It is no longer shown as live\./g, "Pin resolved. It is no longer live."],
  [/That pin could not be resolved right now\./g, "This pin could not be resolved."],
  [/Pin removed from community views\. Its audit history is preserved\./g, "Pin removed. Its audit history is preserved."],
  [/This pin has a promotion in progress\. Finish that promotion before removing it\./g, "This pin has an active promotion. End the promotion before removing it."],
  [/That pin could not be removed right now\./g, "This pin could not be removed."],
  [/Pin updated\. Feed and Map will use the new details\./g, "Pin updated."],
  [/Promotion in progress — editing and removal are unavailable until it finishes\./g, "Promotion in progress. Editing and removal are unavailable until it ends."],
  [/Editing and removal unavailable during promotion/g, "Editing and removal are unavailable during promotion"],
  [/It disappears from community views, but replies, reports and audit history are preserved\./g, "This removes it from community views. Replies, reports and audit history are preserved."],

  // Activity
  [/Only useful things that happened around your pins\./g, "Replies, confirmations and outcomes from your pins."],
  [/Activity could not load right now\. Check your connection and try again\./g, "Activity is unavailable. Check your connection and try again."],
  [/Activity didn’t load\./g, "Activity is unavailable"],
  [/Your useful activity lives here\./g, "Sign in to see activity"],
  [/Sign in to see replies, confirmations, Helpful marks and outcomes from pins you follow\./g, "See replies, confirmations, Helpful marks and followed outcomes."],
  [/Checking your activity…/g, "Loading activity…"],
  [/You’re all caught up\./g, "No new activity"],
  [/Useful replies, confirmations, Helpful marks and followed outcomes will appear here\./g, "Replies, confirmations and followed outcomes will appear here."],
  [/Useful notifications only\./g, "Only relevant activity."],
  [/No “we miss you” messages\. Pindrizzle Activity is reserved for real actions and outcomes that matter\./g, "Activity is reserved for real actions and outcomes. No engagement reminders."],

  // You
  [/Join your local community/g, "Pindrizzle account"],
  [/Browse freely\. Sign in when you want to participate\./g, "Sign in to publish, confirm and follow local updates."],
  [/This is the name neighbours see on your public Pindrizzle profile\./g, "This name appears on your public profile."],
  [/That name can’t be used\. Avoid links and reserved Pindrizzle roles\./g, "Choose a different name. Links and reserved roles are not allowed."],
  [/Active for Feed, Map and local posting/g, "On for Feed, Map and local posting"],
  [/Checking your location permission…/g, "Checking location permission…"],
  [/Blocked in this browser — tap after changing permission/g, "Off in this browser. Change permission, then try again."],
  [/Enable once for Feed, Map and local posting/g, "Turn on for Feed, Map and local posting"],
  [/Activity, not identity verification/g, "Based on activity, not identity"],
  [/Helpful earned/g, "Helpful marks"],
  [/Confirms earned/g, "Confirmations"],
  [/Keep track of useful local outcomes/g, "Track pins you want to revisit"],
  [/Control replies, confirmations and Helpful notifications/g, "Choose which activity you see"],
  [/One radius for Feed and Map/g, "Used by Feed and Map"],
  [/Participate when you’re ready/g, "Publish, confirm and follow pins"],
  [/See what other neighbours can see/g, "Preview your public profile"],
  [/Blocked users, reports and location privacy/g, "Manage blocked users, reports and location privacy"],
  [/Offers, discounts, new stock and restocks/g, "Post offers, stock updates and local deals"],
  [/Paid local reach for one of your live pins/g, "Increase local reach for a live pin"],
  [/Leave this account on this device/g, "Sign out on this device"],

  // Compose preflight
  [/Complete sign in, then pin creation will continue automatically\./g, "Sign in to continue creating your pin."],
  [/Preparing pin creation\. This should only take a moment\./g, "Preparing your pin."],
  [/Location permission is blocked\. Allow location in your browser settings, then try again\./g, "Allow location in your browser settings, then try again."],
  [/We couldn’t get your location\. Check your connection and location settings, then try again\./g, "Location is unavailable. Check your browser settings and try again."],
  [/Pin creation couldn’t start\. Check your connection and try again\./g, "Pin creation is unavailable. Check your connection and try again."],
  [/Location needed/g, "Unable to start"],
  [/Getting your location…/g, "Finding your location…"],

  // Onboarding
  [/DROP IN DAILY/g, "LOCAL BY DESIGN"],
  [/Know what matters around you\./g, "See what matters nearby."],
  [/Useful local pins from people nearby—without the noise of a traditional social feed\./g, "Local pins from people nearby, ranked for usefulness."],
  [/Your chosen area decides what you see, not global popularity\./g, "Your selected radius controls what appears."],
  [/Useful right now/g, "Current and useful"],
  [/People nearby can confirm useful information and report bad information\./g, "People nearby can confirm useful information or report problems."],
  [/Browse before signing in\. Join only when you want to participate\./g, "Browse without an account. Sign in when you want to participate."],
  [/Choose my area/g, "Choose area"],
  [/Choose how local Pindrizzle feels\./g, "Choose your nearby radius."],
  [/Start small\. You can change this radius whenever you want from the Feed or your profile\./g, "You can change this later from Feed or You."],
  [/Private by default when you drop a pin\./g, "Approximate location by default."],
  [/Every new pin starts with Private location and shows an approximate area\. You can deliberately choose Exact location when a precise public point is useful\./g, "New pins show an approximate area unless you deliberately choose Exact."],
  [/Open my local Feed/g, "Open Feed"],

  // Authentication
  [/Sign in or create your Pindrizzle account\./g, "Sign in or create an account."],
  [/Welcome back\./g, "Sign in"],
  [/Join the Pindrizzle closed beta\./g, "Create a beta account"],
  [/Create your Pindrizzle account\./g, "Create an account"],
  [/Reset your password\./g, "Reset password"],
  [/New accounts currently need a beta invite\. Pindrizzle accounts are for people aged 13 or over, and your email is never shown publicly\./g, "A beta invite is required. Accounts are for people aged 13 or older. Your email is private."],
  [/Create an account to post, confirm, reply and follow useful local updates\. Pindrizzle accounts are for people aged 13 or over, and your email is never shown publicly\./g, "Post, confirm, reply and follow local updates. Accounts are for people aged 13 or older. Your email is private."],
  [/Enter your email and we’ll send a secure password reset link\./g, "Enter your email to receive a password reset link."],
  [/Sign in with your email and password\./g, "Use your email and password."],
  [/Password reset email sent\. Open the newest email to choose a new password\./g, "Password reset email sent. Open the latest email to choose a new password."],
  [/Email or password is incorrect\. Use Forgot password\? if you need to reset it\./g, "Email or password is incorrect. Use Forgot password if needed."],
  [/Email delivery is temporarily rate-limited\. Normal password sign-in still works without sending an email\./g, "Email delivery is temporarily limited. Password sign-in still works."],
  [/Please wait…/g, "Working…"],
  [/Closed beta · public browsing remains open\./g, "Closed beta · browsing is public"],
  [/Public access · local participation is open\./g, "Public access · participation is open"],
];

function rewrite(value: string) {
  let next = value;
  for (const [pattern, replacement] of FACT_RULES) next = next.replace(pattern, replacement);
  for (const [pattern, replacement] of BRAND_RULES) next = next.replace(pattern, replacement);
  for (const [pattern, replacement] of PIN_RULES) next = next.replace(pattern, replacement);
  for (const [pattern, replacement] of POLISH_RULES) next = next.replace(pattern, replacement);
  return next;
}

function isUserContent(element: Element | null) {
  if (!element) return false;
  if (element.closest("script,style,noscript")) return true;
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
      ".ping-map-pin:not(.cluster)",
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
  const next = rewrite(current);
  if (next !== current) node.nodeValue = next;
}

function updateAttributes(element: Element) {
  const userContent = isUserContent(element);
  for (const attribute of ATTRIBUTES) {
    if (userContent && attribute !== "placeholder") continue;
    const current = element.getAttribute(attribute);
    if (!current) continue;
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
