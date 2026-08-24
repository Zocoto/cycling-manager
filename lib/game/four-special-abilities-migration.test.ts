import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260824210000_add_four_special_abilities.sql",
  ),
  "utf8",
);

describe("four special abilities migration", () => {
  it("enregistre les quatre capacités et leurs médaillons épiques", () => {
    for (const code of [
      "pistard",
      "three_lungs",
      "cyclocrossman",
      "metronome",
    ]) {
      expect(migration).toContain(`'${code}'`);
      expect(migration).toContain(`'medallion-${code.replaceAll("_", "-")}'`);
      expect(migration).toContain(`'{"abilityCode":"${code}"}'::jsonb`);
    }

    expect(migration.match(/'epic'/g)).toHaveLength(4);
  });

  it("applique Trois poumons avant le kiné puis la cryothérapie", () => {
    expect(migration).toContain(
      "abs(p_form_delta) - least(abs(p_form_delta) * 0.25, 4)",
    );
    expect(migration).toContain(
      "apply_three_lungs_form_delta(v_rider.id, v_form_delta)",
    );
    expect(migration).toContain(
      "apply_three_lungs_form_delta(new.rider_id,new.form_delta)",
    );
    expect(migration).toContain("v_original:=new.form_delta");
  });

  it("garde les blocs SQL équilibrés", () => {
    expect((migration.match(/\$\$/g)?.length ?? 0) % 2).toBe(0);
    expect((migration.match(/\$migration\$/g)?.length ?? 0) % 2).toBe(0);
  });
});
