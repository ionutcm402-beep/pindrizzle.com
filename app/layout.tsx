import type { Metadata, Viewport } from "next";
import Phase4MapEnhancer from "@/components/Phase4MapEnhancer";
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
        <Phase4MapEnhancer />
      </body>
    </html>
  );
}
