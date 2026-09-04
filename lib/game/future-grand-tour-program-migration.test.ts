import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260904015000_rebalance_future_grand_tours.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const stageTargets = [
  ...migration.matchAll(
    /\('(corsa-delle-regioni|boucle-des-provinces|ruta-de-las-sierras)',\s*(\d+),\s*'(gt-[^']+)'\)/g,
  ),
].map((match) => ({
  race: match[1],
  stage: Number(match[2]),
  shape: match[3],
}));

describe("programme montagneux des Grands Tours futurs", () => {
  it("décrit exactement douze étapes pour chacun des trois Grands Tours", () => {
    expect(stageTargets).toHaveLength(36);

    for (const race of [
      "corsa-delle-regioni",
      "boucle-des-provinces",
      "ruta-de-las-sierras",
    ]) {
      const stages = stageTargets
        .filter((target) => target.race === race)
        .map((target) => target.stage)
        .sort((first, second) => first - second);
      expect(stages).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    }
  });

  it("équilibre Italie et France autour de quatre montagnes et deux chronos", () => {
    for (const race of ["corsa-delle-regioni", "boucle-des-provinces"]) {
      const shapes = stageTargets
        .filter((target) => target.race === race)
        .map((target) => target.shape);
      expect(shapes.filter((shape) => shape.includes("medium-mountain"))).toHaveLength(2);
      expect(shapes.filter((shape) => shape.includes("high-mountain"))).toHaveLength(2);
      expect(shapes.filter((shape) => shape.includes("flat-") && !shape.includes("itt"))).toHaveLength(4);
      expect(shapes.filter((shape) => shape.includes("hilly"))).toHaveLength(2);
      expect(shapes.filter((shape) => shape.includes("itt"))).toHaveLength(2);
    }
  });

  it("fait de la Ruta le Grand Tour le plus montagneux", () => {
    const shapes = stageTargets
      .filter((target) => target.race === "ruta-de-las-sierras")
      .map((target) => target.shape);
    expect(shapes.filter((shape) => shape.includes("medium-mountain"))).toHaveLength(2);
    expect(shapes.filter((shape) => shape.includes("high-mountain"))).toHaveLength(3);
    expect(shapes.filter((shape) => shape.includes("hilly"))).toHaveLength(3);
    expect(shapes.filter((shape) => shape.includes("itt"))).toHaveLength(1);
  });

  it("rend la moyenne et la haute montagne sélectives par construction", () => {
    expect(migration).toContain("v_shape.difficulty_band = 'medium_mountain' and v_ascent < 4000");
    expect(migration).toContain("v_shape.difficulty_band = 'high_mountain' and v_ascent < 5000");
    expect(migration).toContain("'gt-itt-climbing-31'");
  });

  it("ne cible que la prochaine saison encore intacte", () => {
    expect(migration).toContain("season.status = 'planned'");
    expect(migration).toContain("season.game_year = active_context.game_year + 1");
    expect(migration).toContain("stage.status = 'planned'");
    expect(migration).toContain("from public.stage_results as result");
    expect(migration).toContain("from public.official_stage_simulations as simulation");
    expect(migration).toContain("Les 36 étapes de la prochaine saison doivent être intactes et modifiables.");
  });
});
