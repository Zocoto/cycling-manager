import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const migration = read(
  "supabase/migrations/20260920170000_create_federation_equipment_and_race_preparation.sql",
);
const roadGuardMigration = read(
  "supabase/migrations/20260925123000_allow_federation_international_road_preparation.sql",
);
const calendarService = read("services/race-calendar.ts");
const panel = read("components/game/federation-equipment-preparation-panel.tsx");
const assistant = read("lib/game/dashboard-assistant.ts");

describe("federation equipment and race preparation", () => {
  it("locks exactly one paid equipment contract per country and season", () => {
    expect(migration).toContain(
      "national_federation_equipment_contracts_country_season_unique",
    );
    expect(migration).toContain("Seul le président de la fédération");
    expect(migration).toContain("balance = balance - v_offer.season_price");
    expect(migration).toContain("'equipment'");
  });

  it("offers complete, indivisible packages from all seven partner brands", () => {
    for (const supplier of [
      "axiom-allroad",
      "meridian-endurance",
      "sylva-dynamics",
      "kernwerk-cycling",
      "brava-sprintworks",
      "altura-forge",
      "vektor-aerolab",
    ]) {
      expect(migration).toContain(`'${supplier}'`);
    }
    expect(migration).toContain("'frame'");
    expect(migration).toContain("'front_wheel'");
    expect(migration).toContain("'rear_wheel'");
  });

  it("applies the federation effects only through the international model", () => {
    expect(calendarService).toContain(
      "federationEquipmentEffectsByCountryId",
    );
    expect(calendarService).toContain(
      "if (nationalInternationalEditionIds.has(row.race_edition_id)) continue",
    );
    expect(migration).toContain(
      "get_national_federation_equipment_junior_stage_bonus",
    );
  });

  it("exposes president-only race plans without an equipment selector", () => {
    expect(migration).toContain(
      "save_national_federation_race_preparation",
    );
    expect(migration).toContain(
      "save_national_federation_time_trial_preparation",
    );
    expect(panel).toContain('mode="federation"');
    expect(panel).toContain("readOnly={!state.canManage}");
    expect(roadGuardMigration).toContain(
      "selection_list.status in ('pending_confirmation', 'finalized')",
    );
    expect(roadGuardMigration).toContain(
      "registration.team_season_id is null",
    );
  });

  it("reminds a president until the seasonal supplier is chosen", () => {
    expect(migration).toContain("get_current_federation_equipment_alert");
    expect(assistant).toContain("federation-equipment-selection");
  });
});
