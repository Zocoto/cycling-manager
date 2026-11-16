import { describe, expect, it, vi } from "vitest";

import type { RaceCalendarEdition } from "@/lib/game/race-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRaceEquipmentPlanningData } from "./race-equipment-planning";
import { getRiderEquipmentManagement } from "./team-equipment";

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

const edition: RaceCalendarEdition = {
  id: "edition",
  raceId: "race",
  slug: "race",
  name: "Test race",
  shortName: null,
  countryName: "Belgique",
  countryCode: "BE",
  categoryCode: "national",
  categoryName: "National",
  prestigeRank: 4,
  raceFormat: "one_day",
  competitionType: "standard",
  registrationClosesAt: null,
  wildcardClosesAt: null,
  withdrawalClosesAt: null,
  registrationPolicy: "open",
  minimumReputation: null,
  minimumRosterSize: 1,
  maximumRosterSize: 8,
  engagedRiderCount: 0,
  engagedRiders: [],
  currentTeamRegistration: null,
  stages: [{
    id: "stage",
    dayNumber: 8,
    stageNumber: 1,
    name: "Test stage",
    stageType: "road",
    status: "planned",
    profileType: "hilly",
    distanceKm: 180,
    daySlot: "early",
    departureAt: "2026-11-17T13:00:00Z",
    segments: [],
  }],
};

function product(id: string, slot: string) {
  return {
    id,
    catalog_key: id,
    name: id,
    slot_type: slot,
    supplier_key: "sylva-dynamics",
    supplier_name: "Sylva Dynamics",
    acquisition_channel: "equipment_partner",
  };
}

function mockEquipmentPartner(extraId: string | null) {
  const rows: Record<string, unknown> = {
    sporting_directors: { id: "director" },
    team_manager_assignments: { team_id: "team" },
    seasons: { id: "season", game_year: 5 },
    team_seasons: { id: "team-season", team_id: "team", currency: "EUR" },
    equipment_partner_contracts: {
      id: "contract",
      supplier_key: "sylva-dynamics",
      reputation_extra_item_id: extraId,
    },
    equipment_partner_products: [
      { equipment_item_id: "frame", offer_type: "core" },
      { equipment_item_id: "apex", offer_type: "rare" },
      { equipment_item_id: "other-glasses", offer_type: "rare" },
    ],
    equipment_catalog_items: [
      product("frame", "frame"),
      product("apex", "glasses"),
      product("other-glasses", "glasses"),
    ],
    equipment_partner_item_effects: extraId
      ? [{ equipment_item_id: extraId, effect_payload: { ratingBonuses: { hills: 3 } } }]
      : [],
    rider_contracts: [{ rider_id: "rider" }],
    riders: [{ id: "rider", first_name: "Alice", last_name: "Martin" }],
  };
  const client = {
    from(table: string) {
      const resolve = async () => ({ data: rows[table] ?? [], error: null });
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: resolve,
        returns: resolve,
      };
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const authenticatedClient = client as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createSupabaseAdminClient>);
  vi.mocked(createSupabaseServerClient).mockResolvedValue(authenticatedClient);
  return authenticatedClient;
}

describe("fourth equipment partner item", () => {
  it.each([null, "apex"])("exposes the paid item, and only that rare item, with purchase %s", async (extraId) => {
    const authenticatedClient = mockEquipmentPartner(extraId);
    const management = await getRiderEquipmentManagement("user", "rider");
    const planning = await getRaceEquipmentPlanningData({
      authUserId: "user",
      authenticatedClient,
      edition,
      riderIds: ["rider"],
      now: new Date("2026-11-16T13:00:00Z"),
    });
    const glasses = management?.availableBySlot.glasses;
    expect(glasses?.map(({ id }) => id)).toEqual(extraId ? ["apex"] : []);
    expect(planning?.catalog.map(({ id }) => id)).toEqual(extraId ? ["frame", "apex"] : ["frame"]);
    if (extraId) {
      expect(glasses?.[0]).toMatchObject({
        isUnlimited: true,
        ownedQuantity: 0,
        effects: { ratingBonuses: { hills: 3 } },
      });
      expect(planning?.catalog[1]).toMatchObject({ isUnlimited: true, ownedQuantity: 0 });
    }
  });
});
