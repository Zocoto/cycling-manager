import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260811170000_fix_world_championship_startlists.sql",
  ),
  "utf8",
);

describe("correctif des startlists des championnats du monde", () => {
  it("etend le classement mondial aux trente meilleures nations UCI", () => {
    expect(migration).toContain("check (nation_rank between 1 and 30)");
    expect(migration).toContain("where nation_rank <= 30");
    expect(migration).toContain("left join public.rider_season_summaries");
  });

  it("selectionne les specialistes CLM avec une note dediee", () => {
    expect(migration).toContain("rating.time_trial * 0.55");
    expect(migration).toContain("rating.endurance * 0.18");
    expect(migration).toContain("rating.flat * 0.12");
    expect(migration).toContain("then rider_pool.time_trial_rating");
  });

  it("libere les engagements concurrents avant d'inserer la startlist", () => {
    const priority = migration.indexOf(
      "perform public.prioritize_international_championship_rider(",
    );
    const rosterInsert = migration.indexOf("insert into public.race_rosters (");

    expect(priority).toBeGreaterThan(-1);
    expect(rosterInsert).toBeGreaterThan(priority);
  });

  it("autorise le doublon controle entre CLM et course en ligne", () => {
    expect(migration).toContain(
      "v_target_competition_type = 'world_championship'",
    );
    expect(migration).toContain(
      "other_race.competition_type = 'world_championship'",
    );
  });

  it("repare immediatement la saison active", () => {
    expect(migration).toContain(
      "perform public.process_due_international_championship_selections(now())",
    );
  });
});
