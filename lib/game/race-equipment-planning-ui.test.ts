import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const planner = read("components/game/race-equipment-planner.tsx");
const preparationWorkspace = read(
  "components/game/race-preparation-workspace.tsx",
);
const preparationPage = read("app/jeu/preparation-course/page.tsx");
const racePage = read("app/jeu/courses/[slug]/race-profile-content.tsx");
const actions = read("app/jeu/preparation-course/actions.ts");
const calendarService = read("services/race-calendar.ts");
const simulationAdapter = read("lib/game/race-simulation-demo.ts");
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
    expect(preparationWorkspace).toContain("<RaceEquipmentPlanner");
    expect(preparationWorkspace).toContain("Équipements de l’étape");
    expect(preparationWorkspace).toContain("fixedStageId={stage.id}");
    expect(preparationWorkspace.indexOf("StageProfileOverview")).toBeLessThan(
      preparationWorkspace.indexOf("StageEquipmentSection"),
    );
    expect(racePage).not.toContain("RaceEquipmentPlanner");
    expect(preparationPage).toContain("getRaceEquipmentPlanningDataBatch");
  });

  it("ferme la préparation et l’inscription quand la course est terminée", () => {
    expect(preparationPage).toContain('status === "scheduled"');
    expect(preparationPage).not.toContain(
      'status === "scheduled" || status === "live"',
    );
    expect(racePage).toContain("Inscription archivée");
    expect(racePage).toContain("isRaceFinished");
  });

  it("enregistre le plan par RPC et le transmet à la simulation", () => {
    expect(actions).toContain('"save_current_team_race_equipment_plan"');
    expect(migration).toContain(
      "create table public.race_stage_equipment_assignments",
    );
    expect(migration).toContain(
      "public.get_active_calendar_stage_equipment_effects",
    );
    expect(calendarService).toContain(
      '"get_active_calendar_stage_equipment_effects"',
    );
    expect(simulationAdapter).toContain(
      "equipmentEffectsByStageId?.[stage.id]",
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

  it("grise le stock épuisé et affiche les bonus dans chaque option", () => {
    expect(planner).toContain("disabled={!isAvailable}");
    expect(planner).toContain("isRaceEquipmentItemSelectable");
    expect(planner).toContain("formatRaceEquipmentOptionLabel");
    expect(planner).toContain("effectSummary: item.effectSummary");
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
