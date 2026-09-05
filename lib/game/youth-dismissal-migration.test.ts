import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260905090000_defer_youth_dismissals_until_season_end.sql",
  ),
  "utf8",
);
const repairMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260905120000_repair_legacy_youth_dismissals.sql",
  ),
  "utf8",
);
const academyPage = readFileSync(
  join(process.cwd(), "app/jeu/centre-de-formation/page.tsx"),
  "utf8",
);
const academyActions = readFileSync(
  join(process.cwd(), "app/jeu/centre-de-formation/actions.ts"),
  "utf8",
);
const youthService = readFileSync(
  join(process.cwd(), "services/youth-development.ts"),
  "utf8",
);

describe("renvoi d’un junior de l’école de cyclisme", () => {
  it("expose une opération authentifiée et atomique", () => {
    expect(migration).toContain(
      "public.dismiss_current_team_youth_rider",
    );
    expect(migration).toContain("if auth.uid() is null then");
    expect(migration).toContain("perform public.settle_current_team_finances()");
    expect(migration).toContain("for update;");
    expect(migration).toContain(
      "grant execute on function public.dismiss_current_team_youth_rider(uuid)",
    );
  });

  it("arrête gratuitement la scolarité et annule les échéances futures", () => {
    expect(migration).toContain("status = 'release_pending'");
    expect(migration).toContain("transaction.status = 'pending'");
    expect(migration).toContain(
      "'youth-tuition:' || v_academy.id::text",
    );
    expect(migration).not.toContain("'youth-dismissal:' || v_academy.id::text");
    expect(migration).not.toContain("cash_balance = cash_balance - v_tuition_cost");
    expect(migration).toContain("'tuitionCost', 0");
    expect(migration).toContain("status = 'expired'");
  });

  it("diffère la création de l’agent libre jusqu’au changement de saison", () => {
    expect(migration).toContain("'releaseScheduled', true");
    expect(migration).toContain("'releaseGameYear', v_context.game_year + 1");
    expect(migration).toContain("'freeAgent', false");
    expect(migration).not.toContain("insert into public.riders");
    expect(migration).not.toContain("insert into public.rider_season_ratings");
    expect(migration).toContain("academy.status = ''release_pending''");
    expect(migration).toContain("promoted_rider_id = null");
  });

  it("retire le junior des sélections futures sans casser une course commencée", () => {
    expect(migration).toContain(
      "edition.start_day_number <= v_context.day_number",
    );
    expect(migration).toContain(
      "delete from public.development_race_registration_riders",
    );
    expect(migration).toContain("status = 'withdrawn'");
    expect(migration).toContain("delete from public.development_team_roster");
  });

  it("explique le départ différé et conserve le junior visible sans frais", () => {
    expect(academyPage).toContain("Programmer le départ");
    expect(academyPage).toContain("Fin de saison · sans frais");
    expect(academyPage).toContain("required");
    expect(academyPage).not.toContain("Payer et renvoyer");
    expect(academyPage).not.toContain("immédiatement agent libre");
    expect(youthService).toContain(
      '["active", "recruited", "release_pending"]',
    );
    expect(youthService).toContain(
      'rider.status === "release_pending"',
    );
    expect(academyActions).toContain(
      'supabase.rpc("dismiss_current_team_youth_rider"',
    );
    expect(academyActions).toContain("release.releaseGameYear");
    expect(academyActions).not.toContain('revalidatePath("/jeu/transferts")');
    expect(academyActions).toContain(
      '"/jeu/centre-de-formation/development/[academyRiderId]"',
    );
  });

  it("base les récompenses sur les vraies signatures et promotions", () => {
    expect(migration).toContain("from public.youth_scouting_candidates as candidate");
    expect(migration).toContain("where candidate.status = 'signed'");
    expect(migration).toContain("where youth.status = ''promoted''");
  });

  it("répare exactement les 13/10/3 cas explicitement autorisés", () => {
    expect(repairMigration).toContain("v_refund_count <> 13");
    expect(repairMigration).toContain("v_suspension_count <> 10");
    expect(repairMigration).toContain(
      "v_refund_count - v_suspension_count <> 3",
    );
    expect(repairMigration).toContain("'youth-dismissal-refund:'");
    expect(repairMigration).toContain(
      "cash_balance = team_season.cash_balance + refund.amount",
    );
    expect(repairMigration).toContain("set status = 'suspended'");
    expect(repairMigration).toContain("status = 'release_pending'");
    expect(repairMigration).toContain("from public.rider_contracts as contract");
    expect(repairMigration).toContain("where contract.rider_id = rider.id");
    expect(repairMigration).toContain(
      "v_youth.promoted_rider_id is not null",
    );
  });
});
