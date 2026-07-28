import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260728143000_recalculate_concrete_rider_race_days.sql",
  ),
  "utf8",
);

describe("concrete rider race days migration", () => {
  it("supprime l'expérience artificielle déduite de l'âge", () => {
    expect(migration).toContain(
      "drop trigger if exists rider_first_rating_initializes_experience",
    );
    expect(migration).toContain(
      "drop function if exists public.estimate_initial_rider_race_days(integer)",
    );
    expect(migration).toContain(
      "drop function if exists public.initialize_rider_experience_from_first_rating()",
    );
  });

  it("recalcule tous les JDC depuis les départs réellement pris", () => {
    expect(migration).toContain("update public.riders as rider");
    expect(migration).toContain("select count(*)::integer");
    expect(migration).toContain("roster.rider_id = rider.id");
    expect(migration).toContain("result.status <> 'did_not_start'");
    expect(migration).not.toContain("outside_time_limit");
  });

  it("part de zéro sans résultat et garde les archives synchronisées", () => {
    expect(migration).toContain("set career_race_days = (");
    expect(migration).toContain(
      "update public.rider_history_archives as archive",
    );
    expect(migration).toContain(
      "set career_race_days = rider.career_race_days",
    );
  });

  it("incrémente uniquement les journées réellement commencées", () => {
    expect(migration).toContain(
      "v_old_counts := old.status <> 'did_not_start'",
    );
    expect(migration).toContain(
      "v_new_counts := new.status <> 'did_not_start'",
    );
    expect(migration).toContain("career_race_days - 1");
    expect(migration).toContain("career_race_days + 1");
  });
});
