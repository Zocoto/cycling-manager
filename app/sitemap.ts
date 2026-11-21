import type { MetadataRoute } from "next";

import { buildPublicSitemap } from "@/lib/seo/sitemap";
import { getPublishedGameNewsSitemapEntries } from "@/services/game-product-news-sitemap";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getPublishedGameNewsSitemapEntries().catch((error: unknown) => {
    console.error("Les pages publiques restent dans le sitemap ; les actualités sont temporairement indisponibles.", error);
    return [];
  });
  return buildPublicSitemap(articles);
}
