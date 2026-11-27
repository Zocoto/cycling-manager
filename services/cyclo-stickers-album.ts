import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CYCLO_STICKERS_RELEASE } from "@/lib/game/cyclo-stickers-release";
import { serializeCycloStickersSnapshot } from "@/lib/game/cyclo-stickers-final-snapshot";
import { assertPublishedCycloStickersSnapshot } from "@/lib/game/cyclo-stickers-published-snapshot";
import type { CycloStickersLibraryEntry } from "@/lib/game/cyclo-stickers-library";
import type { CycloStickersPersistentState } from "@/lib/game/cyclo-stickers-persistence";
import { normalizeWeeklyLoginBoosterProgress } from "@/lib/game/weekly-login-boosters";

const editionIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{2,100}$/);
const librarySchema = z.array(z.strictObject({
  editionId: editionIdSchema, sourceSeasonId: z.uuid(), collectionSeasonId: z.uuid(),
  sourceSeason: z.number().int().min(4), collectionSeason: z.number().int().min(5),
  totalCards: z.number().int().min(1).max(500), pastedCount: z.number().int().nonnegative(),
  ownedCount: z.number().int().nonnegative(), completionPercent: z.number().finite().min(0).max(100),
  unopenedBoosterCount: z.number().int().nonnegative().optional().default(0),
})).max(500);

/** Small, authenticated summaries only: the shelf never downloads all catalogues. */
export async function getCycloStickersLibrary(supabase: SupabaseClient): Promise<CycloStickersLibraryEntry[]> {
  if (!CYCLO_STICKERS_RELEASE.publicReady) return [];
  const { data, error } = await supabase.rpc("get_current_cyclo_stickers_library");
  if (error) throw new Error("Impossible de charger ta bibliothèque de Cyclo-Stickers.");
  const entries = librarySchema.parse(data ?? []);
  if (new Set(entries.map(entry => entry.editionId)).size !== entries.length
    || entries.some(entry => entry.collectionSeason !== entry.sourceSeason + 1 || entry.pastedCount > entry.totalCards)) {
    throw new Error("La bibliothèque contient une collection incohérente.");
  }
  return entries.map(entry => ({ ...entry, completionPercent: Math.round(entry.pastedCount / entry.totalCards * 100) }))
    .sort((left, right) => right.sourceSeason - left.sourceSeason || left.editionId.localeCompare(right.editionId));
}

/** An edition is readable only after the DB's publication and source-season gates.
 * Explicit selection never silently falls back to a different collection. */
export async function getPublicCycloStickersAlbum(supabase: SupabaseClient, selectedEditionId?: string) {
  if (!CYCLO_STICKERS_RELEASE.publicReady) return null;
  if (selectedEditionId !== undefined) editionIdSchema.parse(selectedEditionId);
  const catalogue = selectedEditionId === undefined
    ? await supabase.rpc("get_current_cyclo_stickers_catalogue")
    : await supabase.rpc("get_cyclo_stickers_catalogue", { p_edition: selectedEditionId });
  if (catalogue.error) throw new Error("Impossible de charger le catalogue de Cyclo-Stickers.");
  if (!catalogue.data) return null;
  const { snapshot, sha256, editionId } = catalogue.data as { snapshot: unknown; sha256: unknown; editionId: unknown };
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)
    || typeof editionId !== "string" || (selectedEditionId !== undefined && editionId !== selectedEditionId)
    || typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)
    || createHash("sha256").update(serializeCycloStickersSnapshot(snapshot)).digest("hex") !== sha256) throw new Error("Le catalogue scellé ne correspond pas à son empreinte.");
  assertPublishedCycloStickersSnapshot(snapshot);
  if (snapshot.edition !== editionId) throw new Error("Le catalogue scellé ne correspond pas à son édition.");
  const inventory = await supabase.rpc("get_current_cyclo_stickers_state", { p_edition: snapshot.edition });
  if (inventory.error || !inventory.data) throw new Error("Impossible de charger ta collection.");
  const { weeklyLogin, ...state } = inventory.data as CycloStickersPersistentState & { weeklyLogin?: unknown };
  if (!state.edition?.enabled || state.edition.id !== snapshot.edition || state.edition.sourceSeasonId !== snapshot.sourceSeasonId
    || state.edition.sourceSeason !== snapshot.sourceSeason || state.edition.collectionSeason !== snapshot.collectionSeason
    || typeof state.directorId !== "string" || !state.directorId || state.directorId !== state.owner?.directorId) throw new Error("La collection ne correspond pas à cette édition.");
  return { snapshot, state, loginBoosterProgress: normalizeWeeklyLoginBoosterProgress(weeklyLogin) };
}
