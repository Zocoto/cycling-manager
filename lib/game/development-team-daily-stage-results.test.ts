import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = read(
  "supabase/migrations/20260831173000_publish_development_tour_stages_daily.sql",
);
const service = read("services/development-team.ts");
const panel = read("components/game/development-team-panel.tsx");

describe("daily Development Team stage results", () => {
  it("publishes only an elapsed and still-unpublished stage", () => {
    const stageFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.simulate_development_race_stage",
      ),
      migration.indexOf(
        "create or replace function public.settle_due_development_races",
      ),
    );

    expect(stageFunction).toContain("v_stage.day_number > v_current_day_number");
    expect(stageFunction).toContain("result.result_scope = 'stage'");
    expect(stageFunction).toContain("return 0;");
    expect(stageFunction).not.toContain("'general'");
    expect(stageFunction).not.toContain("development_race_podium_progression");
  });

  it("keeps final settlement atomic and catches up overdue stages", () => {
    const finalSettlement = migration.indexOf(
      "perform public.simulate_development_race(v_edition.id)",
    );
    const dailySettlement = migration.indexOf(
      "public.simulate_development_race_stage(",
      migration.indexOf(
        "create or replace function public.settle_due_development_races",
      ),
    );

    expect(finalSettlement).toBeGreaterThan(-1);
    expect(dailySettlement).toBeGreaterThan(finalSettlement);
    expect(migration).toContain(
      "edition.end_day_number > v_current_day_number",
    );
    expect(migration).toContain("stage.day_number <= v_current_day_number");
    expect(migration).toContain("not exists (");
    expect(migration).toContain("limit 12");
    expect(migration).toContain("if v_completed > 0 and v_game_year >= 3");
    expect(migration).toContain("select public.settle_due_development_races();");
  });

  it("loads and displays results before a tour is completed", () => {
    expect(service).toContain(
      'if (view === "resultats" && visibleEditions.length)',
    );
    expect(service).toContain("publishedStageCount:");
    expect(panel).toContain("raceIdsWithResults");
    expect(panel).toContain("publishedStages.map");
    expect(panel).toContain(
      "Le classement général final sera publié après la dernière étape.",
    );
    expect(panel).not.toContain(
      'const completedRaces = overview.races.filter((race) => race.status === "completed")',
    );
  });
});
