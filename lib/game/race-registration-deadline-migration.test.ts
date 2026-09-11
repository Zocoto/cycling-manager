import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getRegistrationAvailability, RACE_DAY_SLOT_CONFIG } from "./race-calendar";

const migration = readFileSync("supabase/migrations/20260911093000_restore_standard_race_registration_deadlines.sql", "utf8");
const provision = readFileSync("supabase/migrations/20260722220000_compact_stage_races_into_half_days.sql", "utf8");
const roster = readFileSync("supabase/migrations/20260719183000_create_race_roster_registration.sql", "utf8");

describe("season calendar registration deadlines", () => {
  it("repairs only missing deadlines on unfinished standard races without changing their schedule or players", () => {
    expect(migration).toContain("season.status in ('active', 'planned')");
    expect(migration).toContain("edition.status not in ('completed', 'cancelled', 'in_progress')");
    expect(migration).toContain("race.competition_type = 'standard'");
    expect(migration).toContain("coalesce(edition.registration_closes_at, first_stage.closes_at)");
    expect(migration).toContain("coalesce(edition.withdrawal_closes_at, first_stage.closes_at)");
    expect(migration).toContain("first_stage.departure_at - interval '24 hours'");
    expect(migration).not.toMatch(/(?:update|insert into|delete from) public\.(?:stages|season_days|race_registrations|race_registration_riders)\b/);
    expect(migration).not.toContain("race.race_format = 'stage_race'");
  });

  it("repairs copied one-day races after tour compaction on every provision", () => {
    const anchor = "  perform public.compact_planned_stage_races(p_target_season_id);";
    expect(provision.split(anchor)).toHaveLength(2);
    expect(migration).toContain("'public.provision_season_race_calendar(uuid,uuid)'::regprocedure");
    expect(migration).toContain("perform public.repair_missing_standard_race_deadlines(p_target_season_id)");
    expect(migration).toContain("Unexpected calendar provisioner; deadline repair not installed.");
    expect(migration).toContain("from public, anon, authenticated");
  });

  it("keeps the actual Paris freeze hours and Elite wildcard rule", () => {
    expect(RACE_DAY_SLOT_CONFIG.early.registrationCutoffHour).toBe(8);
    expect(RACE_DAY_SLOT_CONFIG.late.registrationCutoffHour).toBe(12);
    expect(migration).toContain("when 'early' then time '08:00'");
    expect(migration).toContain("else time '12:00'");
    expect(migration).toContain("at time zone 'Europe/Paris'");
    expect(migration).toContain("first_stage.category_code = 'elite'");
  });

  it("distinguishes missing configuration from expiry and preserves the rest of the roster guard", () => {
    const oldGuard = migration.split("$old$")[1];
    expect(roster.replaceAll("\r", "")).toContain(oldGuard.replaceAll("\r", ""));
    expect(migration).toContain("La clôture des inscriptions n''est pas encore définie pour cette course.");
    expect(migration).toContain("if now() >= v_edition.registration_closes_at then");
    expect(migration).toContain("Unexpected roster deadline guard; migration aborted.");
  });

  it.each([
    ["2026-09-11T08:00:00Z", "open"],
    ["2026-09-12T09:59:59Z", "open"],
    ["2026-09-12T10:00:00Z", "closed"],
    ["2026-09-12T16:00:00Z", "closed"],
  ] as const)("Namur J2 stays consistent at %s", (now, expected) => {
    expect(getRegistrationAvailability({
      policy: "open", closesAt: "2026-09-12T10:00:00Z",
      minimumReputation: 0, reputationPoints: 49.83, now: new Date(now),
    })).toBe(expected);
  });
});
