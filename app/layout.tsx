import type { Metadata, Viewport } from "next";
import NativeRuntimeBridge from "@/components/NativeRuntimeBridge";
import Phase21AccessibilityBridge from "@/components/Phase21AccessibilityBridge";
import Phase23PwaBridge from "@/components/Phase23PwaBridge";
import LiveDataRecoveryBridge from "@/components/LiveDataRecoveryBridge";
import SiteHeader from "@/components/SiteHeader";
import ProductRuntimeGate from "@/components/ProductRuntimeGate";
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
import "./pindrizzle-premium.css";
import "./pindrizzle-premium-my-pins.css";
import "./pindrizzle-premium-layout-fixes.css";
import "./pindrizzle-premium-auth.css";
import "./pindrizzle-premium-business.css";
import "./pindrizzle-design-system.css";
import "./pindrizzle-design-system-routes.css";
import "./pindrizzle-native-shell.css";
import "./pindrizzle-design-system-final.css";
import "./pindrizzle-signature-moments.css";
import "./pindrizzle-regression-fixes.css";
import "./pindrizzle-design-system-audit.css";
import "./pindrizzle-signature-moments-final.css";
import "./pindrizzle-wide-layout.css";
import "./pindrizzle-functional-fixes.css";
import "./site-shell.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pindrizzle.com"),
  title: "Pindrizzle — Useful local updates nearby",
  description: "Useful local pins, deals, Marketplace listings and real-time updates around you.",
  applicationName: "Pindrizzle",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pindrizzle",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Pindrizzle — Useful local updates nearby",
    description: "Useful local pins and real-time updates around you.",
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
  themeColor: "#082f4a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Phase21AccessibilityBridge />
        <Phase23PwaBridge />
        <LiveDataRecoveryBridge />
        <NativeRuntimeBridge />
        <SiteHeader />
        {children}
        <ProductRuntimeGate />
      </body>
    </html>
  );
}
