import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), publish: vi.fn(), authorize: vi.fn(), cleanup: vi.fn(), events: [] as string[] }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/security/cron-authorization", () => ({ isAuthorizedCronRequest: mocks.authorize }));
vi.mock("@/services/chat-image-maintenance", () => ({ pruneChatImages: mocks.cleanup }));
vi.mock("@/services/cyclo-stickers-publication", () => ({ publishDueCycloStickersAlbum: mocks.publish }));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks(); mocks.events.length = 0;
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-05T23:05:00Z"));
  vi.spyOn(console, "info").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.authorize.mockReturnValue(true); mocks.cleanup.mockResolvedValue(undefined);
  mocks.rpc.mockImplementation(async name => { mocks.events.push(name); return { data: null, error: null }; });
  mocks.publish.mockImplementation(async () => { mocks.events.push("publish_album"); return { status: "published" }; });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it("denies an unauthorized request before any maintenance or publication", async () => {
  mocks.authorize.mockReturnValue(false);
  expect((await GET(new Request("https://example.test/api/cron/game-maintenance"))).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled();
});
it("publishes only after the rollover call finishes and continues all existing maintenance", async () => {
  expect((await GET(new Request("https://example.test/api/cron/game-maintenance"))).status).toBe(200);
  expect(mocks.events.indexOf("publish_album")).toBe(mocks.events.indexOf("settle_due_season_rollovers") + 1);
  expect(mocks.events.at(-1)).toBe("purge_expired_director_messages"); expect(mocks.cleanup).toHaveBeenCalledOnce();
});
it("isolates publication failure from the following gameplay maintenance", async () => {
  mocks.publish.mockRejectedValue(new Error("Temporary album error"));
  const result = await GET(new Request("https://example.test/api/cron/game-maintenance"));
  expect(result.status).toBe(500);
  expect(mocks.events.at(-1)).toBe("purge_expired_director_messages"); expect(mocks.cleanup).toHaveBeenCalledOnce();
  expect((await result.json()).results).toContainEqual(expect.objectContaining({ task: "publish_cyclo_stickers_s4", ok: false }));
});
it("adds no album request before S5 and does not publish after a failed rollover", async () => {
  vi.setSystemTime(new Date("2026-11-05T21:05:00Z"));
  await GET(new Request("https://example.test/api/cron/game-maintenance")); expect(mocks.publish).not.toHaveBeenCalled();
  vi.setSystemTime(new Date("2026-11-05T23:05:00Z"));
  mocks.rpc.mockImplementation(async name => ({ error: name === "settle_due_season_rollovers" ? { message: "not ready" } : null }));
  await GET(new Request("https://example.test/api/cron/game-maintenance")); expect(mocks.publish).not.toHaveBeenCalled();
});
