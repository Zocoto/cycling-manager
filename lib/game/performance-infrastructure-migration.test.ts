import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260812130000_add_performance_infrastructure_hub.sql",
  ),
  "utf8",
);

describe("performance infrastructure migration", () => {
  it("keeps every SQL dollar-quoted block balanced", () => {
    expect(migration.match(/\$\$/g)?.length ?? 0).toBeGreaterThan(0);
    expect((migration.match(/\$\$/g)?.length ?? 0) % 2).toBe(0);
    expect((migration.match(/\$migration\$/g)?.length ?? 0) % 2).toBe(0);
  });

  it("installs the seven facilities and their server-side gates", () => {
    for (const code of [
      "indoor_track",
      "cryotherapy_center",
      "wind_tunnel",
      "research_lab",
      "international_welcome_center",
      "weather_center",
      "media_center",
    ]) {
      expect(migration).toContain(`'${code}'`);
    }

    expect(migration).toContain(
      "start_current_team_rider_performance_preparation",
    );
    expect(migration).toContain("start_current_team_equipment_rnd");
    expect(migration).toContain("publish_current_team_media_article");
    expect(migration).toContain("member.role='research_engineer'");
  });

  it("stacks cryotherapy after physio and extends staff affinity safely", () => {
    expect(migration).toContain(
      "new.form_delta:=-round(abs(new.form_delta)*(1-v_cryo/100.0),2)",
    );
    expect(migration).toContain("country_adjacencies");
    expect(migration).toContain(
      "get_staff_contract_nationality_multiplier(v_plan.trainer_contract_id, v_rider.id)",
    );
    expect(migration).toContain("get_team_media_center_community_multiplier");
  });
});
