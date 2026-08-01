import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260801190000_grant_rider_stage_condition_history.sql"),
  "utf8",
);

describe("permissions de l’historique de forme en course", () => {
  it("autorise le client serveur à lire les effets d’étape", () => {
    expect(migration).toContain(
      "grant select on table public.stage_rider_condition_effects to service_role;",
    );
  });
});
