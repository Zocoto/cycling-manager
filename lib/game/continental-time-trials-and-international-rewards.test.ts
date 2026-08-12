import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { calculateInternationalChampionshipReward } from "./economy";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260812090000_add_continental_time_trials_s2.sql",
  ),
  "utf8",
);
const resultsPage = readFileSync(
  join(process.cwd(), "app/jeu/resultats/page.tsx"),
  "utf8",
);
const settlementService = readFileSync(
  join(process.cwd(), "services/race-results.ts"),
  "utf8",
);

describe("CLM continentaux S2 et gains internationaux", () => {
  it("applique la grille continentale au top 10", () => {
    expect(
      calculateInternationalChampionshipReward({
        competitionType: "continental_championship",
        finalRank: 1,
      }),
    ).toEqual({
      reputation: 2,
      experience: 250,
      cashPrize: 20_000,
      uciPoints: 250,
    });
    expect(
      calculateInternationalChampionshipReward({
        competitionType: "continental_championship",
        finalRank: 10,
      }),
    ).toEqual({
      reputation: 0,
      experience: 25,
      cashPrize: 0,
      uciPoints: 25,
    });
    expect(
      calculateInternationalChampionshipReward({
        competitionType: "continental_championship",
        finalRank: 11,
      }),
    ).toEqual({
      reputation: 0,
      experience: 0,
      cashPrize: 0,
      uciPoints: 0,
    });
  });

  it("applique la grille mondiale au top 10", () => {
    expect(
      calculateInternationalChampionshipReward({
        competitionType: "world_championship",
        finalRank: 1,
      }),
    ).toEqual({
      reputation: 5,
      experience: 625,
      cashPrize: 50_000,
      uciPoints: 600,
    });
    expect(
      calculateInternationalChampionshipReward({
        competitionType: "world_championship",
        finalRank: 10,
      }),
    ).toEqual({
      reputation: 0,
      experience: 60,
      cashPrize: 2_000,
      uciPoints: 200,
    });
  });

  it("cree cinq CLM uniquement a partir de la S2, a 14 h avant la route", () => {
    expect(migration).toContain("v_season.game_year < 2");
    expect(migration).toContain("interval '14 hours'");
    expect(migration).toContain("'individual_time_trial'");
    expect(migration).toContain("'time_trial'");
    expect(migration).toContain("'early'");

    for (const continent of [
      "afrique",
      "amerique",
      "asie",
      "europe",
      "oceanie",
    ]) {
      expect(migration).toContain(
        `championnats-continentaux-${continent}-contre-la-montre`,
      );
    }
  });

  it("autorise un coureur a disputer les deux epreuves du meme CC", () => {
    expect(migration).toContain(
      "other_race.championship_continent_code = v_target_continent_code",
    );
    expect(migration).toContain(
      "public.prioritize_international_championship_rider_base",
    );
  });

  it("rend les CC consultables et branche leur grille au reglement", () => {
    expect(resultsPage).toContain(
      'edition.competitionType === "continental_championship"',
    );
    expect(settlementService).toContain(
      "calculateInternationalChampionshipReward",
    );
  });
});
