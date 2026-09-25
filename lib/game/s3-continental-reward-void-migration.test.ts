import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260925143000_void_s3_continental_championship_rewards.sql",
  ),
  "utf8",
);

describe("neutralisation des gains continentaux de S3", () => {
  it("borne strictement le verrou aux championnats continentaux professionnels de S3", () => {
    expect(migration).toContain("season.game_year = 3");
    expect(migration).toContain(
      "race.competition_type = 'continental_championship'",
    );
    expect(migration).not.toContain("world_championship'");
    expect(migration).not.toContain("continental_road'");
  });

  it("neutralise les quatre gains tout en conservant le drapeau de victoire", () => {
    expect(migration).toContain(
      "case when v_void_rewards then 0 else p_reputation_points end",
    );
    expect(migration).toContain(
      "case when v_void_rewards then 0 else p_experience_points end",
    );
    expect(migration).toContain(
      "case when v_void_rewards then 0::numeric else p_cash_prize end",
    );
    expect(migration).toContain(
      "case when v_void_rewards then 0 else p_uci_points end",
    );
    expect(migration).toContain("p_is_victory,");
  });

  it("annule défensivement les versements et les bonus sponsor déjà créés", () => {
    expect(migration).toContain("s3_continental_reward_voids");
    expect(migration).toContain("void-s3-continental-reward:");
    expect(migration).toContain("update public.rider_season_summaries");
    expect(migration).toContain("delete from public.sponsor_satisfaction_events");
    expect(migration).toContain("prevent_s3_continental_sponsor_gain");
  });
});
