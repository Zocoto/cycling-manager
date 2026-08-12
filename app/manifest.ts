import type { MetadataRoute } from "next";

import { appConfig } from "@/lib/app-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${appConfig.name} – Jeu de management cycliste`,
    short_name: appConfig.name,
    description: appConfig.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#071A17",
    theme_color: "#071A17",
    lang: "fr",
    categories: ["games", "sports"],
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
