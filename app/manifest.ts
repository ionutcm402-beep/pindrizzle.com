import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pindrizzle — Drop in daily",
    short_name: "Pindrizzle",
    description: "Useful local pins, deals, Marketplace listings and real-time updates around you.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#edf7fb",
    theme_color: "#edf7fb",
    categories: ["social", "utilities", "lifestyle"],
    icons: [
      { src: "/pindrizzle-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pindrizzle-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pindrizzle-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
