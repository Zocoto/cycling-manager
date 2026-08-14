import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814070000_fix_race_registration_division_access.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

const raceProfile = readFileSync(
  resolve(process.cwd(), "app/jeu/courses/[slug]/race-profile-content.tsx"),
  "utf8",
);

describe("race registration context hotfix", () => {
  it("lets the private server client resolve the persisted team division", () => {
    expect(migration).toContain(
      "grant select on table public.divisions to service_role",
    );
    expect(migration).not.toMatch(
      /grant select on table public\.divisions to (?:anon|authenticated)/,
    );
  });

  it("keeps the registration panels focused on the roster action", () => {
    expect(raceProfile).not.toContain(
      "Votre nationalité n’entre pas dans les critères",
    );
    expect(raceProfile).not.toContain(
      "L&apos;arbitrage tient compte de la nationalit&eacute;",
    );
    expect(raceProfile).not.toContain(
      "celle du sponsor principal, la r&eacute;putation",
    );
  });
});
