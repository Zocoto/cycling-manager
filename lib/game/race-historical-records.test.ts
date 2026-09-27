import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = read(
  "supabase/migrations/20260927190000_add_race_historical_records.sql",
).toLocaleLowerCase("fr-FR");
const service = read("services/race-calendar.ts");

describe("records historiques d’une course", () => {
  it("classe les victoires finales officielles en conservant les égalités", () => {
    expect(migration).toContain("result.final_rank = 1");
    expect(migration).toContain("result.status = 'classified'");
    expect(migration).toContain("edition.status = 'completed'");
    expect(migration).toContain("dense_rank() over");
    expect(migration).toContain("array_agg(");
  });

  it("compte les étapes uniquement pour les courses à étapes", () => {
    expect(migration).toContain("join public.stage_results");
    expect(migration).toContain("result.status = 'finished'");
    expect(migration).toContain("target_race.race_format = 'stage_race'");
  });

  it("expose les deux classements à la page d’inscription", () => {
    expect(service).toContain("getRaceHistoricalRecords");
    expect(service).toContain('record_type === "overall"');
    expect(service).toContain('record.record_type === "stage"');
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
