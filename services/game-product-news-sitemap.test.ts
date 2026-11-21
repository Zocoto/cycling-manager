import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), abort: vi.fn() }));
vi.mock("@/lib/performance/compact-data-cache", () => ({ compactDataCache: (load: unknown) => load }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
import { getPublishedGameNewsSitemapEntries } from "./game-product-news-sitemap";

const row = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  published_at: "2026-10-22T08:00:00+00:00",
  updated_at: "2026-11-20T09:00:00+00:00",
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mocks.rpc.mockReturnValue({ abortSignal: mocks.abort });
  mocks.abort.mockResolvedValue({ data: [], error: null });
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
});

describe("published article sitemap projection", () => {
  it("includes publications beyond the feed limit using sequential UUID cursors", async () => {
    mocks.abort.mockResolvedValueOnce({ data: Array.from({ length: 250 }, (_, n) => row(n + 1)), error: null })
      .mockResolvedValueOnce({ data: [row(251)], error: null });
    const entries = await getPublishedGameNewsSitemapEntries();
    expect(entries).toHaveLength(251);
    expect(entries[250]).toEqual({ id: row(251).id, publishedAt: row(251).published_at, updatedAt: row(251).updated_at });
    expect(mocks.rpc.mock.calls).toEqual([
      ["get_published_game_news_sitemap", { p_after_id: null, p_limit: 250 }],
      ["get_published_game_news_sitemap", { p_after_id: row(250).id, p_limit: 250 }],
    ]);
    expect(mocks.abort).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("returns an empty publication inventory without querying editorial data", async () => {
    expect(await getPublishedGameNewsSitemapEntries()).toEqual([]);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_published_game_news_sitemap", { p_after_id: null, p_limit: 250 });
  });

  it("does not present a partial inventory after a later database failure", async () => {
    mocks.abort.mockResolvedValueOnce({ data: Array.from({ length: 250 }, (_, n) => row(n + 1)), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "unavailable" } });
    await expect(getPublishedGameNewsSitemapEntries()).rejects.toThrow("chargé");
  });

  it("rejects a repeated cursor rather than looping or duplicating URLs", async () => {
    mocks.abort.mockResolvedValue({ data: [row(1), row(1)], error: null });
    await expect(getPublishedGameNewsSitemapEntries()).rejects.toThrow("incohérente");
  });

  it("validates public identifiers and modification dates before publishing them", async () => {
    mocks.abort.mockResolvedValue({ data: [{ ...row(1), updated_at: "unknown" }], error: null });
    await expect(getPublishedGameNewsSitemapEntries()).rejects.toThrow();
    mocks.abort.mockResolvedValue({ data: [{ ...row(1), id: "../draft" }], error: null });
    await expect(getPublishedGameNewsSitemapEntries()).rejects.toThrow();
  });

  it("bounds the total read duration even when individual pages succeed", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(1_000).mockReturnValue(8_000);
    mocks.abort.mockResolvedValue({ data: Array.from({ length: 250 }, (_, n) => row(n + 1)), error: null });
    await expect(getPublishedGameNewsSitemapEntries()).rejects.toThrow("expiré");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("requires splitting before exceeding its bounded page count", async () => {
    let page = 0;
    mocks.abort.mockImplementation(async () => ({ data: Array.from({ length: 250 }, (_, n) => row(page * 250 + n + 1)), error: null, page: page++ }));
    await expect(getPublishedGameNewsSitemapEntries()).rejects.toThrow("plusieurs fichiers");
    expect(mocks.rpc).toHaveBeenCalledTimes(8);
  });
});
