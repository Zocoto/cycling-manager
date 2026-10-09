import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => mock,
}));
import { getCurrentTeamRiderSeasonPlanning } from "./rider-season-planning";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let rejectedTable: string | null;
let filters: { table: string; key: string; values: unknown[] }[];

beforeEach(() => {
  rejectedTable = null;
  filters = [];
  tables = {
    sporting_directors: [{ id: "ds", auth_user_id: "user", status: "active" }],
    team_manager_assignments: [{ team_id: "team", sporting_director_id: "ds", role: "general_manager", status: "active" }],
    seasons: [{ id: "season", name: "S4", status: "active", current_day_number: 1 }],
    team_seasons: [{ id: "team-season", team_id: "team", season_id: "season", display_name: "Équipe" }],
    season_days: Array.from({ length: 28 }, (_, i) => ({ id: `day-${i + 1}`, season_id: "season", day_number: i + 1, calendar_date: `2026-10-${String(i + 1).padStart(2, "0")}` })),
    rider_contracts: [{ rider_id: "rider", team_id: "team", status: "active" }],
    riders: [{ id: "rider", country_id: "fr", first_name: "Test", last_name: "Coureur", avatar_profile_key: null, avatar_seed: null }],
    rider_season_ratings: [{ rider_id: "rider", season_id: "season", age: 25 }],
    countries: [{ id: "fr", name: "France", iso_alpha2: "FR" }],
    race_categories: [{ id: "category", code: "regional", name: "Régionale" }],
    race_editions: [], races: [], stages: [], race_registrations: [],
    race_rosters: [], national_federation_selection_race_links: [],
    rider_form_camps: [], rider_injuries: [], stage_reconnaissances: [],
    stage_reconnaissance_riders: [],
  };
  mock.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  mock.from.mockReset().mockImplementation((table: string) => {
    let rows = [...(tables[table] ?? [])];
    let bounds: [number, number] = [0, 999];
    let oversized = false;
    const result = () => ({
      data: oversized || rejectedTable === table ? null : rows.slice(bounds[0], bounds[1] + 1),
      error: oversized || rejectedTable === table ? { message: "Bad Request" } : null,
    });
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return query; },
      neq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] !== value); return query; },
      gt: (key: string, value: string) => { rows = rows.filter((row) => String(row[key]) > value); return query; },
      in: (key: string, values: unknown[]) => {
        filters.push({ table, key, values });
        oversized ||= values.length > 75;
        rows = rows.filter((row) => values.includes(row[key]));
        return query;
      },
      order: (key: string) => { rows.sort((a, b) => String(a[key]).localeCompare(String(b[key]))); return query; },
      range: (from: number, to: number) => { bounds = [from, to]; return query; },
      returns: () => query,
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolveResult: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolveResult),
    };
    return query;
  });
});

function addCalendar(count: number, stagesPerRace = 1) {
  for (let i = 0; i < count; i++) {
    const suffix = String(i).padStart(5, "0");
    const editionId = `edition-${suffix}`;
    const raceId = `race-${suffix}`;
    tables.race_editions.push({ id: editionId, race_id: raceId, race_category_id: "category", display_name: `Course ${i}`, status: "scheduled", season_id: "season" });
    tables.races.push({ id: raceId, name: `Course ${i}`, slug: raceId, race_format: stagesPerRace > 1 ? "stage_race" : "one_day" });
    for (let stage = 1; stage <= stagesPerRace; stage++) {
      tables.stages.push({ id: `stage-${suffix}-${String(stage).padStart(2, "0")}`, race_edition_id: editionId, season_day_id: `day-${stage}`, stage_number: stage, name: `Étape ${stage}`, status: "scheduled" });
    }
  }
}

function register(index: number, federation = false) {
  const editionId = `edition-${String(index).padStart(5, "0")}`;
  const id = `registration-${index}`;
  tables.race_registrations.push({ id, race_edition_id: editionId, team_season_id: federation ? "federation" : "team-season", status: "accepted" });
  tables.race_rosters.push({ rider_id: "rider", race_registration_id: id, status: "confirmed" });
  if (federation) tables.national_federation_selection_race_links.push({ race_registration_id: id, race_edition_id: editionId });
}

describe("planning des coureurs avec un grand calendrier", () => {
  it("charge les dernières courses sans envoyer de filtre surdimensionné", async () => {
    addCalendar(425);
    register(424);
    const planning = await getCurrentTeamRiderSeasonPlanning({ authUserId: "user", riderId: "rider" });
    expect(planning?.riders[0].events).toMatchObject([{ title: "Course 424", startDay: 1, endDay: 1, href: "/jeu/courses/race-00424" }]);
    expect(filters.filter(({ table }) => table === "races" || table === "stages").every(({ values }) => values.length <= 75)).toBe(true);
  });

  it("ne tronque pas les éditions au-delà de 1 000 lignes", async () => {
    addCalendar(1_205);
    register(1_204);
    const planning = await getCurrentTeamRiderSeasonPlanning({ authUserId: "user" });
    expect(planning?.riders[0].events).toMatchObject([{ title: "Course 1204", startDay: 1, endDay: 1 }]);
  });

  it("charge toutes les étapes lorsqu'un lot dépasse 1 000 lignes", async () => {
    addCalendar(75, 20);
    for (let index = 0; index < 75; index++) register(index);
    const planning = await getCurrentTeamRiderSeasonPlanning({ authUserId: "user" });
    expect(planning?.riders[0].events).toHaveLength(75);
    expect(planning?.riders[0].events.find((event) => event.title === "Course 74"))
      .toMatchObject({ title: "Course 74", startDay: 1, endDay: 20 });
  });

  it("conserve les sélections nationales et exclut les étapes annulées", async () => {
    addCalendar(80, 2);
    register(79, true);
    tables.stages[tables.stages.length - 1].status = "cancelled";
    const planning = await getCurrentTeamRiderSeasonPlanning({ authUserId: "user", riderId: "rider" });
    expect(planning?.riders[0].events).toMatchObject([{ title: "Course 79", startDay: 1, endDay: 1 }]);
  });

  it("remonte une erreur réelle au lieu de fournir un planning partiel", async () => {
    addCalendar(80);
    register(0);
    rejectedTable = "stages";
    await expect(getCurrentTeamRiderSeasonPlanning({ authUserId: "user", riderId: "rider" })).rejects.toThrow("Impossible de charger les étapes : Bad Request");
  });

  it("ne charge pas les relations du calendrier pour un effectif vide", async () => {
    addCalendar(80);
    tables.rider_contracts = [];
    const planning = await getCurrentTeamRiderSeasonPlanning({ authUserId: "user" });
    expect(planning?.riders).toEqual([]);
    expect(mock.from.mock.calls.some(([table]) => table === "races" || table === "stages")).toBe(false);
  });

  it("contient une panne du planning dans son bloc sans faire échouer toute la fiche", () => {
    const source = readFileSync(resolve(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"), "utf8");
    expect(source).toMatch(/const planning = await getCurrentTeamRiderSeasonPlanning\([\s\S]*?\.catch\(\(error: unknown\) => \{[\s\S]*?return null;/);
    expect(source).toContain("Le programme de la saison est momentanément indisponible.");
  });
});
