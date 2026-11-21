import "server-only";

import { z } from "zod";
import { GAME_NEWS_CACHE_TAG } from "@/lib/game/game-product-news";
import { compactDataCache } from "@/lib/performance/compact-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 250;
const MAX_PAGES = 8;
const TOTAL_TIMEOUT_MS = 6_000;
const sitemapRowSchema = z.object({
  id: z.string().uuid(),
  published_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type PublishedGameNewsSitemapEntry = {
  id: string;
  publishedAt: string;
  updatedAt: string;
};

// This dedicated projection never loads article documents, editorial drafts or
// user data. Keyset pagination also includes publications beyond the news feed.
export const getPublishedGameNewsSitemapEntries = compactDataCache(async (): Promise<PublishedGameNewsSitemapEntry[]> => {
  const client = createSupabaseAdminClient();
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const entries: PublishedGameNewsSitemapEntry[] = [];
  let afterId: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Le chargement du sitemap des actualités a expiré.");
    const result = await client.rpc("get_published_game_news_sitemap", {
      p_after_id: afterId,
      p_limit: PAGE_SIZE,
    }).abortSignal(AbortSignal.timeout(Math.min(2_000, remaining)));
    if (result.error) throw new Error("Le sitemap des actualités n’a pas pu être chargé.");
    const rows = z.array(sitemapRowSchema).max(PAGE_SIZE).parse(result.data ?? []);
    for (const row of rows) {
      if (afterId !== null && row.id.toLowerCase() <= afterId) {
        throw new Error("La pagination du sitemap des actualités est incohérente.");
      }
      afterId = row.id.toLowerCase();
      entries.push({ id: afterId, publishedAt: row.published_at, updatedAt: row.updated_at });
    }
    if (rows.length < PAGE_SIZE) return entries;
  }

  // Split the sitemap before increasing this bound; never silently publish an
  // incomplete article inventory or run an unbounded database scan.
  throw new Error("Le sitemap des actualités doit être réparti en plusieurs fichiers.");
}, ["published-game-news-sitemap-v1"], { tags: [GAME_NEWS_CACHE_TAG], revalidate: 300 });
