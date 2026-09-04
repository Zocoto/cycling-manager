import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../services/persisted-sponsor-objectives.ts", import.meta.url),
  "utf8",
);

describe("chargement des relations des objectifs sponsor", () => {
  it("fragmente les longues listes de courses et d'éditions", () => {
    expect(source).toContain("SPONSOR_OBJECTIVE_RELATION_BATCH_SIZE = 75");
    expect(source).toContain("for (const raceIdBatch of splitIntoBatches(");
    expect(source).toContain(".in(\"id\", raceIdBatch)");
    expect(source).toContain("for (const editionIdBatch of splitIntoBatches(");
    expect(source).toContain(".in(\"race_edition_id\", editionIdBatch)");
  });
});
