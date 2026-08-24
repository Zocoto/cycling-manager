import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260824145000_rebalance_rider_salaries_by_recent_performance.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("nouveau barème salarial des coureurs", () => {
  it("interpôle la grille de moyenne générale validée", () => {
    expect(migration).toContain(
      "when v_overall <= 59 then 10000 + (v_overall - 55) / 4 * 4000",
    );
    expect(migration).toContain(
      "when v_overall <= 90 then 175000 + (v_overall - 85) / 5 * 65000",
    );
  });

  it("utilise des percentiles de la seule saison précédente", () => {
    expect(migration).toContain("percent_rank() over (");
    expect(migration).toContain(
      "where season.game_year = target_season.game_year - 1",
    );
    expect(migration).not.toContain("max(summary.points)");
  });

  it("applique les coefficients validés et le plafond", () => {
    expect(migration).toContain(
      "when least(1, greatest(0, p_percentile)) >= 0.99 then 1.70",
    );
    expect(migration).toContain("least(\n        400000,");
    expect(migration).toContain(") / 500\n  ) * 500");
  });

  it("recalcule uniquement les engagements encore modifiables", () => {
    expect(migration).toContain("where listing.status = 'open'");
    expect(migration).toContain("where contract.status = 'planned'");
    expect(migration).toContain("contract.acquisition_type = 'renewal'");
  });

  it("expose des devis groupés au serveur sans accès joueur direct", () => {
    expect(migration).toContain(
      "public.calculate_rider_season_salary_quotes",
    );
    expect(migration).toContain(
      "from public, anon, authenticated;",
    );
    expect(migration).toContain(") to service_role;");
    expect(migration).toContain("performance_population as (");
    expect(migration).not.toContain(
      "public.calculate_rider_season_salary(\n      requested.rider_id",
    );
  });
});
