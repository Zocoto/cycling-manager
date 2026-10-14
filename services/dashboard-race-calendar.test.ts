import { describe, expect, it, vi } from "vitest";
import { getDashboardRaceCalendar } from "./dashboard-race-calendar";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

function calendarClient(failedTable?: string) {
  const editions = Array.from({ length: 241 }, (_, i) => ({ id: `edition-${i}`, race_id: `race-${i}`,
    race_category_id: "category", display_name: `Race ${i}`, status: "planned", registration_policy: "open" }));
  const rows: Record<string, Record<string, unknown>[]> = {
    race_editions: editions,
    races: editions.map(e => ({ id: e.race_id, country_id: "country", name: e.display_name,
      race_format: "classic", slug: e.id, competition_type: "standard" })),
    season_days: [{ id: "day", day_number: 8, calendar_date: "2026-10-15", label: null }],
    race_categories: [{ id: "category", code: "world", name: "World", prestige_rank: 1 }],
    countries: [{ id: "country", name: "France", iso_alpha2: "FR", continent_code: "EU" }],
    stages: editions.map(e => ({ id: `stage-${e.id}`, race_edition_id: e.id, season_day_id: "day",
      stage_number: 1, day_slot: "early", stage_type: "road", status: "planned", profile_type: "flat", distance_km: 120 })),
  };
  const filters: { table: string; ids: string[] }[] = [];
  const signals: AbortSignal[] = [];
  function query(table: string, data = rows[table] ?? []) {
    let selected = data;
    const q = {
      select: () => q, eq: () => q, neq: () => q, order: () => q,
      in: (column: string, ids: string[]) => {
        if (column === "id" || column === "race_edition_id") {
          filters.push({ table, ids });
          selected = selected.filter(row => ids.includes(String(row[column])));
        }
        return q;
      },
      abortSignal: (signal: AbortSignal) => { signals.push(signal); return q; },
      returns: () => Promise.resolve({ data: selected, error: table === failedTable ? { message: "network failure" } : null }),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: selected, error: null }).then(resolve),
    };
    return q;
  }
  const supabase = {
    from: vi.fn((table: string) => query(table)),
    rpc: vi.fn((name: string) => query(name, name === "get_current_team_visible_calendar_edition_ids"
      ? editions.map(e => ({ race_edition_id: e.id })) : [])),
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>;
  return { supabase, filters, signals };
}

describe("dashboard calendar bounded reads", () => {
  it("chunks every large UUID filter without losing races or stages and shares one deadline", async () => {
    const mock = calendarClient();
    const calendar = await getDashboardRaceCalendar(mock.supabase, { seasonId: "season", seasonName: "S4", currentDayNumber: 7 });
    expect(calendar.editions).toHaveLength(241);
    expect(calendar.editions.every(e => e.stages.length === 1)).toBe(true);
    for (const table of ["race_editions", "races", "stages"]) {
      expect(mock.filters.filter(f => f.table === table).map(f => f.ids.length)).toEqual([120, 120, 1]);
    }
    expect(new Set(mock.signals).size).toBe(1);
  });
  it("does not present an incomplete calendar as valid after a failed chunk", async () => {
    await expect(getDashboardRaceCalendar(calendarClient("stages").supabase,
      { seasonId: "season", seasonName: "S4", currentDayNumber: 7 })).rejects.toThrow("network failure");
  });
});
