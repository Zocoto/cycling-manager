import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260728123000_limit_elite_race_slot_overlap.sql",
  ),
  "utf8",
);

describe("elite calendar overlap migration", () => {
  it("déplace les deux classiques responsables des triples chevauchements", () => {
    expect(migration).toContain("('paves-de-zelande', 9, 'late')");
    expect(migration).toContain("('classique-des-lacs', 17, 'late')");
  });

  it("ne déplace que les courses d’un jour encore modifiables", () => {
    expect(migration).toContain("race.race_format = 'one_day'");
    expect(migration).toContain("stage.status = 'planned'");
    expect(migration).toContain(
      "edition.status not in ('in_progress', 'completed', 'cancelled')",
    );
    expect(migration).toContain("from public.stage_results as result");
  });

  it("recalcule le départ et les gels d’inscription", () => {
    expect(migration).toContain("when 'early' then time '14:00'");
    expect(migration).toContain("else time '18:00'");
    expect(migration).toContain("registration_closes_at =");
    expect(migration).toContain("withdrawal_closes_at =");
  });

  it("refuse tout créneau futur contenant plus de deux courses Élites", () => {
    expect(migration).toContain("category.code = 'elite'");
    expect(migration).toContain("having count(*) > 2");
    expect(migration).toContain("raise exception");
  });
});
