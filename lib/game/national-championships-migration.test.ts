import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260808120000_rework_national_championships.sql",
  ),
  "utf8",
);

describe("refonte des championnats nationaux", () => {
  it("sélectionne automatiquement les 200 meilleurs mondiaux", () => {
    expect(migration).toContain(
      "get_national_championship_world_top_200",
    );
    expect(migration).toContain("where ranked.world_rank <= 200");
    expect(migration).toContain("registration_policy = 'closed'");
    expect(migration).toContain(
      "Les engagements aux championnats sont automatiques.",
    );
  });

  it("engage les coureurs libres et conserve les retraits du DS", () => {
    expect(migration).toContain("historical_team_name = 'Coureurs libres'");
    expect(migration).toContain(
      "national_championship_rider_withdrawals",
    );
    expect(migration).toContain(
      "withdraw_current_team_national_championship_rider",
    );
    expect(migration).toContain("set status = 'withdrawn'");
  });

  it("programme toutes les nations et disciplines le même jour", () => {
    expect(migration).toContain("time '14:00'");
    expect(migration).toContain("time '18:00'");
    expect(migration.match(/v_day_number := 8/g)).toHaveLength(2);
    expect(migration).toContain("process_due_national_championships");
    expect(migration).toContain("sync_national_championship_registrations");
    expect(migration).toContain("Tous les CN sont résolus en J8.");
    expect(migration).toContain("get diagnostics v_resolved_without_field");
    expect(migration).toContain("clôturée sans classement");
  });

  it("notifie les sélections et la publication des résultats", () => {
    expect(migration).toContain("national_championship_notifications");
    expect(migration).toContain("'selection',");
    expect(migration).toContain("'results',");
    expect(migration).toContain("publish_national_championship_results");
  });
});
