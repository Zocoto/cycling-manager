import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
import { createCycloStickersFinalSnapshot, serializeCycloStickersSnapshot } from "@/lib/game/cyclo-stickers-final-snapshot";
import { createFinalCycloStickersSourceFixture } from "@/lib/game/cyclo-stickers-final-snapshot.fixture";
import { createCycloStickersPersistentStateFixture } from "@/lib/game/cyclo-stickers-persistence.fixture";

const flags = vi.hoisted(() => ({ ready: false }));
vi.mock("@/lib/game/cyclo-stickers-release", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/game/cyclo-stickers-release")>();
  return { ...original, CYCLO_STICKERS_RELEASE: { ...original.CYCLO_STICKERS_RELEASE, get publicReady() { return flags.ready; } } };
});
import { getPublicCycloStickersAlbum } from "./cyclo-stickers-album";

beforeEach(() => { flags.ready = false; });
function createClient() {
  const snapshot = createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture());
  const state = createCycloStickersPersistentStateFixture();
  const data = { snapshot, editionId: snapshot.edition, sha256: createHash("sha256").update(serializeCycloStickersSnapshot(snapshot)).digest("hex") };
  const rpc = vi.fn().mockResolvedValueOnce({ data, error: null }).mockResolvedValueOnce({ data: state, error: null });
  return { rpc, data, state, client: { rpc } as unknown as SupabaseClient };
}

it("does no public catalogue or stock RPC while release approval is disabled", async () => {
  const { rpc, client } = createClient();
  expect(await getPublicCycloStickersAlbum(client)).toBeNull();
  expect(rpc).not.toHaveBeenCalled();
});

it("verifies the immutable seal after JSONB key reordering before loading the authenticated state", async () => {
  flags.ready = true;
  const { rpc, data, client } = createClient();
  data.snapshot = Object.fromEntries(Object.entries(data.snapshot).reverse()) as typeof data.snapshot;
  const album = await getPublicCycloStickersAlbum(client);
  expect(album?.snapshot.cards).toHaveLength(72);
  expect(rpc).toHaveBeenNthCalledWith(2, "get_current_cyclo_stickers_state", { p_edition: data.editionId });
});

it("refuses missing editions, forged seals and inventories from another source or owner", async () => {
  flags.ready = true;
  const absent = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
  expect(await getPublicCycloStickersAlbum(absent as unknown as SupabaseClient)).toBeNull();
  const forged = createClient();
  forged.data.sha256 = "f".repeat(64);
  await expect(getPublicCycloStickersAlbum(forged.client)).rejects.toThrow("empreinte");
  expect(forged.rpc).toHaveBeenCalledTimes(1);
  const wrongSource = createClient();
  wrongSource.state.edition.sourceSeasonId = wrongSource.state.edition.collectionSeasonId;
  await expect(getPublicCycloStickersAlbum(wrongSource.client)).rejects.toThrow("édition");
  const wrongOwner = createClient();
  wrongOwner.state.owner.directorId = "someone-else";
  await expect(getPublicCycloStickersAlbum(wrongOwner.client)).rejects.toThrow("édition");
});
