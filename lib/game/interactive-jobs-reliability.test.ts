import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

const migration = read(
  "supabase/migrations/20260827120000_fix_interactive_jobs_reliability.sql",
);
const healthActions = read("app/jeu/centre-de-soin/actions.ts");
const equipmentActions = read("app/jeu/materiel/actions.ts");
const maintenanceService = read("services/game-state-settlement.ts");
const vercelConfig = read("vercel.json");

describe("fiabilité des stages et des montages de matériel", () => {
  it("retire le règlement global de santé de toutes les actions interactives concernées", () => {
    for (const signature of [
      "public.apply_current_team_injury_protocol(uuid,text)",
      "public.book_current_team_form_camps(uuid[],text,integer,integer)",
      "public.book_current_team_stage_reconnaissance(uuid,uuid[],uuid)",
      "public.book_current_team_stage_reconnaissance(uuid,uuid[],integer,uuid)",
      "public.redeem_injury_care_reward(uuid,uuid)",
    ]) {
      expect(migration).toContain(signature);
    }
    expect(migration).toContain(
      "replace(\n      v_definition,\n      'perform public.settle_current_health_and_form();',\n      'perform public.sync_active_season_day();'",
    );
  });

  it("régularise les montages échus par lots et via une maintenance surveillée", () => {
    expect(migration).toContain(
      "create or replace function public.settle_all_due_equipment_assignments()",
    );
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("when 'equipment' then");
    expect(migration).toContain("'completedAssignments'");
    expect(maintenanceService).toContain('"equipment"');
    expect(vercelConfig).toContain(
      '"path": "/api/cron/rider-state-maintenance/equipment"',
    );
  });

  it("invalide toutes les fiches coureurs en une seule opération", () => {
    expect(healthActions).toContain(
      'revalidatePath("/jeu/coureurs/[identifiant]", "page")',
    );
    expect(equipmentActions).toContain(
      'revalidatePath("/jeu/coureurs/[identifiant]", "page")',
    );
    expect(healthActions).not.toContain("for (const riderId of riderIds)");
    expect(equipmentActions).not.toContain(
      "for (const riderId of new Set(",
    );
  });
});
