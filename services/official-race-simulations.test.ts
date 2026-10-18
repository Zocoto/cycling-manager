import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SeasonRaceCalendar } from "@/lib/game/race-calendar";
import { createDemoSimulationInput } from "@/lib/game/race-simulation-demo";

const fixture = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  writes: [] as string[],
  client: null as unknown,
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => fixture.client }));
vi.mock("@/lib/game/race-favorites", () => ({ buildRaceFavorites: () => [] }));
vi.mock("@/lib/game/race-simulation-demo", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/game/race-simulation-demo")>();
  return { ...original, createCalendarSimulationInput: ({ edition, stage, seed }: {
    edition: SeasonRaceCalendar["editions"][number];
    stage: SeasonRaceCalendar["editions"][number]["stages"][number]; seed: string;
  }) => ({ ...original.createDemoSimulationInput("sprint-littoral", seed), id: stage.id,
    riders: edition.engagedRiders, isStageRace: true }) };
});
import { ensureLockedOfficialRaceSimulations } from "./official-race-simulations";

function createClient() {
  return { from(table: string) {
    const predicates: Array<(row: Record<string, unknown>) => boolean> = [];
    let inserted: Record<string, unknown> | undefined;
    let deleting = false;
    let start = 0, end = Infinity;
    const result = () => {
      let rows = (fixture.tables[table] ?? []).filter(row => predicates.every(test => test(row)));
      if (deleting) {
        fixture.writes.push(`delete:${table}`);
        fixture.tables[table] = (fixture.tables[table] ?? []).filter(row => !rows.includes(row));
      }
      if (inserted) rows = [inserted];
      return { data: rows.slice(start, end + 1), error: null };
    };
    const builder = {
      select: () => builder, order: () => builder,
      in: (key: string, values: unknown[]) => { predicates.push(row => values.includes(row[key])); return builder; },
      eq: (key: string, value: unknown) => { predicates.push(row => row[key] === value); return builder; },
      lte: () => builder, gt: () => builder, or: () => builder,
      range: (from: number, to: number) => { start = from; end = to; return builder; },
      insert: (row: Record<string, unknown>) => {
        inserted = row;
        fixture.writes.push(`insert:${table}`);
        (fixture.tables[table] ??= []).push(row);
        return builder;
      },
      delete: () => { deleting = true; return builder; },
      returns: async () => result(),
      single: async () => { const response = result(); return { ...response, data: response.data[0] }; },
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return builder;
  } };
}

describe("official simulations across a batch of tours", () => {
  beforeEach(() => { fixture.tables = {}; fixture.writes = []; fixture.client = createClient(); });

  it("limits medical exclusions to each tour and preserves every locked scenario on retry", async () => {
    const sample = createDemoSimulationInput("sprint-littoral", "medical-batch");
    const editions = ["a", "b"].map(id => ({ id, raceFormat: "stage_race", status: "in_progress",
      engagedRiders: sample.riders.slice(0, 3).map((rider, index) => ({ ...rider, id: `${id}-${index}` })),
      stages: [{ id: `${id}-stage`, stageNumber: 1, departureAt: "2026-10-18T12:00:00Z", distanceKm: 154,
        status: "planned", segments: sample.segments }],
    }));
    const calendar = { editions } as unknown as SeasonRaceCalendar;
    fixture.tables.rider_injuries = ["a-0", "b-0"].map(rider_id => ({ rider_id,
      started_at: "2026-10-17T12:00:00Z", expected_recovery_at: "2026-10-20T12:00:00Z", recovered_at: null }));

    const first = await ensureLockedOfficialRaceSimulations(calendar, new Date("2026-10-18T12:01:00Z"));
    expect(first.a[0].input.unavailableRiderIds).toEqual(["a-0"]);
    expect(first.b[0].input.unavailableRiderIds).toEqual(["b-0"]);
    expect(first.a[0].simulation.results.map(row => row.riderId)).not.toContain("a-0");
    expect(first.b[0].simulation.results.map(row => row.riderId)).not.toContain("b-0");
    expect(fixture.writes.filter(write => write === "insert:official_stage_simulations")).toHaveLength(2);

    const writesBeforeRetry = [...fixture.writes];
    const retry = await ensureLockedOfficialRaceSimulations(calendar, new Date("2026-10-18T13:00:00Z"));
    expect(retry).toEqual(first);
    expect(fixture.writes).toEqual(writesBeforeRetry);
    expect(fixture.writes.filter(write => write.startsWith("delete:")))
      .toEqual(["delete:official_stage_simulation_claims", "delete:official_stage_simulation_claims"]);
  });
});
