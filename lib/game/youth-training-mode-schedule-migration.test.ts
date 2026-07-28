import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260728100000_schedule_youth_training_mode_changes.sql",
  ),
  "utf8",
);

describe("youth training mode schedule migration", () => {
  it("conserve le mode choisi pour la prochaine journée et les suivantes", () => {
    expect(migration).toContain("pending_training_mode text");
    expect(migration).toContain(
      "pending_training_mode_after_day_number =\n        v_current_day_number + 1",
    );
    expect(migration).toContain(
      "activate_due_youth_training_modes",
    );
  });

  it("ne limite plus le réglage à l’absence de séance du jour", () => {
    expect(migration).not.toContain(
      "Cette programmation pourra être modifiée demain",
    );
    expect(migration).toContain(
      "extract(hour from now() at time zone 'Europe/Paris') >= 8",
    );
  });

  it("active une programmation échue avant de lancer un minijeu", () => {
    const activationIndex = migration.indexOf(
      "perform public.activate_due_youth_training_modes(",
      migration.indexOf(
        "create or replace function public.start_current_youth_training_attempt(",
      ),
    );
    const launchIndex = migration.indexOf(
      "return public.start_current_youth_training_attempt_immediate(",
    );

    expect(activationIndex).toBeGreaterThan(-1);
    expect(launchIndex).toBeGreaterThan(activationIndex);
  });
});
