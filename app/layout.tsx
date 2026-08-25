import type { Metadata, Viewport } from "next";
import Phase4MapRoute from "@/components/Phase4MapRoute";
import Phase4PingDetail from "@/components/Phase4PingDetail";
import Phase4RealtimeBridge from "@/components/Phase4RealtimeBridge";
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
        <Phase4PingDetail />
        <Phase4RealtimeBridge />
      </body>
    </html>
  );
}
