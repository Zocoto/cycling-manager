import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260808165000_create_sporting_director_mailbox.sql",
  ),
  "utf8",
);

const dashboardService = readFileSync(
  join(process.cwd(), "services/dashboard-events.ts"),
  "utf8",
);

describe("migration de la boîte mail du DS", () => {
  it("isole les messages par DS et expose uniquement des commandes authentifiées", () => {
    expect(migration).toContain("create table public.sporting_director_messages");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain("mark_current_director_message_read");
    expect(migration).toContain("mark_all_current_director_messages_read");
    expect(migration).toContain("set_current_director_message_archived");
    expect(migration).not.toContain(
      "grant update on table public.sporting_director_messages to authenticated",
    );
  });

  it("publie les résultats majeurs et les performances notables une seule fois", () => {
    expect(migration).toContain("publish_director_race_result_messages");
    expect(migration).toContain("context.category_code in ('elite', 'world')");
    expect(migration).toContain("or team_result.best_rank <= 3");
    expect(migration).toContain("'world_championship'");
    expect(migration).toContain("'continental_championship'");
    expect(migration).toContain(
      "unique (sporting_director_id, source_reference)",
    );
  });

  it("agrège les annonces existantes et reprend leur historique", () => {
    expect(migration).toContain("sync_director_national_championship_message");
    expect(migration).toContain("sync_director_international_selection_message");
    expect(migration).toContain("sync_director_roster_alert_message");
    expect(migration).toContain("sync_director_wildcard_message");
    expect(migration).toContain("sync_director_academy_message");
    expect(migration).toContain("sync_director_infrastructure_message");
    expect(migration).toContain("select public.sync_director_national_championship_message(id)");
  });

  it("retire du fil d'accueil les annonces de résultats et de CN", () => {
    expect(dashboardService).not.toContain("buildCompletedRaceEvents");
    expect(dashboardService).not.toContain(
      'from("national_championship_notifications")',
    );
  });
});
