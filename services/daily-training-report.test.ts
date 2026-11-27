import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
import { getDailyJuniorTrainingReport, getDailySeniorTrainingReport } from "./daily-training-report";

type Row = Record<string, unknown>;

function fixture() {
  const identities = [
    { id: "saved", first_name: "A", last_name: "Snapshot", personality_key: "fidele" },
    { id: "zero", first_name: "B", last_name: "Zero", personality_key: "assidu" },
    { id: "legacy", first_name: "C", last_name: "Legacy", personality_key: "assidu" },
    { id: "skipped", first_name: "D", last_name: "Skipped", personality_key: "assidu" },
    { id: "absent", first_name: "E", last_name: "Absent", personality_key: "assidu" },
  ];
  const tables: Record<string, Row[]> = {
    sporting_directors: [{ id: "director", auth_user_id: "user", status: "active" }],
    team_manager_assignments: [{ sporting_director_id: "director", team_id: "team", role: "general_manager", status: "active" }],
    seasons: [{ id: "season", name: "Saison 5", current_day_number: 2, status: "active" }],
    team_seasons: [{ team_id: "team", season_id: "season", display_name: "Team" }],
    season_days: [{ id: "day", season_id: "season", day_number: 2, calendar_date: "2026-11-27" }],
    rider_contracts: identities.map(rider => ({ rider_id: rider.id, team_id: "team", status: "active" })),
    riders: identities,
    youth_academy_riders: identities.map(rider => ({ ...rider, team_id: "team", status: "active" })),
    rider_training_sessions: ["saved", "zero", "legacy", "skipped"].map((rider_id, index) => ({
      rider_id, team_id: "team", season_id: "season", season_day_id: "day",
      status: rider_id === "skipped" ? "skipped_low_form" : "completed",
      personality_bonus_percentage: ["5", 0, null, 5][index],
      rating_changes: { mountain: 1 }, form_before: 80, form_delta: -2, form_after: 78,
    })),
    youth_academy_training_sessions: ["saved", "saved", "zero", "legacy"].map((academy_rider_id, index) => ({
      academy_rider_id, season_id: "season", season_day_id: "day",
      training_mode: index === 0 ? "automatic" : "manual", slot: index === 0 ? "automatic" : "morning",
      game_type: null, personality_bonus_percentage: ["5", 0, 0, null][index],
      rating_changes: { mountain: 0.125 },
    })),
  };
  const queries: Array<{ table: string; select: string }> = [];
  const client = { from(table: string) {
    const request = { table, select: "" };
    queries.push(request);
    const filters: Array<(row: Row) => boolean> = [];
    const result = () => ({ data: (tables[table] ?? []).filter(row => filters.every(filter => filter(row))), error: null });
    const query = {
      select(columns: string) { request.select = columns; return query; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return query; },
      returns: async () => result(),
      maybeSingle: async () => ({ ...result(), data: result().data[0] ?? null }),
    };
    return query;
  } };
  mocks.admin.mockReturnValue(client);
  return { queries };
}

beforeEach(() => vi.clearAllMocks());

describe("daily training personality snapshots", () => {
  it("loads the recorded pro bonus and current legacy context in the existing batch reads", async () => {
    const { queries } = fixture();
    const report = await getDailySeniorTrainingReport("user");
    const riders = new Map(report?.riders.map(rider => [rider.riderId, rider]));
    expect(riders.get("saved")?.personalityBonus).toEqual({ percentage: 5, source: "session" });
    expect(riders.get("zero")?.personalityBonus).toBeNull();
    expect(riders.get("legacy")?.personalityBonus).toEqual({ percentage: 5, source: "current" });
    expect(riders.get("skipped")?.personalityBonus).toBeNull();
    expect(riders.get("absent")?.personalityBonus).toBeNull();
    expect(report?.totalPositiveChange).toBe(4);
    expect(queries.map(query => query.table)).toEqual([
      "sporting_directors", "team_manager_assignments", "seasons", "team_seasons", "season_days",
      "rider_contracts", "rider_training_sessions", "riders",
    ]);
    expect(queries.find(query => query.table === "rider_training_sessions")?.select).toContain("personality_bonus_percentage");
    expect(queries.find(query => query.table === "riders")?.select).toContain("personality_key");
  });

  it("keeps the applied junior session count distinct from the current character", async () => {
    const { queries } = fixture();
    const report = await getDailyJuniorTrainingReport("user");
    const riders = new Map(report?.riders.map(rider => [rider.riderId, rider]));
    expect(riders.get("saved")?.personalityBonus).toEqual({ percentage: 5, source: "session", sessionCount: 1, totalSessionCount: 2 });
    expect(riders.get("zero")?.personalityBonus).toBeNull();
    expect(riders.get("legacy")?.personalityBonus).toEqual({ percentage: 5, source: "current" });
    expect(riders.get("absent")?.personalityBonus).toBeNull();
    expect(report?.totalPositiveChange).toBe(4);
    expect(queries.map(query => query.table)).toEqual([
      "sporting_directors", "team_manager_assignments", "seasons", "team_seasons", "season_days",
      "youth_academy_riders", "youth_academy_training_sessions",
    ]);
    expect(queries.find(query => query.table === "youth_academy_training_sessions")?.select).toContain("personality_bonus_percentage");
    expect(queries.find(query => query.table === "youth_academy_riders")?.select).toContain("personality_key");
  });
});
