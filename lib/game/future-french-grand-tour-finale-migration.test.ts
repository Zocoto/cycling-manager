import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260925133000_shape_next_french_gt_champs_elysees_finale.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const segments = [
  ...migration.matchAll(
    /\((\d+)::smallint,\s*([\d.]+)::numeric,\s*'(flat|climb|descent)'::text,\s*'(asphalt|cobbles)'::text,\s*(-?[\d.]+)::numeric\)/g,
  ),
].map((match) => ({
  segmentNumber: Number(match[1]),
  distanceKm: Number(match[2]),
  terrainType: match[3],
  surfaceType: match[4],
  gradient: Number(match[5]),
}));

describe("finale parisienne du prochain Grand Tour français", () => {
  it("ne cible que l’étape 12 intacte de la prochaine saison", () => {
    expect(migration).toContain("race.slug = 'boucle-des-provinces'");
    expect(migration).toContain("season.status = 'planned'");
    expect(migration).toContain(
      "season.game_year = active_context.game_year + 1",
    );
    expect(migration).toContain("stage.stage_number = 12");
    expect(migration).toContain("stage.status = 'planned'");
    expect(migration).toContain("from public.stage_results as result");
    expect(migration).toContain(
      "from public.official_stage_simulations as simulation",
    );
  });

  it("reste plate et légèrement vallonnée sur 164 kilomètres", () => {
    expect(migration).toContain("name = 'Paris · Champs-Élysées'");
    expect(migration).toContain("profile_type = 'flat'");
    expect(segments).toHaveLength(18);
    expect(
      segments.reduce((total, segment) => total + segment.distanceKm, 0),
    ).toBe(164);

    const ascent = segments.reduce(
      (total, segment) =>
        total +
        (segment.terrainType === "climb"
          ? segment.distanceKm * segment.gradient * 10
          : 0),
      0,
    );
    expect(ascent).toBe(294);
  });

  it("place seize kilomètres de pavés simples uniquement dans le final", () => {
    const cobbledSegments = segments.filter(
      (segment) => segment.surfaceType === "cobbles",
    );

    expect(cobbledSegments).toHaveLength(5);
    expect(
      cobbledSegments.reduce(
        (total, segment) => total + segment.distanceKm,
        0,
      ),
    ).toBe(16);
    expect(cobbledSegments[0].segmentNumber).toBe(10);
    expect(
      cobbledSegments.every((segment) => segment.terrainType === "flat"),
    ).toBe(true);
    expect(cobbledSegments.at(-1)?.segmentNumber).toBe(18);
  });
});
