import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const planner = read("components/game/race-equipment-planner.tsx");
const racePage = read("app/jeu/courses/[slug]/race-profile-content.tsx");
const actions = read("app/jeu/courses/[slug]/actions.ts");
const migration = read(
  "supabase/migrations/20260809101000_plan_race_stage_equipment.sql",
);

describe("planification du matériel de course", () => {
  it("explique la portée temporaire et garde le panneau compact", () => {
    expect(planner).toContain("Montage de course uniquement");
    expect(planner).toContain(
      "Ils ne modifient jamais l’équipement permanent du coureur.",
    );
    expect(planner).toContain("Appliquer au tour entier");
    expect(racePage).toContain("Composition verrouillée");
    expect(racePage).toContain('id="preparation"');
    expect(racePage).toContain("<details");
  });

  it("enregistre le plan par RPC et le transmet à la simulation", () => {
    expect(actions).toContain('"save_current_team_race_equipment_plan"');
    expect(migration).toContain(
      "create table public.race_stage_equipment_assignments",
    );
    expect(migration).toContain(
      "public.get_active_calendar_stage_equipment_effects",
    );
    expect(migration).toContain(
      "stage.departure_at > now() + interval '5 minutes'",
    );
  });

  it("ne modifie jamais les affectations permanentes", () => {
    expect(migration).not.toMatch(
      /(insert into|update|delete from)\s+public\.rider_equipment_assignments/i,
    );
    expect(migration).toContain(
      "Ne modifie jamais rider_equipment_assignments",
    );
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
