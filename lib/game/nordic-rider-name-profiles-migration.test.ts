import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260822000000_refine_nordic_rider_name_profiles.sql",
  ),
  "utf8",
);

describe("profils nationaux de noms nordiques", () => {
  it.each([
    ["DK", "denmark"],
    ["FI", "finland"],
    ["IS", "iceland"],
    ["NO", "norway"],
    ["SE", "sweden"],
  ])("raccorde %s au profil %s", (countryCode, profileCode) => {
    expect(migration).toContain(`('${countryCode}', '${profileCode}')`);
    expect(migration).toContain(`('${profileCode}',`);
  });

  it("préserve les identités historiques du profil nordique", () => {
    expect(migration).toContain("Europe nordique (profil historique)");
    expect(migration).not.toContain("update public.riders");
    expect(migration).not.toContain("delete from public.rider_name_profiles");
  });
});
