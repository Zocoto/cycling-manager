import { beforeEach, describe, expect, it, vi } from "vitest";

import { RIDER_RATING_AXES, type RiderRatings } from "@/lib/game/rider-profile";
import { createStandardTransferScoutingReport } from "@/lib/game/transfer-scouting";
import { getPublicRiderProfile } from "@/services/public-rider-profile";
import { getRiderQuickPreview } from "@/services/rider-quick-preview";
import { getViewerScoutingVisibility } from "@/services/scouting-visibility";

const mocks = vi.hoisted(() => ({ createAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));
vi.mock("@/services/archived-rider-profile", () => ({ getArchivedRiderProfile: vi.fn(async () => null) }));
vi.mock("@/services/rider-development-history", () => ({ getRiderDevelopmentHistory: vi.fn(async () => []) }));
vi.mock("@/services/rider-equipment-effects", () => ({ getRiderEquipmentEffectsByRiderId: vi.fn(async () => new Map()) }));

const riderId = "11111111-2222-4333-8444-555555555555";
const seasonId = "season-4";
const ratings: RiderRatings = {
  mountain: 64, hills: 71, recovery: 58, endurance: 67, resistance: 62,
  breakaway: 55, downhill: 69, acceleration: 73, sprint: 61, flat: 66,
  cobbles: 52, prologue: 57, timeTrial: 63,
};
type Row = Record<string, unknown>;

function fixture({ level = 1, teamId = null, revealUntil = null, director = true, assignment = true, infrastructureError = false }: {
  level?: number;
  teamId?: string | null;
  revealUntil?: string | null;
  director?: boolean;
  assignment?: boolean;
  infrastructureError?: boolean;
} = {}) {
  const tables: Record<string, Row[]> = {
    riders: [{ id: riderId, country_id: "fr", first_name: "Test", last_name: "Coureur", status: teamId ? "active" : "free_agent", potential_steps: 6, avatar_seed: 1, avatar_profile_key: "default", career_race_days: 0 }],
    countries: [{ id: "fr", name: "France", iso_alpha2: "FR" }],
    seasons: [{ id: seasonId, game_year: 4, name: "Saison 4", status: "active", current_day_number: 4 }],
    rider_season_ratings: [{ rider_id: riderId, season_id: seasonId, age: 24, ...ratings, time_trial: ratings.timeTrial }],
    sporting_directors: director ? [{ id: "director", auth_user_id: "viewer", status: "active" }] : [],
    team_manager_assignments: assignment ? [{ id: "assignment", sporting_director_id: "director", team_id: "viewer-team", role: "general_manager", status: "active" }] : [],
    team_seasons: [
      { id: "viewer-season", team_id: "viewer-team", season_id: seasonId, status: "active", display_name: "Équipe du lecteur", scouting_reports_revealed_until: revealUntil },
      { id: "other-season", team_id: "other-team", season_id: seasonId, status: "active", display_name: "Équipe du coureur", scouting_reports_revealed_until: null },
    ],
    team_infrastructures: [
      ...(level > 0 ? [{ team_id: "viewer-team", infrastructure_code: "recruitment_data_room", level }] : []),
      { team_id: "other-team", infrastructure_code: "recruitment_data_room", level: 3 },
    ],
    transfer_market_listings: [{ id: "listing", rider_id: riderId, status: "open" }],
    rider_contracts: teamId ? [{ rider_id: riderId, team_id: teamId, status: "active", start_season_id: seasonId, end_season_id: seasonId, currency_code: "EUR", salary_per_season: 100_000 }] : [],
    teams: ["viewer-team", "other-team"].map((id) => ({ id, internal_name: id, amateur_name: null })),
  };
  const queries: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    const filters: Array<[string, unknown]> = [];
    queries.push({ table, filters });
    const error = infrastructureError && table === "team_infrastructures" ? { message: "lecture indisponible" } : null;
    const query = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        rows = rows.filter((row) => row[column] === value);
        return query;
      }),
      in: vi.fn((column: string, values: unknown[]) => {
        rows = rows.filter((row) => values.includes(row[column]));
        return query;
      }),
      maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error })),
      returns: vi.fn(async () => ({ data: rows, error })),
    };
    return query;
  });
  const admin = { from } as unknown as Parameters<typeof getViewerScoutingVisibility>[0]["admin"];
  mocks.createAdmin.mockReturnValue(admin);
  return { admin, queries, tables };
}

beforeEach(() => vi.clearAllMocks());

describe("cohérence du scouting Data Room", () => {
  it.each([
    [0, 3, 6, 4], [1, 3, 8, 2], [2, 5, 8, 0], [3, 7, 6, 0],
  ])("applique le niveau %i à la fiche et au survol comme au marché", async (level, exact, range, unknown) => {
    const { queries } = fixture({ level });
    const input = { riderIdentifier: riderId, viewerAuthUserId: "viewer" };
    const profile = await getPublicRiderProfile(input);
    const preview = await getRiderQuickPreview(input);
    const marketReport = createStandardTransferScoutingReport({ riderId, seasonId, ratings, potentialSteps: 6, dataRoomLevel: level });

    expect(profile?.scoutingReport).toEqual(marketReport);
    expect(preview?.ratings).toEqual(marketReport.ratings);
    expect(preview?.scoutedPotential).toEqual(marketReport.potential);
    expect(profile?.potentialSteps).toBeNull();
    expect(preview?.potentialSteps).toBeNull();
    const values = RIDER_RATING_AXES.map((axis) => preview!.ratings![axis.key]);
    expect(values.filter((value) => value.kind === "exact")).toHaveLength(exact);
    expect(values.filter((value) => value.kind === "range")).toHaveLength(range);
    expect(values.filter((value) => value.kind === "unknown")).toHaveLength(unknown);
    if (level > 0) expect(preview?.scoutedPotential?.kind).toBe("range");
    for (const query of queries.filter((query) => query.table === "team_infrastructures")) {
      expect(query.filters).toContainEqual(["team_id", "viewer-team"]);
      expect(query.filters).toContainEqual(["infrastructure_code", "recruitment_data_room"]);
    }
  });

  it("utilise la Data Room du lecteur, pas celle de l’équipe du coureur", async () => {
    fixture({ level: 1, teamId: "other-team" });
    const input = { riderIdentifier: riderId, viewerAuthUserId: "viewer" };
    const profile = await getPublicRiderProfile(input);
    const preview = await getRiderQuickPreview(input);
    expect(profile?.scoutingReport?.ratings).toEqual(preview?.ratings);
    expect(Object.values(preview!.ratings!).filter((value) => value.kind === "unknown")).toHaveLength(2);
    expect(preview?.potentialSteps).toBeNull();
    expect(preview?.scoutedPotential?.kind).toBe("range");
  });

  it("préserve la révélation exacte d’un coureur libre avec la Loupe", async () => {
    fixture({ revealUntil: "2099-01-01T12:00:00.000Z" });
    const input = { riderIdentifier: riderId, viewerAuthUserId: "viewer" };
    const profile = await getPublicRiderProfile(input);
    const preview = await getRiderQuickPreview(input);
    expect(profile?.scoutingReport?.potential).toEqual({ kind: "exact", steps: 6 });
    expect(preview?.scoutedPotential).toEqual({ kind: "exact", steps: 6 });
    expect(preview?.potentialSteps).toBe(6);
    expect(Object.values(preview!.ratings!).every((value) => value.kind === "exact")).toBe(true);
  });

  it("ne révèle pas le potentiel exact d’une équipe adverse avec la Loupe", async () => {
    fixture({ teamId: "other-team", revealUntil: "2099-01-01T12:00:00.000Z" });
    const input = { riderIdentifier: riderId, viewerAuthUserId: "viewer" };
    const profile = await getPublicRiderProfile(input);
    const preview = await getRiderQuickPreview(input);
    expect(profile?.potentialSteps).toBeNull();
    expect(profile?.scoutingReport?.potential.kind).toBe("range");
    expect(preview?.potentialSteps).toBeNull();
    expect(preview?.scoutedPotential?.kind).toBe("range");
  });

  it("conserve les informations exactes pour le propriétaire", async () => {
    fixture({ teamId: "viewer-team" });
    const input = { riderIdentifier: riderId, viewerAuthUserId: "viewer" };
    const profile = await getPublicRiderProfile(input);
    const preview = await getRiderQuickPreview(input);
    expect(profile?.scoutingReport).toBeNull();
    expect(profile?.ratings).toEqual(ratings);
    expect(profile?.potentialSteps).toBe(6);
    expect(preview?.scoutedPotential).toEqual({ kind: "exact", steps: 6 });
  });

  it.each([{ director: false }, { assignment: false }])("revient au niveau 0 sans équipe gérée : %j", async (options) => {
    const { admin, queries } = fixture(options);
    expect(await getViewerScoutingVisibility({ admin, authUserId: "viewer", seasonId })).toEqual({ active: false, activeUntil: null, dataRoomLevel: 0 });
    expect(queries.some((query) => query.table === "team_infrastructures")).toBe(false);
  });

  it("ne masque pas un échec de lecture en prétendant que la Data Room est absente", async () => {
    const { admin } = fixture({ infrastructureError: true });
    await expect(getViewerScoutingVisibility({ admin, authUserId: "viewer", seasonId })).rejects.toThrow("Data Room");
  });
});
