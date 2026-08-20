import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260820200000_create_stage_unavailability_ledger.sql",
  ),
  "utf8",
);
const resultService = readFileSync(
  resolve(process.cwd(), "services/race-results.ts"),
  "utf8",
);
const simulationService = readFileSync(
  resolve(process.cwd(), "services/official-race-simulations.ts"),
  "utf8",
);

describe("registre sportif des non-partants", () => {
  it("est alimenté par le résultat de course et jamais par la Gazette", () => {
    expect(resultService).toContain('from("stage_rider_unavailabilities")');
    expect(simulationService).toContain(
      'from("stage_rider_unavailabilities")',
    );
    expect(simulationService).toContain("getRepairableStageRaceEditions");
    expect(simulationService).not.toContain(
      'edition.status === "in_progress"',
    );
    expect(migration).not.toContain("post_race_news_events");
  });

  it("reste immuable lors d'un recalcul", () => {
    expect(resultService).toContain("ignoreDuplicates: true");
    expect(resultService).not.toContain("le nettoyage des blessures obsolètes");
    expect(resultService.indexOf("le retrait des non-partants")).toBeLessThan(
      resultService.indexOf('.upsert(rows, { onConflict: "stage_id,race_roster_id" })'),
    );
  });

  it("répare les quatre indisponibilités confirmées de la Corsa", () => {
    for (const name of [
      "Arjan', 'Nikolić",
      "Zain', 'Chowdhury",
      "Mateus', 'Bérenger",
      "Daouda', 'Mensah",
    ]) {
      expect(migration).toContain(name);
    }
    expect(migration).toContain("race.slug = 'corsa-delle-regioni'");
    expect(migration).toContain("stage.stage_number = 9");
  });
});
