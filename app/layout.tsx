import type { Metadata, Viewport } from "next";
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
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ping — Know what's happening in your mile",
  description: "Real-time, useful local updates from people near you.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f7f7f2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
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
      </body>
    </html>
  );
}
