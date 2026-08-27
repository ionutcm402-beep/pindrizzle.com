import type { MetadataRoute } from "next";

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
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
