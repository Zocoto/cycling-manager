import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260816140000_create_recruitment_alerts.sql",
  ),
  "utf8",
);

describe("migration des alertes de recrutement", () => {
  it("conserve les critères dans une table privée au DS", () => {
    expect(migration).toContain("create table public.recruitment_alerts");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain(
      "create_current_director_recruitment_alert",
    );
    expect(migration).toContain("delete_current_director_recruitment_alert");
    expect(migration).not.toContain(
      "grant insert on table public.recruitment_alerts to authenticated",
    );
    expect(migration).not.toContain(
      "grant delete on table public.recruitment_alerts to authenticated",
    );
  });

  it("cumule niveau, statistique, nationalité et potentiel pour les coureurs", () => {
    expect(migration).toContain("alert.minimum_overall is null");
    expect(migration).toContain("alert.minimum_rating is null");
    expect(migration).toContain("case alert.rating_key");
    expect(migration).toContain("when 'timeTrial' then candidate.time_trial");
    expect(migration).toContain("alert.country_id = candidate.country_id");
    expect(migration).toContain(
      "candidate.potential_steps >= alert.minimum_potential_steps",
    );
  });

  it("cumule métier, étoiles, nationalité et spécialité pour le staff", () => {
    expect(migration).toContain("alert.staff_role = candidate.role");
    expect(migration).toContain(
      "candidate.level >= alert.minimum_staff_level",
    );
    expect(migration).toContain(
      "alert.staff_trainer_specialty = candidate.trainer_specialty",
    );
  });

  it("publie immédiatement un seul mail avec un lien direct", () => {
    expect(migration).toContain(
      "after insert on public.transfer_market_listings",
    );
    expect(migration).toContain(
      "after insert on public.staff_market_listings",
    );
    expect(migration).toContain(
      "create trigger zz_notify_recruitment_alerts_for_daily_rider",
    );
    expect(migration).toContain(
      "select distinct on (alert.sporting_director_id)",
    );
    expect(migration).toContain("Un coureur correspond à votre recherche");
    expect(migration).toContain("Un staff correspond à votre recherche");
    expect(migration).toContain(
      "/jeu/transferts?onglet=quotidiennes#enchere-",
    );
    expect(migration).toContain("/jeu/staff?onglet=marche#staff-");
  });
});
