import { describe, expect, it, vi } from "vitest";
import { sortFederationSelectionRiders } from "@/lib/game/federation-selection-ranking";

const mocks = vi.hoisted(() => ({ createAdmin: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/performance/compact-data-cache", () => ({
  compactDataCache: (load: unknown) => load,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createAdmin,
}));

import { getFederationSelectionPool } from "./federation-selection-pool";

type Row = Record<string, string | number>;
type QueryCall = {
  table: string;
  sortKeys: string[];
  bounds?: [number, number];
  inSizes: number[];
};

function makeClient(rows: Record<string, Row[]>) {
  const calls: QueryCall[] = [];
  return {
    calls,
    from(table: string) {
      let matching = [...(rows[table] ?? [])];
      const sortKeys: string[] = [];
      const inSizes: number[] = [];
      let bounds: [number, number] | undefined;
      let maximum = 1_000;
      const query = {
        select() { return query; },
        eq(column: string, value: string) {
          matching = matching.filter((row) => row[column] === value);
          return query;
        },
        gte(column: string, value: number) {
          matching = matching.filter((row) => Number(row[column]) >= value);
          return query;
        },
        lte(column: string, value: number) {
          matching = matching.filter((row) => Number(row[column]) <= value);
          return query;
        },
        in(column: string, values: string[]) {
          inSizes.push(values.length);
          const accepted = new Set(values);
          matching = matching.filter((row) => accepted.has(String(row[column])));
          return query;
        },
        order(column: string) {
          sortKeys.push(column);
          return query;
        },
        limit(size: number) {
          maximum = size;
          return query;
        },
        range(from: number, to: number) {
          bounds = [from, to];
          return query;
        },
        async returns() {
          calls.push({ table, sortKeys, bounds, inSizes });
          if (inSizes.some((size) => size > 150)) {
            return { data: null, error: { message: "Filtre .in trop volumineux" } };
          }
          matching.sort((left, right) => {
            for (const key of sortKeys) {
              const difference = String(left[key]).localeCompare(String(right[key]));
              if (difference) return difference;
            }
            return 0;
          });
          const [start, end] = bounds ?? [0, maximum - 1];
          return { data: matching.slice(start, Math.min(end + 1, start + maximum)), error: null };
        },
      };
      return query;
    },
  };
}

const baseRatings = {
  mountain: 60, hills: 60, flat: 60, time_trial: 60, cobbles: 60, sprint: 60,
  acceleration: 60, downhill: 60, endurance: 60, resistance: 60, recovery: 60,
  breakaway: 60, prologue: 60,
};

function selectionFixture() {
  const size = 501;
  const suffixes = Array.from({ length: size }, (_, index) => String(index).padStart(3, "0"));
  const leadingHillRatings = new Map([["001", 82], ["251", 76], ["500", 74]]);
  const riders = suffixes.map((suffix) => ({
    id: "pro-" + suffix,
    first_name: "Émile",
    last_name: suffix,
    status: "active",
    country_id: "fr",
  }));
  const juniors = suffixes.map((suffix) => ({
    id: "junior-" + suffix,
    team_id: "team-" + suffix,
    first_name: "Axel",
    last_name: suffix,
    status: "active",
    country_id: "fr",
    birth_game_year: -12,
    ...baseRatings,
  }));
  const developmentTeams = suffixes.map((suffix) => ({
    id: "dev-" + suffix,
    team_id: "team-" + suffix,
    season_id: "season",
    status: "active",
    display_name: "Dev Team " + suffix,
  }));
  const client = makeClient({
    riders: [
      ...riders,
      { ...riders[0], id: "retired", status: "retired" },
      { ...riders[0], id: "foreign-pro", country_id: "be" },
    ],
    youth_academy_riders: [
      ...juniors,
      { ...juniors[0], id: "too-old", birth_game_year: -14 },
      { ...juniors[0], id: "foreign-junior", country_id: "be" },
    ],
    rider_season_ratings: suffixes.map((suffix) => ({
      rider_id: "pro-" + suffix,
      season_id: "season",
      age: 25,
      ...baseRatings,
      hills: leadingHillRatings.get(suffix) ?? baseRatings.hills,
    })),
    rider_contracts: suffixes.map((suffix) => ({
      id: "contract-" + suffix,
      rider_id: "pro-" + suffix,
      team_id: "team-" + suffix,
      status: "active",
    })),
    development_teams: developmentTeams,
    development_team_roster: [{
      development_team_id: "dev-500",
      academy_rider_id: "junior-500",
    }],
    team_seasons: suffixes.map((suffix) => ({
      team_id: "team-" + suffix,
      season_id: "season",
      display_name: "Équipe " + suffix,
    })),
  });
  return { client, size };
}

describe("getFederationSelectionPool", () => {
  it("charge les pages de pros et de juniors au-delà de 250 avec leurs données de la saison", async () => {
    const { client, size } = selectionFixture();
    mocks.createAdmin.mockReturnValue(client);

    const pool = await getFederationSelectionPool({
      countryId: "fr",
      seasonId: "season",
      gameYear: 5,
    });

    expect(pool).toHaveLength(size * 2);
    expect(new Set(pool.map(({ id }) => id)).size).toBe(size * 2);
    expect(pool).toContainEqual(expect.objectContaining({
      id: "pro-500",
      teamName: "Équipe 500",
      category: "professional",
      ratings: expect.objectContaining({ hills: 74 }),
    }));
    expect(pool).toContainEqual(expect.objectContaining({
      id: "junior-500",
      teamName: "Dev Team 500",
      category: "junior",
      juniorAffiliation: "development_team",
    }));
    expect(pool).toContainEqual(expect.objectContaining({
      id: "junior-499",
      teamName: "Équipe 499 · École de cyclisme",
      juniorAffiliation: "cycling_school",
    }));
    const byHills = sortFederationSelectionRiders(
      pool.filter(({ category }) => category === "professional"),
      { key: "hills", direction: "descending", countryCode: "FR", weather: null },
    );
    expect(byHills.slice(0, 3).map(({ id }) => id)).toEqual([
      "pro-001", "pro-251", "pro-500",
    ]);

    for (const table of ["riders", "youth_academy_riders"]) {
      expect(client.calls.filter((call) => call.table === table)).toEqual(
        [[0, 249], [250, 499], [500, 749]].map((bounds) =>
          expect.objectContaining({ sortKeys: ["id"], bounds }),
        ),
      );
    }
  });
});
