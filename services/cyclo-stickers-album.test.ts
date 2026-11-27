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
import { getCycloStickersLibrary, getPublicCycloStickersAlbum } from "./cyclo-stickers-album";

beforeEach(() => { flags.ready = false; });
function createClient() {
  const snapshot = createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture());
  const state: ReturnType<typeof createCycloStickersPersistentStateFixture> & { weeklyLogin?: unknown } = createCycloStickersPersistentStateFixture();
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
  expect(album?.loginBoosterProgress).toBeNull();
  expect(rpc).toHaveBeenNthCalledWith(2, "get_current_cyclo_stickers_state", { p_edition: data.editionId });
});

it("loads the connection streak with the authenticated collection without an additional RPC", async () => {
  flags.ready = true;
  const { rpc, state, client } = createClient();
  state.weeklyLogin = { consecutiveDays: 3, totalBoostersAwarded: 1, boosterAwardedToday: true };
  const album = await getPublicCycloStickersAlbum(client);
  expect(album?.loginBoosterProgress).toEqual(state.weeklyLogin);
  expect(album?.state).not.toHaveProperty("weeklyLogin");
  expect(rpc).toHaveBeenCalledTimes(2);
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

it("selects an explicit published edition and never falls back to another catalogue", async () => {
  flags.ready = true;
  const { rpc, data, client } = createClient();
  const album = await getPublicCycloStickersAlbum(client, data.editionId);
  expect(album?.snapshot.edition).toBe(data.editionId);
  expect(rpc).toHaveBeenNthCalledWith(1, "get_cyclo_stickers_catalogue", { p_edition: data.editionId });
  const absent = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
  expect(await getPublicCycloStickersAlbum(absent as unknown as SupabaseClient, "unpublished-s5")).toBeNull();
  expect(absent.rpc).toHaveBeenCalledExactlyOnceWith("get_cyclo_stickers_catalogue", { p_edition: "unpublished-s5" });
  const substituted = createClient();
  await expect(getPublicCycloStickersAlbum(substituted.client, "different-edition")).rejects.toThrow("empreinte");
  expect(substituted.rpc).toHaveBeenCalledTimes(1);
});

it("keeps the official S4 provenance reconstruction guard even for a valid replacement seal", async () => {
  flags.ready = true;
  const forged = createClient();
  forged.data.snapshot.cards[0].name = "Identité remplacée";
  forged.data.sha256 = createHash("sha256").update(serializeCycloStickersSnapshot(forged.data.snapshot)).digest("hex");
  await expect(getPublicCycloStickersAlbum(forged.client)).rejects.toThrow("reviewed S4 source");
  expect(forged.rpc).toHaveBeenCalledTimes(1);
});

it("reads a future edition through its own server seal and inventory without a hardcoded S4/S5 pair", async () => {
  flags.ready = true;
  const card = createClient().data.snapshot.cards[0];
  const sourceId = "10000000-0000-4000-8000-000000000005";
  // Synthetic read-model fixture only; no new edition is installed or published.
  const snapshot = {
    edition: "cyclo-stickers-s6-s5-final-v1", sourceSeason: 5, collectionSeason: 6,
    sourceSeasonId: sourceId, ratingsFrozenFromSeason: 5, presentationSeason: 5,
    launchSeason: 6, gamesEdition: false, sourceSeasonStatus: "completed",
    capturedAt: "2026-12-04T00:05:00.000Z", cards: [card],
    provenance: { schemaVersion: 1, source: { season: { id: sourceId, gameYear: 5, status: "completed" } } },
  };
  const state = createCycloStickersPersistentStateFixture();
  Object.assign(state.edition, { id: snapshot.edition, sourceSeason: 5, collectionSeason: 6, sourceSeasonId: sourceId });
  const rpc = vi.fn().mockResolvedValueOnce({ data: { snapshot, editionId: snapshot.edition,
    sha256: createHash("sha256").update(serializeCycloStickersSnapshot(snapshot)).digest("hex") }, error: null })
    .mockResolvedValueOnce({ data: state, error: null });
  const album = await getPublicCycloStickersAlbum({ rpc } as unknown as SupabaseClient, snapshot.edition);
  expect(album?.snapshot.sourceSeason).toBe(5);
  expect(album?.state.edition.collectionSeason).toBe(6);
  expect(rpc).toHaveBeenNthCalledWith(2, "get_current_cyclo_stickers_state", { p_edition: snapshot.edition });
});

it("loads the shelf in a single summary RPC without any catalogue or stock download", async () => {
  flags.ready = true;
  const state = createCycloStickersPersistentStateFixture();
  const entry = { editionId: state.edition.id, sourceSeasonId: state.edition.sourceSeasonId,
    collectionSeasonId: state.edition.collectionSeasonId, sourceSeason: 4, collectionSeason: 5,
    totalCards: 72, pastedCount: 23, ownedCount: 40, completionPercent: 31.94 };
  const rpc = vi.fn().mockResolvedValue({ data: [entry], error: null });
  expect(await getCycloStickersLibrary({ rpc } as unknown as SupabaseClient)).toEqual([{ ...entry, completionPercent: 32, unopenedBoosterCount: 0 }]);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("get_current_cyclo_stickers_library");
});

it("does not query the shelf before release and rejects impossible completion or season pairs", async () => {
  const rpc = vi.fn();
  expect(await getCycloStickersLibrary({ rpc } as unknown as SupabaseClient)).toEqual([]);
  expect(rpc).not.toHaveBeenCalled();
  flags.ready = true;
  const state = createCycloStickersPersistentStateFixture();
  const entry = { editionId: state.edition.id, sourceSeasonId: state.edition.sourceSeasonId,
    collectionSeasonId: state.edition.collectionSeasonId, sourceSeason: 4, collectionSeason: 5,
    totalCards: 72, pastedCount: 73, ownedCount: 80, completionPercent: 100 };
  rpc.mockResolvedValue({ data: [entry], error: null });
  await expect(getCycloStickersLibrary({ rpc } as unknown as SupabaseClient)).rejects.toThrow("incohérente");
  rpc.mockResolvedValue({ data: [{ ...entry, pastedCount: 0, collectionSeason: 6 }], error: null });
  await expect(getCycloStickersLibrary({ rpc } as unknown as SupabaseClient)).rejects.toThrow("incohérente");
});

it("keeps unopened packs attached to their older collection while sorting by source season", async () => {
  flags.ready = true;
  const state = createCycloStickersPersistentStateFixture();
  const s4 = { editionId: state.edition.id, sourceSeasonId: state.edition.sourceSeasonId,
    collectionSeasonId: state.edition.collectionSeasonId, sourceSeason: 4, collectionSeason: 5,
    totalCards: 72, pastedCount: 23, ownedCount: 40, completionPercent: 31.94, unopenedBoosterCount: 3 };
  const s5 = { ...s4, editionId: "future-s5", sourceSeason: 5, collectionSeason: 6, unopenedBoosterCount: 0 };
  const rpc = vi.fn().mockResolvedValue({ data: [s4, s5], error: null });
  const entries = await getCycloStickersLibrary({ rpc } as unknown as SupabaseClient);
  expect(entries.map(entry => [entry.editionId, entry.unopenedBoosterCount])).toEqual([["future-s5", 0], [s4.editionId, 3]]);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("get_current_cyclo_stickers_library");
});

it.each([-1, 1.5])("rejects an impossible unopened pack count: %s", async unopenedBoosterCount => {
  flags.ready = true;
  const state = createCycloStickersPersistentStateFixture();
  const entry = { editionId: state.edition.id, sourceSeasonId: state.edition.sourceSeasonId,
    collectionSeasonId: state.edition.collectionSeasonId, sourceSeason: 4, collectionSeason: 5,
    totalCards: 72, pastedCount: 0, ownedCount: 0, completionPercent: 0, unopenedBoosterCount };
  const rpc = vi.fn().mockResolvedValue({ data: [entry], error: null });
  await expect(getCycloStickersLibrary({ rpc } as unknown as SupabaseClient)).rejects.toThrow();
});
