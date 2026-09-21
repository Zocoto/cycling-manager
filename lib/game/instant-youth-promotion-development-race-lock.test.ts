import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260921150000_fix_completed_development_race_promotion_lock.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const promotionFunction = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260830100000_fix_instant_youth_promotion_condition_state.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("instant youth promotion Development Team race lock", () => {
  it("targets the exact guard currently deployed by the previous migration", () => {
    const previousGuard = migration.match(
      /\$previous_guard\$\n([\s\S]*?)\n\$previous_guard\$/,
    )?.[1];

    expect(previousGuard).toBeDefined();
    expect(promotionFunction.split(previousGuard ?? "")).toHaveLength(2);
    expect(migration).toContain(
      "v_definition := replace(v_definition, E'\\r\\n', E'\\n');",
    );
  });

  it("ignores stale registrations belonging to completed editions", () => {
    expect(migration).toContain("edition.status = 'planned'");
    expect(migration).toContain(
      "edition.start_day_number <= v_context.current_day_number",
    );
  });

  it("keeps an active stage race locked until its final classification", () => {
    expect(migration).toContain("edition.race_format = 'stage_race'");
    expect(migration).toContain(
      "edition.end_day_number > v_context.current_day_number",
    );
    expect(migration).toContain("result.result_scope = 'general'");
    expect(migration).toContain(
      "result.academy_rider_id = v_academy.id",
    );
  });

  it("still removes the promoted junior from the DevTeam and future races", () => {
    expect(promotionFunction).toContain(
      "edition.start_day_number > v_context.current_day_number",
    );
    expect(promotionFunction).toContain(
      "delete from public.development_team_roster",
    );
    expect(promotionFunction).toContain(
      "selected.academy_rider_id = v_academy.id",
    );
  });

  it("patches only the function and does not sign a rider during deployment", () => {
    expect(migration).toContain("pg_get_functiondef(");
    expect(migration).toContain("execute replace(");
    expect(migration).not.toMatch(/insert\s+into\s+public\.riders/i);
    expect(migration).not.toContain("Takeshi");
    expect(migration).not.toContain("Iguchi");
  });
});
