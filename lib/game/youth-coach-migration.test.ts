import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261008143000_add_youth_coach.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("youth coach migration", () => {
  it("registers the role, its seven affixes and its salary", () => {
    expect(migration).toContain("'trainer', 'youth_coach', 'scout'");
    expect(migration).toContain("'youth_coach_mountain'");
    expect(migration).toContain("'youth_coach_endurance'");
    expect(migration).toContain("when 'youth_coach' then 20000");
  });

  it("enforces one active youth coach per team under a transaction lock", () => {
    expect(migration).toContain(
      "create or replace function public.enforce_team_youth_coach_limit",
    );
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("staff_contracts_youth_coach_limit");
    expect(migration).toContain(
      "Une équipe ne peut employer qu’un seul responsable de formation actif.",
    );
  });

  it("keeps youth progression targeted and capped", () => {
    expect(migration).toContain(
      "create or replace function public.get_youth_coach_training_multiplier",
    );
    expect(migration).toContain("then member.level * 0.02");
    expect(migration).toContain("then member.level * 0.01");
    expect(migration).toContain(
      "when member.country_id = p_rider_country_id then 0.05",
    );
    expect(migration).toContain(
      "public.get_youth_coach_training_multiplier",
    );
    expect(migration).toContain("v_context.team_id");
  });

  it("updates market, reward, academy and all-role objective paths", () => {
    expect(migration).toContain("public.append_staff_market_wave");
    expect(migration).toContain(
      "public.redeem_custom_staff_recruitment_reward",
    );
    expect(migration).toContain("p_talent_code = (case p_role");
    expect(migration).toContain("else ''youth_coach_''");
    expect(migration).toContain(
      "public.start_current_team_staff_academy_training",
    );
    expect(migration).toContain("target_value = 12");
    expect(migration).toContain("les douze métiers de staff");
  });
});
