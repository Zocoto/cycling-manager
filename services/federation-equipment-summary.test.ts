import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const service = readFileSync(
  join(process.cwd(), "services/federation-equipment.ts"),
  "utf8",
);
const panel = readFileSync(
  join(
    process.cwd(),
    "components/game/federation-equipment-preparation-panel.tsx",
  ),
  "utf8",
);

describe("federation equipment offer comparison", () => {
  it("derives comparable totals from normalized equipment effects", () => {
    expect(service).toContain("summarizeFederationEquipmentItems(items)");
    expect(service).toContain("getEquipmentRatingBonusTotals(effects)");
    expect(service).toContain("ratingBonusTotal:");
    expect(service).toContain("coveredRatingCount:");
  });

  it("shows the depth and breadth of every offer", () => {
    expect(panel).toContain("offer.items.length");
    expect(panel).toContain("offer.ratingBonusTotal");
    expect(panel).toContain("offer.coveredRatingCount");
    expect(panel).toContain("points techniques");
    expect(panel).toContain("caractéristiques couvertes");
  });
});
