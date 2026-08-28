import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

const migration = read(
  "supabase/migrations/20260828170500_refund_cancelled_planned_form_camps.sql",
);
const healthActions = read("app/jeu/centre-de-soin/actions.ts");
const healthPage = read("app/jeu/centre-de-soin/page.tsx");
const actionButton = read(
  "components/game/camp-interruption-submit-button.tsx",
);

describe("annulation des stages de forme programmés", () => {
  it("annule uniquement un stage futur encore planifié", () => {
    expect(migration).toContain("v_camp.status <> 'planned'");
    expect(migration).toContain(
      "v_camp.current_day_number >= v_camp.start_day_number",
    );
    expect(migration).toContain("status = 'cancelled'");
    expect(migration).toContain("completed_at = now()");
  });

  it("rembourse intégralement le stage une seule fois sans règlement global", () => {
    expect(migration).toContain(
      "set cash_balance = team_season.cash_balance + v_camp.total_price",
    );
    expect(migration).toContain("v_camp.total_price");
    expect(migration).toContain("'form-camp-refund:' || v_camp.id::text");
    expect(migration).toContain(
      "on conflict (team_season_id, source_reference) do nothing",
    );
    expect(migration).toContain("if v_refund_transaction_id is null then");
    expect(migration).toContain("'training'");
    expect(migration).toContain("'posted'");
    expect(migration).not.toContain(
      "perform public.settle_current_health_and_form();",
    );
  });

  it("borne l’action à l’équipe connectée et à une ligne cible", () => {
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain("where camp.id = p_camp_id");
    expect(migration).toContain("for update of camp");
    expect(migration).toContain("set statement_timeout = '5s'");
  });

  it("réutilise le parcours Forme avec une confirmation explicite", () => {
    expect(healthActions).toContain(
      '"cancel_current_team_planned_form_camp"',
    );
    expect(healthPage).toContain("Gérer les stages programmés et en cours");
    expect(healthPage).toContain("cancelPlannedFormCampAction");
    expect(actionButton).toContain("Annuler le stage");
    expect(actionButton).toContain("le coût sera intégralement remboursé.");
    expect(healthPage).toContain("coût est intégralement remboursé");
    expect(healthPage).toContain(
      "Une fois commencé, son arrêt prend effet le lendemain et",
    );
    expect(actionButton).toContain("Le coût ne sera pas remboursé, mais");
  });
});
