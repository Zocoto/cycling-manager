import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const resultService = readFileSync(
  resolve(process.cwd(), "services/race-results.ts"),
  "utf8",
);

describe("official stage result immutability", () => {
  it("never replaces an homologated stage because a later simulation changed", () => {
    expect(resultService).toContain(
      "const stageAlreadyHomologated = stageRows.length > 0",
    );
    expect(resultService).toContain("if (!stageAlreadyHomologated) {");
    expect(resultService).not.toContain("persistedRanksMatchSimulation");
    expect(resultService).not.toContain("expectedRankByRosterId");
  });

  it("blocks automatic simulation relocking once any stage result exists", () => {
    expect(resultService).toContain("hasAnyPersistedStageResults(");
    expect(resultService).toContain(
      "mais des résultats d'étape sont déjà homologués",
    );

    const relockCall = resultService.indexOf(
      "editionSimulations = await relockEditionOfficialSimulations({",
    );
    const immutableGuard = resultService.lastIndexOf(
      "if (hasHomologatedStageResults)",
      relockCall,
    );

    expect(immutableGuard).toBeGreaterThan(-1);
    expect(immutableGuard).toBeLessThan(relockCall);
  });
});
