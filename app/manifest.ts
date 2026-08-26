import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Ping — Local updates around you",
    short_name: "Ping",
    description: "Useful, real-time local updates from people nearby.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f2",
    theme_color: "#f7f7f2",
    categories: ["social", "utilities"],
    icons: [
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
