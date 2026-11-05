import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import stage from "@/data/collector-album-s4-identity-stage.json";
import { createFinalCycloStickersSourceFixture } from "@/lib/game/cyclo-stickers-final-snapshot.fixture";
import { serializeCycloStickersSnapshot } from "@/lib/game/cyclo-stickers-final-snapshot";
import { isCycloStickersPublicationWindow } from "@/lib/game/cyclo-stickers-publication-window";
const mocks = vi.hoisted(() => ({ assemble: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/game/cyclo-stickers-source", () => ({ assembleCompletedCycloStickersS4Source: mocks.assemble }));
import { publishDueCycloStickersAlbum } from "./cyclo-stickers-publication";
const launch = new Date("2026-11-05T23:05:00Z");
const lease = { jobId: "job", leaseToken: "lease", editionId: "cyclo-stickers-s5-s4-final-v1", sourceSeasonId: stage.sourceSeasonId, identityStageSha256: stage.sha256 };
let response: (name: string, args: Record<string, unknown>) => { data: unknown; error: { message: string } | null };
const rpc = vi.fn((name: string, args: Record<string, unknown>) => ({ abortSignal: async () => response(name, args) }));
const admin = { rpc } as unknown as SupabaseClient;
beforeEach(() => {
  vi.clearAllMocks();
  const fixture = createFinalCycloStickersSourceFixture();
  mocks.assemble.mockReturnValue(JSON.parse(JSON.stringify(fixture).replaceAll(fixture.season.id, stage.sourceSeasonId)));
  response = (name, args) => ({ error: null, data: name === "claim_cyclo_stickers_publication" ? lease
    : name === "get_cyclo_stickers_final_source_facts" ? { context: "server-facts" }
      : name === "publish_cyclo_stickers_publication" ? { published: true, sha256: args.p_sha256 } : { status: "failed" } });
});
it("uses Paris midnight and a finite recovery window without any RPC outside it", async () => {
  expect(isCycloStickersPublicationWindow(new Date("2026-11-05T22:59:59Z"))).toBe(false);
  expect(isCycloStickersPublicationWindow(new Date("2026-11-05T23:00:00Z"))).toBe(true);
  expect(isCycloStickersPublicationWindow(new Date("2026-12-03T22:59:59Z"))).toBe(true);
  expect(isCycloStickersPublicationWindow(new Date("2026-12-03T23:00:00Z"))).toBe(false);
  expect(await publishDueCycloStickersAlbum(admin, new Date("2026-11-05T22:00:00Z"))).toEqual({ status: "outside_window" });
  expect(rpc).not.toHaveBeenCalled();
});
it("does no assembly or source query when the rollover is not ready or another worker owns it", async () => {
  response = () => ({ data: null, error: null });
  expect(await publishDueCycloStickersAlbum(admin, launch)).toEqual({ status: "not_due" });
  expect(rpc).toHaveBeenCalledTimes(1); expect(mocks.assemble).not.toHaveBeenCalled();
});
it("builds and hashes the strictly completed S4 series before atomic publication", async () => {
  const result = await publishDueCycloStickersAlbum(admin, launch);
  expect(result.status).toBe("published");
  expect(mocks.assemble).toHaveBeenCalledWith(stage, { context: "server-facts" });
  const args = rpc.mock.calls.find(([name]) => name === "publish_cyclo_stickers_publication")![1];
  expect(args.p_snapshot).toMatchObject({ sourceSeason: 4, ratingsFrozenFromSeason: 4, sourceSeasonStatus: "completed", collectionSeason: 5 });
  expect(args.p_sha256).toBe(createHash("sha256").update(serializeCycloStickersSnapshot(args.p_snapshot)).digest("hex"));
  expect(rpc).not.toHaveBeenCalledWith("fail_cyclo_stickers_publication", expect.anything());
});
it("fences a mismatched identity capture before loading sporting facts", async () => {
  response = name => ({ data: name === "claim_cyclo_stickers_publication" ? { ...lease, identityStageSha256: "f".repeat(64) } : {}, error: null });
  await expect(publishDueCycloStickersAlbum(admin, launch)).rejects.toThrow("identity evidence mismatch");
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(["claim_cyclo_stickers_publication", "fail_cyclo_stickers_publication"]);
});
it("rejects active or mixed-S3 sporting facts and records a retry without publishing", async () => {
  const source = createFinalCycloStickersSourceFixture(); source.riders[0].ratingsSeasonId = source.riders[0].id;
  mocks.assemble.mockReturnValue(source);
  await expect(publishDueCycloStickersAlbum(admin, launch)).rejects.toThrow();
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(["claim_cyclo_stickers_publication", "get_cyclo_stickers_final_source_facts", "fail_cyclo_stickers_publication"]);
});
it("does not report publication when the atomic installer fails", async () => {
  response = (name, args) => ({ data: name === "claim_cyclo_stickers_publication" ? lease : args,
    error: name === "publish_cyclo_stickers_publication" ? { message: "temporary installer failure" } : null });
  await expect(publishDueCycloStickersAlbum(admin, launch)).rejects.toThrow("temporary installer failure");
  expect(rpc.mock.calls.at(-1)?.[0]).toBe("fail_cyclo_stickers_publication");
});
