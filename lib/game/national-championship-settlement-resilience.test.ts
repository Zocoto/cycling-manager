import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("national championship settlement resilience", () => {
  it("settles independent countries with bounded concurrency", () => {
    const source = readSource("services/race-results.ts");

    expect(source).toContain(
      "export const NATIONAL_CHAMPIONSHIP_SETTLEMENT_CONCURRENCY = 4",
    );
    expect(source).toContain("chunkValues(");
    expect(source).toContain("await Promise.all(editionBatch.map(settleEdition))");
  });

  it("cleans duplicate CN rosters in one set-based pass", () => {
    const migration = readSource(
      "supabase/migrations/20260821173500_replace_conflicting_cn_roster_trigger.sql",
    );
    const service = readSource("services/national-championships.ts");

    expect(migration).toContain(
      "drop trigger if exists enforce_unique_active_rider_per_race_edition",
    );
    expect(migration).toContain(
      "cleanup_duplicate_national_championship_rosters",
    );
    expect(migration).toContain(
      "partition by edition.id, roster.rider_id",
    );
    expect(migration).toContain("and ranked.active_rank > 1");
    expect(service).toContain(
      '"cleanup_duplicate_national_championship_rosters"',
    );
  });

  it("runs discipline-specific crons only on national day", () => {
    const route = readSource(
      "app/api/cron/national-championship-settlements/[discipline]/route.ts",
    );
    const vercel = readSource("vercel.json");

    expect(route).toContain('"time-trial-summer": "national_time_trial"');
    expect(route).toContain('"road-summer": "national_road"');
    expect(route).toContain("season.current_day_number !== 8");
    expect(route).toContain("edition.competitionType === competitionType");
    expect(route).toContain("synchronizationError");
    expect(route).toContain("la consolidation des startlists déjà gelées continue");
    expect(vercel).toContain(
      "/api/cron/national-championship-settlements/time-trial",
    );
    expect(vercel).toContain(
      "/api/cron/national-championship-settlements/road",
    );
    expect(vercel).toContain('"schedule": "33 16 * * *"');
  });

  it("keeps national settlements out of the general race cron", () => {
    const generalRoute = readSource(
      "app/api/cron/race-settlements/[slot]/route.ts",
    );

    expect(generalRoute).toContain(
      'edition.competitionType !== "national_road"',
    );
    expect(generalRoute).toContain(
      'edition.competitionType !== "national_time_trial"',
    );
    expect(generalRoute).toContain(
      "settleFinishedRaceResults(standardCalendar, now)",
    );
  });
});
