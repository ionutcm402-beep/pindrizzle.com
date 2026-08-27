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
import Phase19ProductAnalytics from "@/components/Phase19ProductAnalytics";
import Phase21AccessibilityBridge from "@/components/Phase21AccessibilityBridge";
import Phase22StorageChoice from "@/components/Phase22StorageChoice";
import Phase22LegalSettingsEntry from "@/components/Phase22LegalSettingsEntry";
import Phase23PwaBridge from "@/components/Phase23PwaBridge";
import Phase23InstallEntry from "@/components/Phase23InstallEntry";
import Phase24BetaBridge from "@/components/Phase24BetaBridge";
import Phase25LocationChoiceBridge from "@/components/Phase25LocationChoiceBridge";
import Phase25PrimaryNavigationBridge from "@/components/Phase25PrimaryNavigationBridge";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "./accessibility.css";
import "./legal.css";
import "./ping-design-system.css";
import "./ping-detail-system.css";
import "./ping-map-system.css";
import "./ping-search-system.css";
import "./ping-alerts-system.css";
import "./ping-you-system.css";
import "./ping-business-system.css";
import "./ping-onboarding-system.css";
import "./ping-utility-system.css";
import "./ping-internal-system.css";
import "./ping-polish-system.css";
import "./pindrizzle-brand.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pindrizzle.com"),
  title: "Pindrizzle — Drop in daily",
  description: "Drop in daily for useful local pins, deals, Marketplace listings and real-time updates around you.",
  applicationName: "Pindrizzle",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Pindrizzle — Drop in daily",
    description: "Useful local pins and real-time updates around you.",
    url: "https://pindrizzle.com",
    siteName: "Pindrizzle",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/pindrizzle-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/pindrizzle-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/pindrizzle-icon-192.png", type: "image/png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#edf7fb",
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
        <Phase19ProductAnalytics />
        <Phase22StorageChoice />
        <Phase22LegalSettingsEntry />
        <Phase23PwaBridge />
        <Phase23InstallEntry />
        <Phase24BetaBridge />
        <Phase25LocationChoiceBridge />
        <Phase25PrimaryNavigationBridge />
        <Phase21AccessibilityBridge />
      </body>
    </html>
  );
}
