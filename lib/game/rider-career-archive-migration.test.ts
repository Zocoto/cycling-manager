import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260727223000_archive_inactive_rider_careers.sql",
  ),
  "utf8",
);

describe("inactive rider career archive migration", () => {
  it("requires a rider to have existed at the start of the completed season", () => {
    expect(migration).toContain(
      "rider.created_at <= v_season.starts_on::timestamptz",
    );
  });

  it("archives when either team membership or race participation is missing", () => {
    expect(migration).toContain("if v_has_team and v_has_race then");
    expect(migration).toContain("'no_team_and_no_race'");
    expect(migration).toContain("'no_team'");
    expect(migration).toContain("'no_race'");
  });

  it("keeps historical identity, teams, rankings and notable results", () => {
    expect(migration).toContain("create table public.rider_history_archives");
    expect(migration).toContain(
      "create table public.rider_history_archive_seasons",
    );
    expect(migration).toContain("notable_performances jsonb");
    expect(migration).toContain("summary.uci_rank");
  });

  it("removes the rider from active gameplay without deleting result keys", () => {
    expect(migration).toContain("set status = 'retired'");
    expect(migration).not.toContain("delete from public.riders");
  });
  it("starts archiving prospectively when a season closes", () => {
    expect(migration).toContain("season_inactive_rider_archive");
    expect(migration).not.toContain("archive_existing_completed_seasons");
  });
});