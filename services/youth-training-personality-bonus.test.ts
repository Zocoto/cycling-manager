import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
import { settleDueYouthAutomaticTrainingSessions } from "./youth-development";

type Row = Record<string, unknown>;

function fixture() {
  const ratings = Object.fromEntries([
    "mountain", "hills", "flat", "time_trial", "cobbles", "sprint", "acceleration",
    "downhill", "endurance", "resistance", "recovery", "breakaway", "prologue",
  ].map(key => [key, 3]));
  const tables: Record<string, Row[]> = {
    seasons: [{ id: "season", game_year: 2026, current_day_number: 1, status: "active" }],
    season_days: [{ id: "day", season_id: "season", day_number: 1, calendar_date: "2026-11-27" }],
    staff_contracts: [],
    youth_academy_training_sessions: [],
    youth_academy_riders: [
      { id: "assidu", personality_key: "assidu", training_mode: "automatic" },
      { id: "other", personality_key: "fidele", training_mode: "automatic" },
      { id: "unknown", personality_key: null, training_mode: "automatic" },
      { id: "manual", personality_key: "assidu", training_mode: "manual" },
    ].map(rider => ({
      ...ratings, ...rider, team_id: "team", status: "active", first_name: "Junior", last_name: rider.id,
      birth_game_year: 2009, country_id: "country", potential_steps: 8, training_priority: "climber",
      joined_season_id: "season", joined_day_number: 1,
      automatic_since_season_id: "season", automatic_since_day_number: 1,
      pending_training_mode: null, pending_training_mode_after_season_id: null,
      pending_training_mode_after_day_number: null, scout_training_bonus_percentage: 0,
    })),
  };
  const queries: Array<{ table: string; select: string }> = [];
  const upserts: Row[][] = [];
  const client = {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from(table: string) {
      const request = { table, select: "" };
      queries.push(request);
      const filters: Array<(row: Row) => boolean> = [];
      let update: Row | undefined;
      let inserted: Row[] | undefined;
      const matching = () => (tables[table] ?? []).filter(row => filters.every(filter => filter(row)));
      const result = () => {
        if (inserted) {
          tables[table].push(...structuredClone(inserted));
          inserted = undefined;
        }
        if (update) {
          for (const row of matching()) Object.assign(row, update);
          update = undefined;
        }
        return { data: matching(), error: null };
      };
      const query = {
        select(columns: string) { request.select = columns; return query; },
        eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
        in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return query; },
        lte(key: string, value: number) { filters.push(row => Number(row[key]) <= value); return query; },
        order: () => query,
        returns: async () => result(),
        maybeSingle: async () => ({ ...result(), data: matching()[0] ?? null }),
        upsert(rows: Row[]) { inserted = rows; upserts.push(structuredClone(rows)); return query; },
        update(row: Row) { update = row; return query; },
        then(resolve: (value: ReturnType<typeof result>) => unknown) { return Promise.resolve(result()).then(resolve); },
      };
      return query;
    },
  };
  mocks.admin.mockReturnValue(client);
  return { tables, queries, upserts };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-27T08:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("junior automatic training personality snapshot", () => {
  it("records the character used by the existing gain calculation without an extra lookup", async () => {
    const { tables, queries, upserts } = fixture();
    const result = await settleDueYouthAutomaticTrainingSessions();
    expect(result).toEqual({ currentDayNumber: 1, processedTeamCount: 1, processedSessionCount: 3 });
    const sessions = tables.youth_academy_training_sessions;
    expect(sessions.map(session => [session.academy_rider_id, session.personality_bonus_percentage])).toEqual([
      ["assidu", 5], ["other", 0], ["unknown", 0],
    ]);
    expect(upserts).toHaveLength(3);
    expect(sessions.every(session => Object.keys(session.rating_changes as Row).length > 0)).toBe(true);
    expect(queries.filter(query => query.table === "youth_academy_riders" && query.select)).toEqual([
      { table: "youth_academy_riders", select: "id, team_id, training_mode, pending_training_mode, pending_training_mode_after_season_id, pending_training_mode_after_day_number" },
      { table: "youth_academy_riders", select: "*" },
    ]);
    expect(queries.some(query => query.table === "riders")).toBe(false);

    const repeat = await settleDueYouthAutomaticTrainingSessions();
    expect(repeat.processedSessionCount).toBe(0);
    expect(tables.youth_academy_training_sessions).toHaveLength(3);
    expect(upserts).toHaveLength(3);
  });

  it("writes no applied bonus before automatic training is due", async () => {
    const { tables, upserts } = fixture();
    vi.setSystemTime(new Date("2026-11-27T06:00:00Z"));
    const result = await settleDueYouthAutomaticTrainingSessions();
    expect(result.processedSessionCount).toBe(0);
    expect(tables.youth_academy_training_sessions).toEqual([]);
    expect(upserts).toEqual([]);
  });
});
