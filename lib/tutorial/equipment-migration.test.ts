import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260728160000_create_equipment_tutorial.sql",
  ),
  "utf8",
);

describe("equipment tutorial migration", () => {
  it("crée les Lunettes didactiques avec un bonus END +1", () => {
    expect(migration).toContain("'tutorial-welcome-glasses'");
    expect(migration).toContain("'Lunettes didactiques'");
    expect(migration).toContain(`'{"ratingBonuses":{"endurance":1}}'::jsonb`);
  });

  it("accorde le cadeau via une fonction authentifiée et idempotente", () => {
    expect(migration).toContain(
      "public.grant_equipment_tutorial_welcome_gift()",
    );
    expect(migration).toContain("v_progress_metadata ->> 'welcomeGiftGranted'");
    expect(migration).toContain("'welcomeGiftGranted', true");
    expect(migration).toContain(
      "grant execute on function public.grant_equipment_tutorial_welcome_gift() to authenticated",
    );
  });
});
