import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  GAME_NEWS_CACHE_TAG, gameNewsDocumentSchema, gameNewsDraftDocumentSchema, type GameNewsEditorArticle,
  type PublishedGameNews, type GameStaffMember,
} from "@/lib/game/game-product-news";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type PublishedRow = { id: string; document: unknown; published_at: string; updated_at: string; revision: number };
type EditorRow = { id: string; draft: unknown; published: unknown | null; published_at: string | null; updated_at: string; revision: number; has_unpublished_changes: boolean };
export function toGameNewsEditorArticle(row: EditorRow): GameNewsEditorArticle {
  return { id: row.id, draft: gameNewsDraftDocumentSchema.parse(row.draft),
    published: row.published === null ? null : gameNewsDocumentSchema.parse(row.published),
    publishedAt: row.published_at, updatedAt: row.updated_at, revision: row.revision,
    hasUnpublishedChanges: row.has_unpublished_changes };
}
function toPublished(row: PublishedRow): PublishedGameNews {
  return { id: row.id, document: gameNewsDocumentSchema.parse(row.document), publishedAt: row.published_at, updatedAt: row.updated_at, revision: row.revision };
}

// No cookies, identity or draft data enter this shared cache.
export const getPublishedGameNews = unstable_cache(async (): Promise<PublishedGameNews[]> => {
  const result = await createSupabaseAdminClient().rpc("get_published_game_news", { p_limit: 50, p_id: null })
    .abortSignal(AbortSignal.timeout(2000));
  if (result.error) throw new Error("Les actualités du jeu n’ont pas pu être chargées.");
  return ((result.data ?? []) as PublishedRow[]).map(toPublished);
}, ["published-game-product-news-v1"], { tags: [GAME_NEWS_CACHE_TAG], revalidate: 60 });

export const getPublishedGameNewsById = unstable_cache(async (id: string): Promise<PublishedGameNews | null> => {
  const result = await createSupabaseAdminClient().rpc("get_published_game_news", { p_limit: 1, p_id: id })
    .abortSignal(AbortSignal.timeout(2000));
  if (result.error) throw new Error("Cette actualité n’a pas pu être chargée.");
  const row = (result.data as PublishedRow[] | null)?.[0];
  return row ? toPublished(row) : null;
}, ["published-game-product-news-detail-v1"], { tags: [GAME_NEWS_CACHE_TAG], revalidate: 60 });

export async function getGameNewsEditorArticles(supabase: Client): Promise<GameNewsEditorArticle[]> {
  const result = await supabase.rpc("get_game_news_editor", { p_id: null }).abortSignal(AbortSignal.timeout(3000));
  if (result.error) throw new Error("Les brouillons n’ont pas pu être chargés.");
  return ((result.data ?? []) as EditorRow[]).map(toGameNewsEditorArticle);
}
export async function getGameStaffMembers(supabase: Client): Promise<GameStaffMember[]> {
  const result = await supabase.rpc("get_game_staff_members").abortSignal(AbortSignal.timeout(3000));
  if (result.error) throw new Error("Les membres de l’équipe du jeu n’ont pas pu être chargés.");
  return ((result.data ?? []) as { user_id: string; sporting_director_id: string; display_name: string; role: "owner" | "game_staff" }[])
    .map((row) => ({ userId: row.user_id, directorId: row.sporting_director_id, displayName: row.display_name, role: row.role }));
}
