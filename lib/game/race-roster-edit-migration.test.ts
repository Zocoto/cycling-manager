import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260919050000_edit_accepted_race_roster_by_delta.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const roleMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260919100000_edit_accepted_race_roster_roles.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const raceActions = readFileSync(
  resolve(process.cwd(), "app/jeu/courses/[slug]/actions.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

const racePage = readFileSync(
  resolve(process.cwd(), "app/jeu/courses/[slug]/race-profile-content.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

const raceService = readFileSync(
  resolve(process.cwd(), "services/race-calendar.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("modification partielle d'une inscription de course", () => {
  it("réserve l'action au DS et aux courses ordinaires encore modifiables", () => {
    expect(migration).toContain("auth.uid() is null");
    expect(migration).toContain("assignment.role = 'general_manager'");
    expect(migration).toContain("director.status = 'active'");
    expect(migration).toContain("v_competition_type <> 'standard'");
    expect(migration).toContain("registration.status = 'accepted'");
    expect(migration).toContain("v_edition.registration_closes_at");
    expect(migration).toContain("v_edition.withdrawal_closes_at");
    expect(migration).toContain("public.official_stage_simulations");
  });

  it("préserve les coureurs non modifiés et rejette une page devenue obsolète", () => {
    expect(migration).toContain("if v_current_ids <> v_expected_ids then");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("v_added_ids");
    expect(migration).toContain("v_removed_ids");
    expect(migration).toContain("roster.rider_id = any(v_removed_ids)");
    expect(migration).toContain("from unnest(v_added_ids) as added(rider_id)");
    expect(migration).not.toContain("set status = 'withdrawn'\n  where race_registration_id = v_registration.id;");
    expect(migration).not.toContain("update public.race_registrations\n  set");
  });

  it("protège la conférence publiée et nettoie uniquement les réglages des coureurs retirés", () => {
    expect(migration).toContain("public.pre_race_press_conferences");
    expect(migration).toContain("conference.status = 'published'");
    expect(migration).toContain("delete from public.race_roster_stage_roles");
    expect(migration).toContain("delete from public.race_time_trial_rider_plans");
    expect(migration).toContain("delete from public.race_stage_equipment_assignments");
    expect(migration).toContain("update public.race_stage_strategies");
  });
});

describe("réattribution des rôles pendant la modification", () => {
  it("expose le rôle actuellement enregistré au formulaire", () => {
    expect(roleMigration).toContain("current_race_role text");
    expect(roleMigration).toContain("current_roster.race_role");
    expect(roleMigration).toContain("director.auth_user_id = auth.uid()");
    expect(raceService).toContain("currentRole: rider.current_race_role");
    expect(racePage).toContain("expectedRiderRoles");
    expect(racePage).toContain("allowRoleEditing");
  });

  it("enregistre composition et rôles dans la même transaction", () => {
    expect(roleMigration).toContain("update_current_team_race_roster_with_roles");
    expect(roleMigration).toContain("public.update_current_team_race_roster(");
    expect(roleMigration).toContain("set race_role = 'auto'");
    expect(roleMigration).toContain("set race_role = assigned.role");
    expect(roleMigration).toContain("changed_role_count integer");
    expect(raceActions).toContain(
      '"update_current_team_race_roster_with_roles"',
    );
    expect(raceActions).toContain("p_expected_roster: expectedRoster");
  });

  it("refuse les rôles invalides, multiples ou devenus obsolètes", () => {
    expect(roleMigration).toContain("'protected_rider'");
    expect(roleMigration).toContain("in ('sprinter', 'leader_sprinter')");
    expect(roleMigration).toContain("Le rôle classement montagne est réservé aux tours.");
    expect(roleMigration).toContain("Les rôles ont changé entre-temps.");
  });
});
