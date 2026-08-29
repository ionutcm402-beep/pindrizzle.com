"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PasswordAuthOverlay from "@/components/PasswordAuthOverlay";
import Phase5PingDetail from "@/components/Phase5PingDetail";
import PrivacySafetyCenter from "@/components/PrivacySafetyCenter";
import Phase6NotificationBadge from "@/components/Phase6NotificationBadge";
import Phase16PushSafetyBridge from "@/components/Phase16PushSafetyBridge";
import Phase19ProductAnalytics from "@/components/Phase19ProductAnalytics";
import Phase22StorageChoice from "@/components/Phase22StorageChoice";
import Phase24BetaBridge from "@/components/Phase24BetaBridge";
import PindrizzleCopyBridge from "@/components/PindrizzleCopyBridge";
import LegacyComposeLinkBridge from "@/components/LegacyComposeLinkBridge";

const FirstRunOnboarding = dynamic(() => import("@/components/FirstRunOnboarding"));
const Phase7VisibilityBridge = dynamic(() => import("@/components/Phase7VisibilityBridge"));
const Phase7ContributorContext = dynamic(() => import("@/components/Phase7ContributorContext"));
const Phase8FollowBridge = dynamic(() => import("@/components/Phase8FollowBridge"));
const Phase8SinceLastVisit = dynamic(() => import("@/components/Phase8SinceLastVisit"));
const Phase8NearbyPulse = dynamic(() => import("@/components/Phase8NearbyPulse"));
const Phase9PromotedLocal = dynamic(() => import("@/components/Phase9PromotedLocal"));
const Phase14SearchEntry = dynamic(() => import("@/components/Phase14SearchEntry"));
const Phase15PlaceIntelligence = dynamic(() => import("@/components/Phase15PlaceIntelligence"));
const Phase22LegalSettingsEntry = dynamic(() => import("@/components/Phase22LegalSettingsEntry"));
const Phase25LocationChoiceBridge = dynamic(() => import("@/components/Phase25LocationChoiceBridge"));
const CommercialSafetyBridge = dynamic(() => import("@/components/CommercialSafetyBridge"));
const InternalWebsiteBrandBridge = dynamic(() => import("@/components/InternalWebsiteBrandBridge"));

const COMMERCIAL_POLISH_PATHS = new Set(["/promote", "/business", "/search"]);
const VISIBILITY_SYNC_PATHS = new Set(["/", "/map", "/feed", "/search", "/following"]);
const COPY_BRIDGE_DEFER_PATHS = new Set([
  "/",
  "/map",
  "/feed",
  "/chat",
  "/search",
  "/my-pings",
  "/alerts",
  "/you",
  "/following",
  "/notifications",
]);

export default function ProductClientRuntime() {
  const pathname = usePathname();
  const [detailEnhancementsActive, setDetailEnhancementsActive] = useState(false);
  const isHome = pathname === "/";
  const isFeed = pathname === "/feed";
  const isYou = pathname === "/you";
  const needsVisibilitySync = VISIBILITY_SYNC_PATHS.has(pathname);
  const needsCommercialPolish = COMMERCIAL_POLISH_PATHS.has(pathname);
  const needsInternalBranding = pathname === "/ops" || pathname.startsWith("/moderation");
  const needsCopyBridge = detailEnhancementsActive || !COPY_BRIDGE_DEFER_PATHS.has(pathname);

  useEffect(() => {
    const activateFromHash = () => {
      if (window.location.hash.startsWith("#ping=")) setDetailEnhancementsActive(true);
    };
    const activateFromDetail = () => setDetailEnhancementsActive(true);

    activateFromHash();
    window.addEventListener("ping:open-detail", activateFromDetail);
    window.addEventListener("hashchange", activateFromHash);
    return () => {
      window.removeEventListener("ping:open-detail", activateFromDetail);
      window.removeEventListener("hashchange", activateFromHash);
    };
  }, []);

  return (
    <>
      {isHome && <FirstRunOnboarding />}
      <Phase5PingDetail />
      <PrivacySafetyCenter />
      <PasswordAuthOverlay />
      <Phase6NotificationBadge />
      <LegacyComposeLinkBridge />
      {needsVisibilitySync && <Phase7VisibilityBridge />}
      {detailEnhancementsActive && <Phase7ContributorContext />}
      {isFeed && <Phase8SinceLastVisit />}
      {isFeed && <Phase8NearbyPulse />}
      {detailEnhancementsActive && <Phase8FollowBridge />}
      {isFeed && <Phase9PromotedLocal />}
      {isFeed && <Phase14SearchEntry />}
      {isFeed && <Phase15PlaceIntelligence />}
      <Phase16PushSafetyBridge />
      <Phase19ProductAnalytics />
      <Phase22StorageChoice />
      {isYou && <Phase22LegalSettingsEntry />}
      <Phase24BetaBridge />
      {(isHome || isFeed) && <Phase25LocationChoiceBridge />}
      {needsCommercialPolish && <CommercialSafetyBridge />}
      {needsCopyBridge && <PindrizzleCopyBridge />}
      {needsInternalBranding && <InternalWebsiteBrandBridge />}
    </>
  );
}
