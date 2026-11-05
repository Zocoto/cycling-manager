import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CYCLO_STICKERS_RELEASE, assertCycloStickersFinalSnapshot } from "@/lib/game/cyclo-stickers-release";
import { serializeCycloStickersSnapshot } from "@/lib/game/cyclo-stickers-final-snapshot";
import type { CycloStickersPersistentState } from "@/lib/game/cyclo-stickers-persistence";

/** The disabled launch flag costs no RPC. The catalogue RPC also checks its own server release gates. */
export async function getPublicCycloStickersAlbum(supabase: SupabaseClient) {
  if (!CYCLO_STICKERS_RELEASE.publicReady) return null;
  const catalogue = await supabase.rpc("get_current_cyclo_stickers_catalogue");
  if (catalogue.error) throw new Error("Impossible de charger le catalogue de Cyclo-Stickers.");
  if (!catalogue.data) return null;
  const { snapshot, sha256, editionId } = catalogue.data as { snapshot: unknown; sha256: unknown; editionId: unknown };
  assertCycloStickersFinalSnapshot(snapshot, "completed");
  if (snapshot.edition !== editionId || typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)
    || createHash("sha256").update(serializeCycloStickersSnapshot(snapshot)).digest("hex") !== sha256) throw new Error("Le catalogue scellé ne correspond pas à son empreinte.");
  const inventory = await supabase.rpc("get_current_cyclo_stickers_state", { p_edition: snapshot.edition });
  if (inventory.error || !inventory.data) throw new Error("Impossible de charger ta collection.");
  const state = inventory.data as CycloStickersPersistentState;
  if (!state.edition.enabled || state.edition.id !== snapshot.edition || state.edition.sourceSeasonId !== snapshot.sourceSeasonId
    || state.edition.sourceSeason !== 4 || state.edition.collectionSeason !== 5 || state.directorId !== state.owner.directorId) throw new Error("La collection ne correspond pas à cette édition.");
  return { snapshot, state };
}
