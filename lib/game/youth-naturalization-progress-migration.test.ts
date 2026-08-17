import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260817090000_fix_youth_naturalization_progress.sql",
  ),
  "utf8",
);
const youthService = readFileSync(
  resolve(process.cwd(), "services/youth-development.ts"),
  "utf8",
);
const professionalService = readFileSync(
  resolve(process.cwd(), "services/rider-naturalization.ts"),
  "utf8",
);

describe("youth naturalization progress migration", () => {
  it("initializes current juniors without rewriting their displayed tenure", () => {
    expect(migration).toContain(
      "naturalization_started_season_id = academy.joined_season_id",
    );
    expect(migration).toContain(
      "naturalization_started_day_number = academy.joined_day_number",
    );
    expect(migration).toContain("academy.status in ('active', 'recruited')");
  });

  it("resets juniors when the active or next-season sponsor country changes", () => {
    expect(migration).toContain(
      "public.handle_team_naturalization_country_change",
    );
    expect(migration).toContain(
      "public.reset_youth_naturalization_on_season_activation",
    );
    expect(migration).toContain(
      "naturalization_started_day_number = v_clock.day_number",
    );
    expect(migration).toContain(
      "naturalization_started_day_number = coalesce(new.current_day_number, 1)",
    );
  });

  it("carries the same-country junior counter into a fixed 28-day professional route", () => {
    expect(migration).toContain(
      "public.carry_youth_naturalization_after_promotion",
    );
    expect(migration).toContain("required_days_override");
    expect(migration).toContain("new.naturalization_country_id = v_context.target_country_id");
    expect(migration).toMatch(/new\.team_id,\s+28,\s+now\(\)/);
    expect(migration).toContain("if v_elapsed_days < v_required_days then");
    expect(professionalService).toContain(
      "progressResult.data?.required_days_override",
    );
  });

  it("uses the country-bound start marker in the academy UI and RPC", () => {
    expect(youthService).toContain(
      "calculateCountryBoundNaturalizationDays",
    );
    expect(migration).toContain(
      "v_rider.naturalization_country_id = v_context.target_country_id",
    );
  });
});
