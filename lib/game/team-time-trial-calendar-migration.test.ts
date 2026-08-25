import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260825110000_add_team_time_trials_and_varied_profiles.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("calendrier des CLM par équipes et profils atypiques", () => {
  it("introduit le format collectif en S2 sans supprimer les chronos individuels", () => {
    expect(migration).toContain(
      "('active_future', 'tour-de-mazovie', 3, 'ttt-rolling-31')",
    );
    expect(migration).toContain(
      "('active_future', 'aurora-borealis-tour', 2, 'ttt-coastal-36')",
    );
    expect(migration).toContain(
      "La S2 doit recevoir neuf CLM par équipes, nouveaux tours inclus.",
    );
    expect(migration).not.toContain(
      "('active_future', 'ruta-de-las-sierras', 6, 'ttt-",
    );
  });

  it("place des CLM par équipes dès le début de la saison suivante", () => {
    expect(migration).toContain(
      "('planned_early', 'corsa-delle-regioni', 4, 'ttt-rolling-31')",
    );
    expect(migration).toContain(
      "('planned_early', 'tour-des-volcans-du-pacifique', 4, 'ttt-rolling-31')",
    );
    expect(migration).toContain("season_day.day_number <= 14");
    expect(migration).toContain(
      "La S3 doit résoudre exactement 30 profils précoces.",
    );
  });

  it("crée deux nouveaux tours et deux classiques récurrentes", () => {
    for (const slug of [
      "tour-des-horlogers-helvetiques",
      "semaine-de-l-adriatique",
      "muraille-de-malte",
      "arctic-endurance-classic",
    ]) {
      expect(migration).toContain(slug);
    }
    expect(migration).toContain(
      "Le complément de calendrier doit contenir 4 courses et 10 étapes.",
    );
  });

  it("dessine des profils explicites réellement différents", () => {
    for (const shape of [
      "short-punchy-78",
      "marathon-244",
      "downhill-146",
      "unipuerto-132",
      "cobbled-204",
      "circuit-91",
      "arctic-289",
    ]) {
      expect(migration).toContain(shape);
    }
    expect(migration).toContain(
      "Le catalogue doit contenir exactement 24 profils atypiques.",
    );
  });

  it("protège les courses courues et borne le volume chargé par le calendrier", () => {
    expect(migration).toContain("stage.status = 'planned'");
    expect(migration).toContain("season_day.day_number >= 15");
    expect(migration).toContain("season_day.day_number > active_context.current_day_number");
    expect(migration).toContain("from public.stage_results as result");
    expect(migration).toContain("from public.official_stage_simulations as simulation");
    expect(migration).toContain(
      "Le calendrier enrichi doit contenir exactement 700 tronçons ciblés.",
    );
    expect(migration).toContain("Le budget maximal de 720 tronçons ciblés est dépassé.");
    expect(migration).toContain(
      "La S2 doit résoudre exactement 37 profils futurs.",
    );
  });

  it("rend les anciennes consignes individuelles valides en collectif", () => {
    expect(migration).toContain("base_share_cents");
    expect(migration).toContain("relay_share_pct = (");
    expect(migration).toContain("10000 - share.base_share_cents");
  });
});
