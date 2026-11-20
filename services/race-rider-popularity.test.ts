import { describe, expect, it, vi } from "vitest";
import { calculateFanClubRiderPopularity } from "@/lib/game/fan-club-popularity";
import { getFanClubHeadquartersSpecializationEffects } from "@/lib/game/fan-club-specialization";
import type { StageSimulationInput } from "@/lib/game/race-simulation";
import { snapshotCrowdSurgePopularity } from "./race-rider-popularity";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
function fixture() {
  const tables: Record<string, Row[]> = {
    seasons: [
      { id: "s3", game_year: 3, status: "completed", current_day_number: 28 },
      { id: "s4", game_year: 4, status: "active", current_day_number: 6 },
    ],
    rider_contracts: [
      { id: "contract-a", rider_id: "a", team_id: "club-a", start_season_id: "s3", end_season_id: "s4", status: "active" },
      { id: "contract-b", rider_id: "b", team_id: "club-b", start_season_id: "s4", end_season_id: "s4", status: "active" },
    ],
    rider_season_ratings: [
      { rider_id: "a", season_id: "s3" }, { rider_id: "a", season_id: "s4" },
      { rider_id: "b", season_id: "s4" },
    ],
    rider_popularity_profiles: [{ rider_id: "a", popularity_points: 200 }, { rider_id: "b", popularity_points: 3 }],
    race_rosters: [
      { id: "roster-a", rider_id: "a", race_registration_id: "reg-a" },
      { id: "roster-b", rider_id: "b", race_registration_id: "reg-b" },
    ],
    race_results: [{ id: "result-a", race_edition_id: "edition", race_roster_id: "roster-a", final_rank: 1 }],
    stage_results: [],
    stage_attack_participants: [{ stage_id: "stage", race_roster_id: "roster-a", participation_type: "breakaway" }],
    race_registrations: [{ id: "reg-a", race_edition_id: "edition", team_season_id: "ts-a" }],
    stages: [{ id: "stage", race_edition_id: "edition", season_day_id: "d3", stage_number: 1, name: "Classic", distance_km: 180 }],
    race_editions: [{ id: "edition", race_id: "race", season_id: "s4", race_category_id: "category", display_name: "Classic", status: "completed", host_country_id: "fr", is_neutral_host: false }],
    race_categories: [{ id: "category", prestige_rank: 2 }],
    races: [{ id: "race", race_format: "one_day", country_id: "fr" }],
    team_seasons: [{ id: "ts-a", team_id: "club-a", season_id: "s4", registration_country_id: "fr" }],
    season_days: [{ id: "d3", day_number: 3 }],
  };
  const contexts = [
    { team_id: "club-a", registration_country_code: "FR", community_growth_bonus_percentage: 18, headquarters_level: 3, active_specialization_code: "event_house" },
    { team_id: "club-b", registration_country_code: "BE", community_growth_bonus_percentage: 0, headquarters_level: 0, active_specialization_code: null },
  ];
  const reads: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const from = vi.fn((table: string) => {
    let data = [...(tables[table] ?? [])];
    const entry = { table, filters: [] as Array<[string, unknown]> };
    reads.push(entry);
    const query = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn((start: number, end: number) => { data = data.slice(start, end + 1); return query; }),
      in: vi.fn((key: string, ids: unknown[]) => { entry.filters.push([key, ids]); data = data.filter(row => ids.includes(row[key])); return query; }),
      eq: vi.fn((key: string, value: unknown) => { entry.filters.push([key, value]); data = data.filter(row => row[key] === value); return query; }),
      not: vi.fn().mockReturnThis(),
      lte: vi.fn((key: string, value: number) => { data = data.filter(row => typeof row[key] === "number" && row[key] <= value); return query; }),
      returns: vi.fn(async () => ({ data, error: null })),
    };
    return query;
  });
  const rpc = vi.fn((name: string, args: { p_team_ids: string[]; p_season_id: string }) => {
    if (name !== "get_race_team_popularity_context") throw new Error("Unexpected RPC");
    return { returns: vi.fn(async () => ({ data: contexts.filter(context => args.p_team_ids.includes(context.team_id)), error: null })) };
  });
  return { admin: { from, rpc }, tables, reads, contexts };
}

function input() {
  return {
    id: "stage-new", riders: [
      { id: "a", teamId: "national-fr", name: "Alice", countryCode: "FR", specialAbilities: ["crowd_surge"] },
      { id: "b", teamId: "club-b", name: "Bob", countryCode: "FR", specialAbilities: ["crowd_surge"] },
      { id: "c", teamId: "club-c", name: "Camille", specialAbilities: [] },
    ],
  } as unknown as StageSimulationInput;
}
const context = { seasonId: "s4", gameYear: 4, dayNumber: 6 };

describe("official crowd-surge popularity snapshot", () => {
  it("uses the displayed score with exact career, club, results and team bonuses in grouped reads", async () => {
    const mock = fixture();
    const original = input();
    const source = structuredClone(original);
    const snapshot = await snapshotCrowdSurgePopularity(original, { ...context, admin: mock.admin as never });
    const specialization = getFanClubHeadquartersSpecializationEffects({ code: "event_house", infrastructureLevel: 3 });
    const expected = calculateFanClubRiderPopularity({
      id: "a", name: "Alice", initials: "", role: "", country: "",
      nationalityMatchesTeam: true, activeSeason: 4, activeDay: 6,
      careerSeasons: [3, 4], clubSeasons: [3, 4],
      events: [
        { id: "race:result-a", kind: "race_result", season: 4, day: 3, reason: "Classic", rank: 1, prestigeRank: 2, forCurrentTeam: true, homeRace: true },
        { id: "breakaway:stage:roster-a", kind: "breakaway", season: 4, day: 3, reason: "Escape", rank: null, prestigeRank: 2, forCurrentTeam: true, homeRace: true },
      ],
      communityGrowthBonusPercentage: 18, mediaPopularityPoints: 200,
      resultPopularityBonusPercentage: specialization.riderPopularityGainBonusPercentage,
    }).popularity;
    expect(snapshot.riders[0].popularity).toBe(expected);
    expect(snapshot.riders[0].popularity).toBeLessThan(100);
    expect(snapshot.riders[1].popularity).toBe(13); // 5 loyalty + 5 foreign nationality + 3 media.
    expect(snapshot.riders[2]).toBe(original.riders[2]);
    expect(original).toEqual(source);
    expect(mock.admin.rpc).toHaveBeenCalledOnce();
    expect(mock.admin.rpc).toHaveBeenCalledWith("get_race_team_popularity_context", {
      p_team_ids: ["club-a", "club-b"], p_season_id: "s4",
    });
    expect(mock.reads.filter(read => read.table === "race_results")).toHaveLength(1);
    expect(mock.reads.find(read => read.table === "rider_contracts")?.filters).toContainEqual(["status", "active"]);
    expect(mock.reads.filter(read => read.table === "rider_season_ratings")[0].filters).toContainEqual(["rider_id", ["a", "b"]]);
  });

  it("preserves frozen snapshots and adds zero queries without an eligible missing holder", async () => {
    const mock = fixture();
    for (const source of [
      { ...input(), riders: input().riders.map(rider => ({ ...rider, specialAbilities: [] })) },
      { ...input(), riders: input().riders.map(rider => ({ ...rider, popularity: 50 })) },
      { ...input(), unavailableRiderIds: ["a", "b"] },
    ]) {
      expect(await snapshotCrowdSurgePopularity(source, { ...context, admin: mock.admin as never })).toBe(source);
    }
    expect(mock.admin.from).not.toHaveBeenCalled();
    expect(mock.admin.rpc).not.toHaveBeenCalled();
  });

  it("excludes sporting events after the stage day during delayed settlement", async () => {
    const mock = fixture();
    mock.tables.season_days[0].day_number = 7;
    const snapshot = await snapshotCrowdSurgePopularity(input(), { ...context, admin: mock.admin as never });
    expect(snapshot.riders[0].popularity).toBe(35); // 10 club loyalty + 10 nationality + capped 15 media.
  });
});

