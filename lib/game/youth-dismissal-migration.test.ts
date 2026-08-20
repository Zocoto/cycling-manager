import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260820090000_dismiss_youth_academy_riders.sql",
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

  it("débite une année complète et annule les échéances encore en attente", () => {
    expect(migration).toContain(
      "v_tuition_cost := round(v_academy.tuition_per_season, 2)",
    );
    expect(migration).toContain("v_cash_balance < v_tuition_cost");
    expect(migration).toContain("'youth-dismissal:' || v_academy.id::text");
    expect(migration).toContain("cash_balance = cash_balance - v_tuition_cost");
    expect(migration).toContain("transaction.status = 'pending'");
    expect(migration).toContain(
      "'youth-tuition:' || v_academy.id::text",
    );
  });

  it("crée un agent libre avec ses notes seulement à partir de 16 ans", () => {
    expect(migration).toContain("if v_age >= 16 then");
    expect(migration).toContain("insert into public.riders");
    expect(migration).toContain("insert into public.rider_season_ratings");
    expect(migration).toContain("'free_agent'");
    expect(migration).toContain("status = 'released'");
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

  it("affiche le coût, la confirmation et appelle la RPC depuis l’école", () => {
    expect(academyPage).toContain("Renvoyer ce junior");
    expect(academyPage).toContain("rider.tuitionPerSeason");
    expect(academyPage).toContain("required");
    expect(academyPage).toContain("Payer et renvoyer");
    expect(academyActions).toContain(
      'supabase.rpc("dismiss_current_team_youth_rider"',
    );
    expect(academyActions).toContain('revalidatePath("/jeu/transferts")');
    expect(academyActions).toContain(
      '"/jeu/centre-de-formation/development/[academyRiderId]"',
    );
  });
});
