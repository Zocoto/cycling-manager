import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

const migration = read(
  "supabase/migrations/20260828090000_interrupt_active_rider_camps.sql",
);
const healthActions = read("app/jeu/centre-de-soin/actions.ts");
const trainingActions = read("app/jeu/entrainement/actions.ts");
const interruptionButton = read(
  "components/game/camp-interruption-submit-button.tsx",
);

describe("interruption des stages en cours", () => {
  it("rend le coureur disponible le lendemain sans modifier les montants payés", () => {
    expect(migration).toContain(
      "end_day_number = v_camp.current_day_number",
    );
    expect(migration).toContain(
      "interruption_effective_day_number = v_camp.current_day_number + 1",
    );
    expect(migration).not.toContain("set cash_balance");
    expect(migration).not.toContain("delete from public.financial_transactions");
  });

  it("conserve les gains de forme passés puis clôt le stage comme interrompu", () => {
    expect(migration).toContain(
      "create or replace function public.mark_interrupted_form_camp_cancelled()",
    );
    expect(migration).toContain("before update of status on public.rider_form_camps");
    expect(migration).toContain("new.status := 'cancelled'");
    expect(migration).not.toContain(
      "perform public.settle_current_health_and_form();",
    );
  });

  it("supprime immédiatement le bonus d’une reconnaissance interrompue", () => {
    expect(migration).toContain("status = 'cancelled'");
    expect(migration).toContain(
      "from public.stage_reconnaissance_riders as participant",
    );
    expect(migration).toContain(
      "where participant.reconnaissance_id = v_reconnaissance.id",
    );
  });

  it("borne les actions interactives à une ligne cible avec un timeout court", () => {
    expect(migration.match(/set statement_timeout = '5s'/g)).toHaveLength(2);
    expect(migration).toContain("where camp.id = p_camp_id");
    expect(migration).toContain(
      "where reconnaissance.id = p_reconnaissance_id",
    );
    expect(migration).toContain("for update of camp");
    expect(migration).toContain("for update of reconnaissance");
  });

  it("expose les deux actions authentifiées et leurs avertissements métier", () => {
    expect(healthActions).toContain(
      '"request_current_team_form_camp_interruption"',
    );
    expect(trainingActions).toContain(
      '"request_current_team_reconnaissance_interruption"',
    );
    expect(interruptionButton).toContain(
      "Le coût ne sera pas remboursé et aucun bonus de reconnaissance ne sera accordé.",
    );
    expect(interruptionButton).toContain(
      "les gains de forme des journées effectuées resteront acquis.",
    );
  });
});
