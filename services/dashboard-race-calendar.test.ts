import { describe, expect, it, vi } from "vitest";
import { getDashboardRaceCalendar } from "./dashboard-race-calendar";
import { getRaceProfileLabel } from "@/lib/game/race-calendar";
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
    stages: editions.map((e,i) => ({ id: `stage-${e.id}`, race_edition_id: e.id, season_day_id: "day",
      stage_number: 1, day_slot: "early", stage_type: "road", status: "planned", profile_type: i===0?"cobbles":"flat",
      profile_variant:i===0?"sprint_cobbles":i===1?"hilly_cobbles":null,
      ...(i===1?{profile_type:"hilly"}:{}),distance_km: 120 })),
    get_current_team_visible_calendar_edition_ids: editions.map((edition) => ({ race_edition_id: edition.id })),
    get_current_team_calendar_sponsor_objective_races: [
      { race_edition_id: "edition-0", sponsor_role: "principal" },
      { race_edition_id: "edition-1", sponsor_role: "secondary" },
      { race_edition_id: "edition-2", sponsor_role: "principal" },
      { race_edition_id: "edition-2", sponsor_role: "secondary" },
    ],
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
    rpc: vi.fn((name: string) => query(name)),
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>;
  return { supabase, filters, signals };
}

describe("dashboard calendar bounded reads", () => {
  it("shows the cobbled variant without loading segments or changing the sporting profile", async () => {
    const mock=calendarClient();
    const calendar=await getDashboardRaceCalendar(mock.supabase,{seasonId:"season",seasonName:"S5",currentDayNumber:7});
    const stage=calendar.editions.flatMap(e=>e.stages).find(s=>s.id==="stage-edition-0")!;
    expect(stage.profileType).toBe("cobbles");
    expect(getRaceProfileLabel(stage)).toBe("Sprint / Pavé");
    const hybrid=calendar.editions.flatMap(e=>e.stages).find(s=>s.id==="stage-edition-1")!;
    expect(hybrid.profileType).toBe("hilly");
    expect(getRaceProfileLabel(hybrid)).toBe("Pavé / Vallonné");
    expect(mock.supabase.from).not.toHaveBeenCalledWith("stage_segments");
  });
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
  it("reads both sponsor roles with a single call and preserves double objectives", async () => {
    const mock = calendarClient();
    const calendar = await getDashboardRaceCalendar(mock.supabase, { seasonId: "season", seasonName: "S5", currentDayNumber: 7 });
    expect(calendar.editions.slice(0, 4).map((edition) => [
      edition.id,
      edition.isSponsorObjective,
      Boolean(edition.isSecondarySponsorObjective),
    ])).toEqual([
      ["edition-0", true, false],
      ["edition-1", false, true],
      ["edition-2", true, true],
      ["edition-3", false, false],
    ]);
    expect(vi.mocked(mock.supabase.rpc).mock.calls.filter(([name]) => name.includes("sponsor_objective"))).toEqual([
      ["get_current_team_calendar_sponsor_objective_races"],
    ]);
  });
  it("does not present an incomplete calendar as valid after a failed chunk", async () => {
    await expect(getDashboardRaceCalendar(calendarClient("stages").supabase,
      { seasonId: "season", seasonName: "S4", currentDayNumber: 7 })).rejects.toThrow("network failure");
  });
});
