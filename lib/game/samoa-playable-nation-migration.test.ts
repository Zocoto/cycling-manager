import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260908150000_activate_samoa_as_playable_nation.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("activation de Samoa comme nation jouable", () => {
  it("active le pays ciblé sans élargir le référentiel entier", () => {
    expect(migration).toMatch(
      /update public\.countries\s+set is_active = true\s+where iso_alpha2 = 'WS'/,
    );
    expect(migration).not.toContain("where is_active = false");
  });

  it("restaure le profil indispensable à la génération des coureurs", () => {
    expect(migration).toContain(
      "insert into public.country_rider_generation_profiles",
    );
    expect(migration).toContain("'oceania'");
    expect(migration).toContain("on conflict (country_id)");
    expect(migration).toContain("Samoa n’a pas pu être activée");
  });
});
