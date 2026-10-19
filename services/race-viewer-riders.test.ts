import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadViewerNationalRaceRiderIds,
  loadViewerRaceRiderIdsByEdition,
} from "@/services/race-viewer-riders";

type ContractResponse = {
  data: Array<{ rider_id: string }> | null;
  error: { message: string } | null;
};

type ContractQuery = {
  table: string;
  columns?: string;
  filters: Array<[string, unknown]>;
  riderIds: string[];
  range?: [number, number];
  order?: [string, { ascending: boolean }];
  signal?: AbortSignal;
};

function mockSupabase(
  respond: (query: ContractQuery) => ContractResponse | Promise<ContractResponse> = () => ({
    data: [], error: null,
  }),
) {
  const queries: ContractQuery[] = [];
  let activeRequests = 0;
  let maximumConcurrency = 0;
  const from = vi.fn((table: string) => {
    const query: ContractQuery = { table, filters: [], riderIds: [] };
    queries.push(query);
    const builder = {
      select(columns: string) { query.columns = columns; return builder; },
      eq(column: string, value: unknown) { query.filters.push([column, value]); return builder; },
      in(column: string, values: string[]) {
        expect(column).toBe("rider_id");
        query.riderIds = [...values];
        return builder;
      },
      order(column: string, options: { ascending: boolean }) {
        query.order = [column, options];
        return builder;
      },
      range(start: number, end: number) { query.range = [start, end]; return builder; },
      abortSignal(signal: AbortSignal) { query.signal = signal; return builder; },
      async returns() {
        activeRequests += 1;
        maximumConcurrency = Math.max(maximumConcurrency, activeRequests);
        try {
          return await respond(query);
        } finally {
          activeRequests -= 1;
        }
      },
    };
    return builder;
  });

  return {
    client: { from } as unknown as Parameters<typeof loadViewerNationalRaceRiderIds>[0],
    from,
    queries,
    get maximumConcurrency() { return maximumConcurrency; },
  };
}

const mixedRows = [
  { race_edition_id: "club-race", rider_id: "club-own", team_id: "viewer-club" },
  { race_edition_id: "nations-cup", rider_id: "national-own", team_id: "registration-rwanda" },
  { race_edition_id: "nations-cup", rider_id: "national-other", team_id: "registration-rwanda" },
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("loadViewerRaceRiderIdsByEdition", () => {
  it("does not query contracts for a spectator", async () => {
    const supabase = mockSupabase();

    expect(await loadViewerRaceRiderIdsByEdition(
      supabase.client, null, mixedRows, new Set(["nations-cup"]),
    )).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("treats an unavailable optional viewer identity as a spectator", async () => {
    const supabase = mockSupabase();

    expect(await loadViewerRaceRiderIdsByEdition(
      supabase.client, Promise.reject(new Error("Header unavailable")),
      mixedRows, new Set(["nations-cup"]),
    )).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("uses raw club ownership without a query for club races and national championships", async () => {
    const supabase = mockSupabase();
    const rows = [
      { race_edition_id: "club-race", rider_id: "club-own", team_id: "viewer-club" },
      { race_edition_id: "national-road", rider_id: "road-own", team_id: "viewer-club" },
      { race_edition_id: "national-time-trial", rider_id: "tt-own", team_id: "viewer-club" },
      { race_edition_id: "national-road", rider_id: "other", team_id: "other-club" },
    ];

    const result = await loadViewerRaceRiderIdsByEdition(
      supabase.client, Promise.resolve("viewer-club"), rows, new Set(),
    );

    expect(result).toEqual(new Map([
      ["club-race", ["club-own"]],
      ["national-road", ["road-own"]],
      ["national-time-trial", ["tt-own"]],
    ]));
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("resolves federation ownership by active club contracts, never registration or country", async () => {
    const supabase = mockSupabase(() => ({ data: [{ rider_id: "national-own" }], error: null }));
    const rows = [
      ...mixedRows,
      // Even an accidental raw ID match must not override federation ownership.
      { race_edition_id: "nations-cup", rider_id: "false-match", team_id: "viewer-club" },
      mixedRows[1],
    ];

    const result = await loadViewerRaceRiderIdsByEdition(
      supabase.client, "viewer-club", rows, new Set(["nations-cup"]),
    );

    expect(result?.get("club-race")).toEqual(["club-own"]);
    expect(result?.get("nations-cup")).toEqual(["national-own"]);
    expect(supabase.queries).toHaveLength(1);
    expect(supabase.queries[0]).toMatchObject({
      table: "rider_contracts",
      columns: "rider_id",
      filters: [["team_id", "viewer-club"], ["status", "active"]],
      riderIds: ["false-match", "national-other", "national-own"],
      order: ["rider_id", { ascending: true }],
      range: [0, 999],
    });
    expect(supabase.queries[0].signal).toBeInstanceOf(AbortSignal);
  });

  it.each(["supabase-error", "thrown-error"])(
    "fails open on %s and preserves ownership for club races",
    async (failure) => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const supabase = mockSupabase(() => {
        if (failure === "thrown-error") throw new Error("Connection unavailable");
        return { data: null, error: { message: "Optional lookup unavailable" } };
      });

      const result = await loadViewerRaceRiderIdsByEdition(
        supabase.client, "viewer-club", mixedRows, new Set(["nations-cup"]),
      );

      expect(result).toEqual(new Map([["club-race", ["club-own"]]]));
    },
  );

  it("fails open on an in-flight deadline abort without losing club ownership", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), milliseconds);
      return controller.signal;
    });
    const supabase = mockSupabase((query) => new Promise((_resolve, reject) => {
      query.signal?.addEventListener("abort", () => reject(query.signal?.reason), { once: true });
    }));

    const pending = loadViewerRaceRiderIdsByEdition(
      supabase.client, "viewer-club", mixedRows, new Set(["nations-cup"]),
    );
    await vi.advanceTimersByTimeAsync(999);
    expect(supabase.queries).toHaveLength(1);
    expect(controller.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(await pending).toEqual(new Map([["club-race", ["club-own"]]]));
    expect(controller.signal.aborted).toBe(true);
  });
});

describe("loadViewerNationalRaceRiderIds", () => {
  it("does not query without a viewer or engaged riders", async () => {
    const supabase = mockSupabase();

    expect(await loadViewerNationalRaceRiderIds(supabase.client, null, ["rider"])).toEqual(new Set());
    expect(await loadViewerNationalRaceRiderIds(supabase.client, "viewer-club", [])).toEqual(new Set());
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("deduplicates and limits batches to 100 with concurrency one and a shared 1s signal", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const ids = Array.from({ length: 205 }, (_, index) => `rider-${String(index).padStart(3, "0")}`);
    const supabase = mockSupabase(async (query) => {
      await Promise.resolve();
      return { data: query.riderIds.map((rider_id) => ({ rider_id })), error: null };
    });

    const result = await loadViewerNationalRaceRiderIds(
      supabase.client, "viewer-club", [...ids].reverse().concat(ids[0], ids[10]),
    );

    expect(result).toEqual(new Set(ids));
    expect(supabase.queries.map((query) => query.riderIds.length)).toEqual([100, 100, 5]);
    expect(supabase.queries.flatMap((query) => query.riderIds)).toEqual(ids);
    expect(supabase.maximumConcurrency).toBe(1);
    expect(timeout).toHaveBeenCalledExactlyOnceWith(1_000);
    expect(supabase.queries.every((query) => query.signal === controller.signal)).toBe(true);
  });

  it("does not start another batch after the shared deadline, even if the first query ignores abort", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), milliseconds);
      return controller.signal;
    });
    const supabase = mockSupabase((query) => new Promise((resolve) => {
      setTimeout(() => resolve({
        data: query.riderIds.map((rider_id) => ({ rider_id })), error: null,
      }), 1_000);
    }));

    const pending = loadViewerNationalRaceRiderIds(
      supabase.client, "viewer-club",
      Array.from({ length: 250 }, (_, index) => `rider-${index}`),
    );
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await pending).toEqual(new Set());
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.queries[0].riderIds).toHaveLength(100);
    expect(controller.signal.aborted).toBe(true);
  });
});
