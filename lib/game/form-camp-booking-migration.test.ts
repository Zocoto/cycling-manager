import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260823120000_rebalance_and_bulk_schedule_form_camps.sql",
  ),
  "utf8",
);

describe("bulk form camp migration", () => {
  it("applique le nouveau barème et le bonus cumulé des médecins", () => {
    expect(migration).toContain(
      "create or replace function public.book_current_team_form_camps",
    );
    expect(migration).toContain(
      "case when p_camp_type = 'premium' then 20 else 10 end",
    );
    expect(migration).toContain(
      "public.get_active_team_staff_level(v_context.team_id, 'doctor') * 5",
    );
    expect(migration).toContain("v_doctor_boost_pct := least(");
  });

  it("verrouille l’équipe et contrôle tous les conflits avant insertion", () => {
    expect(migration).toContain("for update of team_season");
    expect(migration).toContain("from public.rider_injuries as injury");
    expect(migration).toContain("from public.rider_form_camps as camp");
    expect(migration).toContain(
      "registration.status in ('pending', 'accepted')",
    );
    expect(migration.indexOf("with inserted as (")).toBeGreaterThan(
      migration.indexOf("registration.status in ('pending', 'accepted')"),
    );
  });

  it("enregistre la sélection dans une seule opération financière", () => {
    expect(migration).toContain("returns uuid[]");
    expect(migration).toContain(
      "v_daily_price * v_duration_days * cardinality(v_rider_ids)",
    );
    expect(migration).toContain("'form-camp-batch:' || v_booking_id::text");
  });
});
