import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260826110000_add_national_day_daily_auctions.sql",
  ),
  "utf8",
);

describe("enchères des fêtes nationales", () => {
  it("borne les journées partagées à 35 annonces", () => {
    expect(migration).toContain("rider_count in (5, 10, 15, 20, 25, 30, 35)");
    expect(migration).toContain("daily_slot between 1 and 35");
    expect(migration).toContain("having count(*) <> 5");
  });

  it("renforce légèrement les statistiques et le potentiel", () => {
    expect(migration).toContain(
      "v_stat_minimum := case when v_is_national_day_bonus then 44 else 42 end",
    );
    expect(migration).toContain(
      "v_overall_cap := case when v_is_national_day_bonus then 67 else 65 end",
    );
    expect(migration).toContain("p_generation_source = 'national_day_auction'");
  });

  it("accorde rarement une capacité innée sans capacités réservées", () => {
    expect(migration).toContain("'national_day_ability_roll'");
    expect(migration).toContain(") < 40 then");
    expect(migration).not.toContain("'first_in_class',");
    expect(migration).not.toContain("'homegrown',");
  });

  it("conserve le masquage de scouting et expose seulement le marquage bonus", () => {
    const service = readFileSync(
      resolve(process.cwd(), "services/transfer-market.ts"),
      "utf8",
    );
    const page = readFileSync(
      resolve(process.cwd(), "app/jeu/transferts/page.tsx"),
      "utf8",
    );

    expect(service).toContain("is_national_day_bonus");
    expect(page).toContain("TransferScoutingReportPanel");
    expect(page).toContain("Sélection fête nationale");
    expect(page).toContain("getNationalChampionPalette");
  });
});
