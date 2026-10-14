import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  annualSeason: "s3" as string | null,
  queriedSeasons: [] as string[],
  tables: [] as string[],
  selections: [] as string[],
  score: 0,
  progress: null as { status: string; sponsor_objectives: { satisfaction_points: number } | null }[] | null,
  error: null as { message: string } | null,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      mock.tables.push(table);
      let season: string | null = null;
      const query = {
        select: (selection: string) => { mock.selections.push(selection); return query; },
        eq: (key: string, value: string) => {
          if (key === "season_id") {
            season = value;
            mock.queriedSeasons.push(value);
          }
          return query;
        },
        in: () => query,
        maybeSingle: async () => ({
          data: { satisfaction_score: mock.score, start_season_id: "s2", objective_season_id: mock.annualSeason },
          error: null,
        }),
        returns: async () => ({
          data: table === "objective_progress"
            ? (mock.progress ?? (season === "s3"
              ? [{ status: "in_progress", sponsor_objectives: { satisfaction_points: 14 } }]
              : [{ status: "achieved", sponsor_objectives: { satisfaction_points: 14 } }]))
            : [{ id: "new", satisfaction_points: 14 }, { id: "old", satisfaction_points: 14 }],
          error: mock.error,
        }),
      };
      return query;
    },
  }),
}));
import { getSponsorObjectiveSummary } from "@/services/sponsor-objective-summary";

describe("annual sponsor objective summary", () => {
  beforeEach(() => {
    mock.annualSeason = "s3"; mock.queriedSeasons = []; mock.tables = [];
    mock.selections = []; mock.score = 0; mock.progress = null; mock.error = null;
  });
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
  it("loads the weights in the same read, preserving every status and the persisted score", async () => {
    mock.score = 57.6;
    mock.progress = [
      { status: "achieved", sponsor_objectives: { satisfaction_points: 12 } },
      { status: "in_progress", sponsor_objectives: { satisfaction_points: 14 } },
      { status: "failed", sponsor_objectives: { satisfaction_points: 8 } },
      { status: "not_started", sponsor_objectives: { satisfaction_points: 7 } },
      { status: "achieved", sponsor_objectives: null },
    ];
    expect(await getSponsorObjectiveSummary("contract")).toEqual({
      completed: 2, total: 5, satisfactionScore: 58, satisfactionMaximum: 41,
    });
    expect(mock.tables).toEqual(["team_sponsor_contracts", "objective_progress"]);
    expect(mock.selections[1]).toBe("status, sponsor_objectives(satisfaction_points)");
  });
  it("preserves satisfaction for a contract with no objectives", async () => {
    mock.progress = []; mock.score = 125;
    expect(await getSponsorObjectiveSummary("contract")).toEqual({
      completed: 0, total: 0, satisfactionScore: 100, satisfactionMaximum: 0,
    });
  });
  it("fails rather than returning a partial summary when the joined read fails", async () => {
    mock.error = { message: "unavailable" };
    await expect(getSponsorObjectiveSummary("contract")).rejects.toThrow("résumé des objectifs sponsor : unavailable");
  });
});
