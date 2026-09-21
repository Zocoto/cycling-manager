import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260921090000_rebalance_federation_equipment_catalog.sql",
  ),
  "utf8",
);

const EXPECTED_PROGRESSION = [
  ["dacatlon-collectif-national", 4, 9],
  ["axiom-union-national", 4, 11],
  ["korv-nordic-national", 5, 12],
  ["montclair-maison-national", 5, 14],
  ["meridian-horizon-national", 5, 16],
  ["aerion-equilibre-national", 5, 18],
  ["sylva-canopy-national", 6, 20],
  ["andes-cordillera-national", 6, 22],
  ["novaspoke-momentum-national", 6, 24],
  ["kernwerk-granit-national", 6, 26],
  ["velocita-squadra-national", 7, 28],
  ["brava-fulgor-national", 7, 30],
  ["kaze-hayate-national", 7, 32],
  ["echelon-grand-tour-national", 8, 34],
  ["altura-summit-national", 8, 37],
  ["vektor-vector-national", 8, 40],
  ["radian-apex-national", 8, 44],
] as const;

function readCatalogMetrics() {
  const metrics = new Map<
    string,
    { itemCount: number; totals: Map<string, number> }
  >();
  const itemPattern =
    /\('([^']+-national)', '([^']+)', '[^']+', '[^']+', '(\{[^']+\})', \d+\)[,;]/g;

  for (const match of migration.matchAll(itemPattern)) {
    const offerKey = match[1]!;
    if (!EXPECTED_PROGRESSION.some(([key]) => key === offerKey)) continue;
    const payload = JSON.parse(match[3]!) as {
      ratingBonuses?: Record<string, number>;
      timeTrialRatingBonuses?: Record<string, number>;
    };
    const metric = metrics.get(offerKey) ?? {
      itemCount: 0,
      totals: new Map<string, number>(),
    };
    metric.itemCount += 1;
    for (const bonuses of [
      payload.ratingBonuses ?? {},
      payload.timeTrialRatingBonuses ?? {},
    ]) {
      for (const [rating, value] of Object.entries(bonuses)) {
        metric.totals.set(rating, (metric.totals.get(rating) ?? 0) + value);
      }
    }
    metrics.set(offerKey, metric);
  }

  return metrics;
}

describe("federation equipment catalog rebalance", () => {
  it("adds every commercial shop brand alongside partner suppliers", () => {
    const commercialSupplierKeys = [
      "dacatlon-velo",
      "aerion-forge",
      "montclair-performance",
      "novaspoke-engineering",
      "echelon-cycles",
      "korv-safety-lab",
      "velocita-corse",
      "andes-endurance",
      "kaze-dynamics",
      "radian-raceworks",
    ];

    for (const supplierKey of commercialSupplierKeys) {
      expect(migration).toContain(`'${supplierKey}'`);
    }
  });

  it("enforces a strictly stronger and broader catalog as prices rise", () => {
    expect(migration).toContain(
      "lag(item_count) over (order by season_price)",
    );
    expect(migration).toContain(
      "lag(rating_total) over (order by season_price)",
    );
    expect(migration).toContain(
      "rating_total <= coalesce(previous_rating_total, 0)",
    );
    expect(migration).toContain("covered_stats < 8");
    expect(migration).toContain(
      "maximum_stat_total / nullif(rating_total, 0) > .30",
    );
  });

  it("recalculates the advertised progression from the actual payloads", () => {
    const metrics = readCatalogMetrics();

    for (const [offerKey, expectedItems, expectedTotal] of
      EXPECTED_PROGRESSION) {
      const metric = metrics.get(offerKey);
      expect(metric, offerKey).toBeDefined();
      expect(metric?.itemCount, offerKey).toBe(expectedItems);
      const ratingTotal = [...(metric?.totals.values() ?? [])].reduce(
        (total, value) => total + value,
        0,
      );
      expect(ratingTotal, offerKey).toBe(expectedTotal);
      expect(metric?.totals.size, offerKey).toBeGreaterThanOrEqual(8);
      expect(
        Math.max(...(metric?.totals.values() ?? [])) / ratingTotal,
        offerKey,
      ).toBeLessThanOrEqual(0.3);
    }
  });

  it("never mutates the immutable copies held by signed contracts", () => {
    expect(migration).toContain(
      "create temporary table federation_equipment_contract_snapshot",
    );
    expect(migration).toContain(
      "Le contrat fédéral signé % a été modifié.",
    );
    expect(migration).not.toMatch(
      /(?:update|delete from) public\.national_federation_equipment_contracts/,
    );
    expect(migration).not.toMatch(
      /(?:update|delete from) public\.national_federation_equipment_contract_items/,
    );
  });
});
