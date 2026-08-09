import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260809150000_notify_completed_scouting_reports.sql",
  ),
  "utf8",
);

describe("completed scouting report mailbox notifications", () => {
  it("publishes one mailbox message when a report becomes ready", () => {
    expect(migration).toContain(
      "public.sync_director_scouting_report_message",
    );
    expect(migration).toContain(
      "youth_scouting_missions_sync_director_mailbox",
    );
    expect(migration).toContain("new.status = 'completed'");
    expect(migration).toContain("new.report_ready_at is not null");
    expect(migration).toContain("public.sporting_director_messages");
  });

  it("links directly to scouting and includes useful report context", () => {
    expect(migration).toContain(
      "'/jeu/centre-de-formation?onglet=scouting'",
    );
    expect(migration).toContain("'Ouvrir le rapport'");
    expect(migration).toContain("candidate_summary.candidate_count");
    expect(migration).toContain("country.name");
    expect(migration).toContain("scout.first_name");
  });

  it("is idempotent and only backfills reports that remain unread", () => {
    expect(migration).toContain("'scouting-report:' || mission.id::text");
    expect(migration).toContain(
      "on conflict (sporting_director_id, source_reference)",
    );
    expect(migration).toContain("mission.report_viewed_at is null");
    expect(migration).not.toContain("pg_cron");
  });
});
