"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import PasswordAuthOverlay from "@/components/PasswordAuthOverlay";
import Phase5PingDetail from "@/components/Phase5PingDetail";
import PrivacySafetyCenter from "@/components/PrivacySafetyCenter";
import Phase6NotificationBadge from "@/components/Phase6NotificationBadge";
import Phase7VisibilityBridge from "@/components/Phase7VisibilityBridge";
import Phase7ContributorContext from "@/components/Phase7ContributorContext";
import Phase8FollowBridge from "@/components/Phase8FollowBridge";
import Phase16PushSafetyBridge from "@/components/Phase16PushSafetyBridge";
import Phase19ProductAnalytics from "@/components/Phase19ProductAnalytics";
import Phase21AccessibilityBridge from "@/components/Phase21AccessibilityBridge";
import Phase22StorageChoice from "@/components/Phase22StorageChoice";
import Phase24BetaBridge from "@/components/Phase24BetaBridge";
import Phase25LocationChoiceBridge from "@/components/Phase25LocationChoiceBridge";
import PindrizzleCopyBridge from "@/components/PindrizzleCopyBridge";

const FirstRunOnboarding = dynamic(() => import("@/components/FirstRunOnboarding"));
const Phase8SinceLastVisit = dynamic(() => import("@/components/Phase8SinceLastVisit"));
const Phase8NearbyPulse = dynamic(() => import("@/components/Phase8NearbyPulse"));
const Phase9PromotedLocal = dynamic(() => import("@/components/Phase9PromotedLocal"));
const Phase14SearchEntry = dynamic(() => import("@/components/Phase14SearchEntry"));
const Phase15PlaceIntelligence = dynamic(() => import("@/components/Phase15PlaceIntelligence"));
const Phase22LegalSettingsEntry = dynamic(() => import("@/components/Phase22LegalSettingsEntry"));
const CommercialSafetyBridge = dynamic(() => import("@/components/CommercialSafetyBridge"));
const InternalWebsiteBrandBridge = dynamic(() => import("@/components/InternalWebsiteBrandBridge"));

const COMMERCIAL_POLISH_PATHS = new Set(["/promote", "/business", "/search"]);

export default function ProductClientRuntime() {
  const pathname = usePathname();
  const isFeed = pathname === "/";
  const isYou = pathname === "/you";
  const needsCommercialPolish = COMMERCIAL_POLISH_PATHS.has(pathname);
  const needsInternalBranding = pathname === "/ops" || pathname.startsWith("/moderation");

  return (
    <>
      {isFeed && <FirstRunOnboarding />}
      <Phase5PingDetail />
      <PrivacySafetyCenter />
      <PasswordAuthOverlay />
      <Phase6NotificationBadge />
      <Phase7VisibilityBridge />
      <Phase7ContributorContext />
      {isFeed && <Phase8SinceLastVisit />}
      {isFeed && <Phase8NearbyPulse />}
      <Phase8FollowBridge />
      {isFeed && <Phase9PromotedLocal />}
      {isFeed && <Phase14SearchEntry />}
      {isFeed && <Phase15PlaceIntelligence />}
      <Phase16PushSafetyBridge />
      <Phase19ProductAnalytics />
      <Phase22StorageChoice />
      {isYou && <Phase22LegalSettingsEntry />}
      <Phase24BetaBridge />
      <Phase25LocationChoiceBridge />
      <Phase21AccessibilityBridge />
      {needsCommercialPolish && <CommercialSafetyBridge />}
      <PindrizzleCopyBridge />
      {needsInternalBranding && <InternalWebsiteBrandBridge />}
    </>
  );
}
