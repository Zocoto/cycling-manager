import type { MetadataRoute } from "next";

import { appConfig, getAbsoluteUrl } from "@/lib/app-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/jeu/",
        "/connexion",
        "/design-system",
        "/inscription/confirmee",
        "/inscription/confirmer",
        "/mot-de-passe-oublie",
        "/reinitialiser-mot-de-passe",
      ],
    },
    sitemap: getAbsoluteUrl("/sitemap.xml"),
    host: appConfig.siteUrl,
  };
}
