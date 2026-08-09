import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260809150000_auto_archive_fully_recruited_youth_reports.sql",
);

describe("migration d’archivage automatique des rapports de jeunes", () => {
  const migration = fs.readFileSync(MIGRATION_PATH, "utf8");

  it("réagit uniquement lorsqu’un candidat devient recruté", () => {
    expect(migration).toContain(
      "after update of status on public.youth_scouting_candidates",
    );
    expect(migration).toContain("new.status = 'signed'");
    expect(migration).toContain("old.status is distinct from new.status");
  });

  it("résout le rapport seulement quand tous ses candidats sont recrutés", () => {
    expect(migration).toContain("candidate.status <> 'signed'");
    expect(migration).toMatch(
      /report_viewed_at\s*=\s*coalesce\(mission\.report_viewed_at, now\(\)\)/,
    );
    expect(migration).toContain("mission.status = 'completed'");
  });

  it("reprend aussi les rapports déjà entièrement recrutés", () => {
    expect(migration).toMatch(
      /update public\.youth_scouting_missions as mission[\s\S]*where mission\.status = 'completed'/,
    );
    expect(migration).toMatch(
      /and exists \([\s\S]*candidate\.mission_id = mission\.id[\s\S]*and not exists/,
    );
  });
});
