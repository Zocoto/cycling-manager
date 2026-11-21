import type { MetadataRoute } from "next";

import { getAbsoluteUrl } from "@/lib/app-config";
import { PUBLIC_LOCALIZED_ROUTES } from "@/lib/i18n/public-routes";
import type { PublishedGameNewsSitemapEntry } from "@/services/game-product-news-sitemap";

const frenchOnlyPaths = [
  "/nouveautes",
  "/inscription",
  "/conditions-utilisation",
  "/confidentialite",
  "/mentions-legales",
] as const;

export function buildPublicSitemap(articles: PublishedGameNewsSitemapEntry[]): MetadataRoute.Sitemap {
  const localizedPages: MetadataRoute.Sitemap = PUBLIC_LOCALIZED_ROUTES.flatMap(({ fr, en }) => {
    const languages = { fr: getAbsoluteUrl(fr), en: getAbsoluteUrl(en), "x-default": getAbsoluteUrl(fr) };
    return [fr, en].map((path) => ({
      url: getAbsoluteUrl(path),
      alternates: { languages },
    }));
  });

  return [
    ...localizedPages,
    ...frenchOnlyPaths.map((path) => ({ url: getAbsoluteUrl(path) })),
    ...articles.map((article) => ({
      url: getAbsoluteUrl(`/nouveautes/${article.id}`),
      lastModified: article.updatedAt,
    })),
  ];
}
