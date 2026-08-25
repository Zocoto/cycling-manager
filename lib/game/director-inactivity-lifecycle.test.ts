import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const migration = source(
  "supabase/migrations/20260825131000_manage_director_inactivity.sql",
);
const service = source("services/director-inactivity.ts");
const directory = source("services/public-directory.ts");
const teamHistory = source("services/public-team-history.ts");
const vercel = source("vercel.json");
const teamCore = source(
  "supabase/migrations/20260714195812_create_team_core_tables.sql",
);

describe("cycle d’inactivité des Directeurs Sportifs", () => {
  it("avertit à J+30 et ne démarre J+14 qu’après l’email", () => {
    expect(migration).toContain("now() - interval '30 days'");
    expect(migration).toContain("deletion_due_at = now() + interval '14 days'");
    expect(service).toContain("mark_director_inactivity_warning_sent");
    expect(service.indexOf("sendBrevoTransactionalEmail")).toBeLessThan(
      service.indexOf('"mark_director_inactivity_warning_sent"'),
    );
  });

  it("annule le cycle dès qu’une activité postérieure est détectée", () => {
    expect(migration).toContain("activity.last_seen_at");
    expect(migration).toContain(
      "latest.last_activity_at > lifecycle.warning_sent_at",
    );
    expect(migration).toContain("status = 'cancelled'");
  });

  it("exclut les bots et borne les petits lots quotidiens", () => {
    expect(migration).toContain("from public.alpha_bot_managers as bot");
    expect(migration).toContain("for update of lifecycle skip locked");
    expect(service).toContain("const WARNING_BATCH_SIZE = 25");
    expect(service).toContain("const DELETION_BATCH_SIZE = 10");
    expect(vercel).toContain('"/api/cron/director-inactivity"');
    expect(vercel).toContain('"35 23 * * *"');
  });

  it("archive l’équipe et libère les coureurs sans effacer les contrats", () => {
    expect(migration).toContain("status = 'inactive'");
    expect(migration).toContain("status = 'retired'");
    expect(migration).toContain("set status = 'free_agent'");
    expect(migration).toContain("update public.rider_contracts");
    expect(migration).not.toContain("delete from public.rider_contracts");
    expect(migration).toContain("update public.team_manager_assignments");
  });

  it("préserve une fiche publique en lecture seule", () => {
    expect(directory).toContain("getArchivedPublicTeam");
    expect(directory).toContain('.eq("status", "inactive")');
    expect(directory).toContain('team_status: "inactive"');
    expect(teamHistory).toContain('.neq("status", "withdrawn")');
  });

  it("supprime Auth uniquement après l’archivage métier", () => {
    expect(service.indexOf('"archive_inactive_sporting_director"')).toBeLessThan(
      service.indexOf("auth.admin.deleteUser"),
    );
    expect(teamCore).toContain("auth_user_id uuid unique");
    expect(teamCore).toContain("on delete set null");
    expect(migration).toContain("status = 'completed'");
  });
});
