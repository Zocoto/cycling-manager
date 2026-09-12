import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  annualSeason: "s3" as string | null,
  queriedSeasons: [] as string[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      let season: string | null = null;
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          if (key === "season_id") {
            season = value;
            mock.queriedSeasons.push(value);
          }
          return query;
        },
        in: () => query,
        maybeSingle: async () => ({
          data: { satisfaction_score: 0, start_season_id: "s2", objective_season_id: mock.annualSeason },
          error: null,
        }),
        returns: async () => ({
          data: table === "objective_progress"
            ? (season === "s3"
              ? [{ sponsor_objective_id: "new", status: "in_progress" }]
              : [{ sponsor_objective_id: "old", status: "achieved" }])
            : [{ id: "new", satisfaction_points: 14 }, { id: "old", satisfaction_points: 14 }],
          error: null,
        }),
      };
      return query;
    },
  }),
}));
import { getSponsorObjectiveSummary } from "@/services/sponsor-objective-summary";

describe("annual sponsor objective summary", () => {
  beforeEach(() => { mock.annualSeason = "s3"; mock.queriedSeasons = []; });
  it("does not include previous seasons in the Bureau summary", async () => {
    const result = await getSponsorObjectiveSummary("contract");
    expect(mock.queriedSeasons).toEqual(["s3"]);
    expect(result.completed).toBe(0);
    expect(result.total).toBe(1);
    expect(result.satisfactionMaximum).toBe(14);
  });
  it("uses the start season for a first-year contract", async () => {
    mock.annualSeason = null;
    const result = await getSponsorObjectiveSummary("contract");
    expect(mock.queriedSeasons).toEqual(["s2"]);
    expect(result.completed).toBe(1);
  });
  it("does not query progress without a contract", async () => {
    expect((await getSponsorObjectiveSummary(" ")).total).toBe(0);
    expect(mock.queriedSeasons).toEqual([]);
  });
});
