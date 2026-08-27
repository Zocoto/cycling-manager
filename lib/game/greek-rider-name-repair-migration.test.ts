import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260827090000_repair_greek_generated_names.sql",
  ),
  "utf8",
);

describe("réparation des identités grecques générées", () => {
  it("retire explicitement la valeur tronquée Rm", () => {
    expect(migration).toContain("('Rm')");
    expect(migration).toContain("rider.last_name = 'Rm'");
    expect(migration).toContain("member.last_name = 'Rm'");
  });

  it("répare les identités générées sans toucher aux naturalisés", () => {
    expect(migration).toContain(
      "rider.generated_name_profile_code = 'greece'",
    );
    expect(migration).toContain("public.youth_scouting_candidates");
    expect(migration).toContain("public.youth_academy_riders");
    expect(migration).toContain("public.staff_members");
    expect(migration).toContain("public.staff_naturalizations");
  });

  it("synchronise les profils archivés après la réparation", () => {
    expect(migration).toContain("public.rider_history_archives");
    expect(migration).toContain(
      "archive.first_name is distinct from rider.first_name",
    );
  });
});
