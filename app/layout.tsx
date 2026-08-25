import type { Metadata, Viewport } from "next";
import AuthRecovery from "@/components/AuthRecovery";
import PasswordAuthOverlay from "@/components/PasswordAuthOverlay";
import Phase4MapRoute from "@/components/Phase4MapRoute";
import Phase4RealtimeBridge from "@/components/Phase4RealtimeBridge";
import Phase5PingDetail from "@/components/Phase5PingDetail";
import Phase5CommunityBridge from "@/components/Phase5CommunityBridge";
import YouNavHardLink from "@/components/YouNavHardLink";
import AlertsNavHardLink from "@/components/AlertsNavHardLink";
import Phase6NotificationBadge from "@/components/Phase6NotificationBadge";
import Phase7VisibilityBridge from "@/components/Phase7VisibilityBridge";
import Phase7ContributorContext from "@/components/Phase7ContributorContext";
import Phase8SinceLastVisit from "@/components/Phase8SinceLastVisit";
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
        <Phase4MapRoute />
        <Phase5PingDetail />
        <Phase4RealtimeBridge />
        <Phase5CommunityBridge />
        <PasswordAuthOverlay />
        <AuthRecovery />
        <YouNavHardLink />
        <AlertsNavHardLink />
        <Phase6NotificationBadge />
        <Phase7VisibilityBridge />
        <Phase7ContributorContext />
        <Phase8SinceLastVisit />
      </body>
    </html>
  );
}
