import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const service = readFileSync(
  resolve(process.cwd(), "services/persisted-sponsor-objectives.ts"),
  "utf8",
);

describe("legacy sponsor objective modernization", () => {
  it("conserve les identifiants parents pendant le passage de 7 à 10 objectifs", () => {
    expect(service).toContain("modernizeLegacyObjectiveWeights");
    expect(service).not.toMatch(
      /from\("sponsor_objectives"\)[\s\S]{0,120}\.delete\(\)/,
    );
  });

  it("recalcule les poids selon le portefeuille du sponsor", () => {
    expect(service).toContain(
      "satisfaction_points: matchedObjective.satisfactionPoints",
    );
    expect(service).toContain(
      "priority: matchedObjective.priority",
    );
  });
});
