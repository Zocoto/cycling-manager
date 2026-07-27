import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260727210000_create_rider_naturalization.sql",
  ),
  "utf8",
);

describe("naturalization migration", () => {
  it("impose 84 jours aux professionnels et 28 jours aux juniors", () => {
    expect(migration).toContain("if v_elapsed_days < 84 then");
    expect(migration).toContain("if v_elapsed_days < 28 then");
    expect(migration).toContain("joined_day_number");
  });

  it("bloque tout ancien champion national route ou CLM", () => {
    expect(migration).toContain(
      "from public.rider_national_championship_titles as title",
    );
    expect(migration).toContain(
      "title.championship_type in ('road', 'time_trial')",
    );
    expect(migration).toContain("définitivement attaché");
  });

  it("limite les mutations aux coureurs de l’équipe authentifiée", () => {
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain("contract.team_id = v_context.team_id");
    expect(migration).toContain("academy.team_id = v_context.team_id");
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("conserve une trace de chaque changement de nationalité", () => {
    expect(migration).toContain(
      "create table public.rider_naturalizations",
    );
    expect(migration).toContain("'professional'");
    expect(migration).toContain("'youth'");
  });
});
