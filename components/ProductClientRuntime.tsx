"use client";

import FirstRunOnboarding from "@/components/FirstRunOnboarding";
import PasswordAuthOverlay from "@/components/PasswordAuthOverlay";
import Phase5PingDetail from "@/components/Phase5PingDetail";
import PrivacySafetyCenter from "@/components/PrivacySafetyCenter";
import Phase6NotificationBadge from "@/components/Phase6NotificationBadge";
import Phase7VisibilityBridge from "@/components/Phase7VisibilityBridge";
import Phase7ContributorContext from "@/components/Phase7ContributorContext";
import Phase8SinceLastVisit from "@/components/Phase8SinceLastVisit";
import Phase8NearbyPulse from "@/components/Phase8NearbyPulse";
import Phase8FollowBridge from "@/components/Phase8FollowBridge";
import Phase9PromotedLocal from "@/components/Phase9PromotedLocal";
import Phase14SearchEntry from "@/components/Phase14SearchEntry";
import Phase15PlaceIntelligence from "@/components/Phase15PlaceIntelligence";
import Phase16PushSafetyBridge from "@/components/Phase16PushSafetyBridge";
import Phase19ProductAnalytics from "@/components/Phase19ProductAnalytics";
import Phase21AccessibilityBridge from "@/components/Phase21AccessibilityBridge";
import Phase22StorageChoice from "@/components/Phase22StorageChoice";
import Phase22LegalSettingsEntry from "@/components/Phase22LegalSettingsEntry";
import Phase24BetaBridge from "@/components/Phase24BetaBridge";
import Phase25LocationChoiceBridge from "@/components/Phase25LocationChoiceBridge";
import CommercialSafetyBridge from "@/components/CommercialSafetyBridge";
import PindrizzleCopyBridge from "@/components/PindrizzleCopyBridge";
import InternalWebsiteBrandBridge from "@/components/InternalWebsiteBrandBridge";

export default function ProductClientRuntime() {
  return (
    <>
      <FirstRunOnboarding />
      <Phase5PingDetail />
      <PrivacySafetyCenter />
      <PasswordAuthOverlay />
      <Phase6NotificationBadge />
      <Phase7VisibilityBridge />
      <Phase7ContributorContext />
      <Phase8SinceLastVisit />
      <Phase8NearbyPulse />
      <Phase8FollowBridge />
      <Phase9PromotedLocal />
      <Phase14SearchEntry />
      <Phase15PlaceIntelligence />
      <Phase16PushSafetyBridge />
      <Phase19ProductAnalytics />
      <Phase22StorageChoice />
      <Phase22LegalSettingsEntry />
      <Phase24BetaBridge />
      <Phase25LocationChoiceBridge />
      <Phase21AccessibilityBridge />
      <CommercialSafetyBridge />
      <PindrizzleCopyBridge />
      <InternalWebsiteBrandBridge />
    </>
  );
}
