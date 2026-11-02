import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let compactDataCache: typeof import("./compact-data-cache").compactDataCache;
let nativeCache: typeof import("next/cache").unstable_cache;
type Stored = { kind: string; data: { body: string }; revalidate: number };
type Meta = { tags: string[]; fetchCache: boolean };

// Real installed Next.js cache; only its backing store is an isolated map.
// No database, HTTP call, app server or production fixture is involved.
function backingStore() {
  const entries = new Map<string, { value: Stored; meta: Meta; writtenAt: number }>();
  let now = 0;
  const writes: Array<{ value: Stored; meta: Meta }> = [];
  return {
    entries, writes,
    async generateSimpleCacheKey(value: string) {
      return createHash("sha256").update(value).digest("hex");
    },
    async get(key: string) {
      const entry = entries.get(key);
      return entry ? { value: entry.value, isStale: now - entry.writtenAt >= entry.value.revalidate * 1000 } : null;
    },
    async set(key: string, value: Stored, meta: Meta) {
      entries.set(key, { value, meta, writtenAt: now });
      writes.push({ value, meta });
    },
    advance(milliseconds: number) { now += milliseconds; },
    invalidate(tag: string) {
      for (const [key, entry] of entries) if (entry.meta.tags.includes(tag)) entries.delete(key);
    },
  };
}

let store: ReturnType<typeof backingStore>;
beforeAll(async () => {
  vi.stubGlobal("AsyncLocalStorage", AsyncLocalStorage);
  ({ compactDataCache } = await import("./compact-data-cache"));
  ({ unstable_cache: nativeCache } = await import("next/cache"));
});
beforeEach(() => {
  store = backingStore();
  vi.stubGlobal("__incrementalCache", store);
});
afterAll(() => vi.unstubAllGlobals());

const bulkData = () => Array.from({ length: 1232 }, (_, i) => ({
  riderId: `rider-${i}`, rank: i + 1, riderName: `Coureur de démonstration ${i} — Équipe 🏆`,
  countryCode: "FR", points: 1800 - i, teamName: "Club cycliste de démonstration",
  jersey: { kind: "sponsor", imagePath: "/images/sponsors/demo/jersey.webp" },
}));
const units = (body: string) => Math.ceil(Buffer.byteLength(body) / 8192);

describe("compact shared cache through the real Next.js adapter", () => {
  it("keeps a large ranking identical on miss and hit while reducing real stored units", async () => {
    const data = bulkData();
    const load = vi.fn(async () => data);
    const cached = compactDataCache(load, ["ranking"], { revalidate: 60, tags: ["uci-rankings"] });
    expect(await cached()).toEqual(data);
    expect(await cached()).toEqual(data);
    expect(load).toHaveBeenCalledOnce();
    expect(store.writes).toHaveLength(1);
    expect(store.writes[0].meta.tags).toEqual(["uci-rankings"]);
    expect(store.writes[0].value.revalidate).toBe(60);
    const rawUnits = units(JSON.stringify(data));
    const storedUnits = units(store.writes[0].value.data.body);
    expect(storedUnits).toBeLessThan(rawUnits / 4);
    expect(store.writes[0].value.data.body).not.toContain("Coureur de démonstration");
    console.log(JSON.stringify({ fixture: "1232-rider-ranking", rawUnits, storedUnits,
      unitReductionPct: Math.round(100 * (1 - storedUnits / rawUnits)) }));
  });

  it.each([null, false, 0, "1.2.3", [], { ids: ["a", "b"] }])("does not inflate small values: %j", async value => {
    const cached = compactDataCache(async () => value, ["small", JSON.stringify(value)]);
    expect(await cached()).toEqual(value);
    expect(await cached()).toEqual(value);
    expect(store.writes[0].value.data.body).toBe(JSON.stringify(value));
  });

  it("does not store a larger envelope for poorly compressible content", async () => {
    const data = randomBytes(100_000).toString("base64");
    const cached = compactDataCache(async () => data, ["random"]);
    expect(await cached()).toBe(data);
    expect(store.writes[0].value.data.body).toBe(JSON.stringify(data));
    expect(await cached()).toBe(data);
  });

  it("retains argument, key-part and original-loader isolation", async () => {
    const country = compactDataCache(async (code: string) => ({ code }), ["country"]);
    expect(await country("FR")).toEqual({ code: "FR" });
    expect(await country("BE")).toEqual({ code: "BE" });
    const a = compactDataCache(async () => "a", ["same"]);
    const b = compactDataCache(async () => "b", ["same"]);
    expect(await a()).toBe("a"); expect(await b()).toBe("b");
    const load = async () => "shared";
    await compactDataCache(load, ["one"])();
    await compactDataCache(load, ["two"])();
    expect(store.entries.size).toBe(6);
  });

  it("respects tag invalidation and the original expiry without extra origin reads", async () => {
    let revision = 1;
    const load = vi.fn(async () => ({ revision, rows: bulkData() }));
    const cached = compactDataCache(load, ["news"], { revalidate: 60, tags: ["news"] });
    expect((await cached()).revision).toBe(1);
    revision = 2; store.advance(59_000);
    expect((await cached()).revision).toBe(1);
    expect(load).toHaveBeenCalledOnce();
    store.invalidate("news");
    expect((await cached()).revision).toBe(2);
    revision = 3; store.advance(60_000);
    expect((await cached()).revision).toBe(3);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("does not cache a rejected origin read or turn it into an empty success", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("Origin unavailable")).mockResolvedValue(bulkData());
    const cached = compactDataCache(load, ["failure"]);
    await expect(cached()).rejects.toThrow("Origin unavailable");
    expect(store.writes).toHaveLength(0);
    expect(await cached()).toEqual(bulkData());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("preserves Next's background revalidation during an App Router render", async () => {
    const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
    const requestContext = () => ({ route: "/isolated-cache-test", incrementalCache: store,
      nextFetchId: 1, pendingRevalidates: {} as Record<string, Promise<unknown>> });
    let revision = 1;
    const load = vi.fn(async () => ({ revision, rows: bulkData() }));
    const cached = compactDataCache(load, ["app-router"], { revalidate: 60 });
    const firstRequest = requestContext();
    await workAsyncStorage.run(firstRequest as never, async () => {
      expect((await cached()).revision).toBe(1);
      await Promise.all(Object.values(firstRequest.pendingRevalidates));
    });
    revision = 2; store.advance(60_000);
    const nextRequest = requestContext();
    await workAsyncStorage.run(nextRequest as never, async () => {
      // The current request still gets the old result; Next refreshes it once.
      expect((await cached()).revision).toBe(1);
      await Promise.all(Object.values(nextRequest.pendingRevalidates));
      expect((await cached()).revision).toBe(2);
      expect(load).toHaveBeenCalledTimes(2);
      expect(store.writes).toHaveLength(2);
    });
  });

  it("keeps independent tags separate when only one cache is invalidated", async () => {
    const first = vi.fn(async () => bulkData());
    const second = vi.fn(async () => bulkData());
    const a = compactDataCache(first, ["a"], { tags: ["a"] });
    const b = compactDataCache(second, ["b"], { tags: ["b"] });
    await a(); await b(); store.invalidate("a"); await a(); await b();
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledOnce();
  });

  it("does not reuse a legacy uncompressed entry across the new namespace", async () => {
    const load = vi.fn(async () => bulkData());
    await nativeCache(load, ["legacy"])();
    const cached = compactDataCache(load, ["legacy"]);
    expect(await cached()).toEqual(bulkData());
    expect(await cached()).toEqual(bulkData());
    expect(load).toHaveBeenCalledTimes(2);
    expect(store.entries.size).toBe(2);
  });
});
