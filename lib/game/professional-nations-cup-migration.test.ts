import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260910110000_wire_professional_nations_cup.sql",
  ),
  "utf8",
);
const objectiveMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260909211000_align_federation_objectives.sql",
  ),
  "utf8",
);
const overviewService = readFileSync(
  join(process.cwd(), "services/nations-cup.ts"),
  "utf8",
);

describe("professional Nations Cup wiring", () => {
  it("creates five real J24 races handled by the standard simulation engine", () => {
    for (const slug of [
      "nations-cup-montagne",
      "nations-cup-vallons",
      "nations-cup-sprint",
      "nations-cup-paves",
      "nations-cup-contre-la-montre",
    ]) {
      expect(migration).toContain(`'${slug}'`);
    }
    expect(migration).toContain("and day.day_number = 24");
    expect(migration).toContain("'one_day', 'active'");
    expect(migration).toContain("'nations_cup'");
  });

  it("fills unattended professional lists and syncs them to race rosters", () => {
    expect(migration).toContain(
      "prepare_due_automatic_federation_professional_lineups",
    );
    expect(migration).toContain("v_departure_at > p_now + interval '1 hour'");
    expect(migration).toContain("while v_selected < v_slot.rider_limit loop");
    expect(migration).toContain("sync_national_federation_championship_lineup");
    expect(migration).toContain("perform public.prioritize_federation_championship_rider");
  });

  it("scores actual professional results and uses them for objectives", () => {
    expect(migration).toContain(
      "get_national_federation_nations_cup_standings",
    );
    expect(migration).toContain("from public.race_results as result");
    expect(objectiveMigration).toContain("standing.events_count > 0");
    expect(objectiveMigration).toContain(
      "selection_list.created_by_director_id is not null",
    );
    expect(objectiveMigration).not.toContain("development_ranking_entries");
  });

  it("exposes a detailed overall and per-event results page", () => {
    expect(overviewService).toContain("eventRanks");
    expect(overviewService).toContain("divisionRank");
    expect(overviewService).toContain("groupRank");
    expect(overviewService).toContain("race_results");
  });
});
