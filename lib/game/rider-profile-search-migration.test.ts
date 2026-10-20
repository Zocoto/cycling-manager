import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getRiderSportingProfile, type RiderRatings } from "./rider-profile";

type LocalDatabase = {
  exec(sql: string): Array<{ values: Array<Array<string | number | null>> }>;
  close(): void;
};
const initSqlJs = createRequire(import.meta.url)("sql.js") as () => Promise<{
  Database: new () => LocalDatabase;
}>;
const previousSearch = readFileSync(
  new URL("../../supabase/migrations/20260930110000_add_transfer_search_potential_filter.sql", import.meta.url),
  "utf8",
).replaceAll("\r", "");
const migration = readFileSync(
  new URL("../../supabase/migrations/20261020110000_preserve_dominant_rider_specialties.sql", import.meta.url),
  "utf8",
).replaceAll("\r", "");

function fragment(name: string, tag: string) {
  const source = migration.match(
    new RegExp(`${name} text := \\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`),
  )?.[1];
  if (!source) throw new Error(`Missing reviewed SQL fragment: ${name}`);
  return source;
}

const oldClimber = fragment("v_old_climber", "old");
const oldRouleur = fragment("v_old_rouleur", "old");
const newClimber = fragment("v_new_climber", "new");
const newRouleur = fragment("v_new_rouleur", "new");
const updatedSearch = previousSearch
  .replace(oldClimber, newClimber)
  .replace(oldRouleur, newRouleur);
const candidates = updatedSearch.match(
  /from \(\s+values([\s\S]*?)\) as candidate\(label, qualifies, score, priority\)/,
)?.[1];
if (!candidates) throw new Error("Missing transfer search profile candidates");

describe("transfer search sporting profile parity (isolated local SQL)", () => {
  let database: LocalDatabase;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    database = new SQL.Database();
  });
  afterAll(() => database?.close());

  function searchProfile(ratings: RiderRatings) {
    // SQLite executes the real SQL candidate predicates locally. PostgreSQL's
    // numeric cast becomes a real multiplication to preserve fractional means.
    const values = candidates!
      .replace(/rating\.(\w+)/g, (_, key: string) =>
        String(ratings[(key === "time_trial" ? "timeTrial" : key) as keyof RiderRatings]),
      )
      .replaceAll("::text", "")
      .replaceAll("::numeric", " * 1.0");
    const rows = database.exec(`
      with candidate(label, qualifies, score, priority) as (values ${values})
      select label, score from candidate where qualifies
      order by score desc, priority limit 2;
    `)[0]?.values ?? [];
    if (!rows[0]) return "Coureur équilibré";
    if (!rows[1] || Number(rows[0][1]) - Number(rows[1][1]) > 4) {
      return String(rows[0][0]);
    }
    return `${rows[0][0]} / ${rows[1][0]}`;
  }

  it("changes only the two reviewed qualification predicates", () => {
    expect(previousSearch.split(oldClimber)).toHaveLength(2);
    expect(previousSearch.split(oldRouleur)).toHaveLength(2);
    expect(updatedSearch).not.toBe(previousSearch);
    expect(updatedSearch.replace(newClimber, oldClimber).replace(newRouleur, oldRouleur))
      .toBe(previousSearch);
    expect(migration).toContain("set local lock_timeout = '1s'");
    expect(migration).toContain("set local statement_timeout = '5s'");
    expect(migration).toContain("Unexpected transfer profile predicates; no changes applied.");
  });

  it("finds Vashadze under both his mountain and hills specialties", () => {
    const ratings = createRatings({ mountain: 83, hills: 79, timeTrial: 64 });
    expect(searchProfile(ratings)).toBe("Grimpeur / Puncheur");
    expect(searchProfile(ratings)).toBe(getRiderSportingProfile(ratings));
  });

  it("matches the display across thresholds, tour averages, ties and other specialties", () => {
    const ratingsToCheck = [50, 61, 62, 63, 64, 69, 70, 71, 74, 75, 79, 83];
    const otherSpecialties: Array<Partial<RiderRatings>> = [
      {}, { hills: 79 }, { sprint: 79 }, { cobbles: 79 }, { breakaway: 79 },
    ];
    for (const mountain of ratingsToCheck) {
      for (const timeTrial of ratingsToCheck) {
        for (const other of otherSpecialties) {
          const ratings = createRatings({ mountain, timeTrial, ...other });
          expect(searchProfile(ratings)).toBe(getRiderSportingProfile(ratings));
        }
      }
    }
  });
});

function createRatings(overrides: Partial<RiderRatings>): RiderRatings {
  return {
    mountain: 50, hills: 50, flat: 50, timeTrial: 50, cobbles: 50, sprint: 50,
    acceleration: 50, downhill: 50, endurance: 50, resistance: 50,
    recovery: 50, breakaway: 50, prologue: 50, ...overrides,
  };
}
