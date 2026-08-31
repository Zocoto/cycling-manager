import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RaceCalendarEdition } from "@/lib/game/race-calendar";

import { RaceRewardDetails } from "./race-reward-details";

function buildEdition(
  overrides: Partial<RaceCalendarEdition> = {}
): RaceCalendarEdition {
  return {
    categoryCode: "elite",
    categoryName: "Elite",
    competitionType: "standard",
    raceFormat: "stage_race",
    stages: Array.from({ length: 8 }, (_, index) => ({
      id: `stage-${index + 1}`,
    })),
    ...overrides,
  } as RaceCalendarEdition;
}

describe("RaceRewardDetails", () => {
  it("reprend le bareme complet d'un grand tour Elite", () => {
    const markup = renderToStaticMarkup(
      <RaceRewardDetails edition={buildEdition()} />
    );

    expect(markup).toContain("Grand tour");
    expect(markup).toContain("120\u202f000 €");
    expect(markup).toContain("1\u202f200 pts UCI");
    expect(markup).toContain("Chaque étape");
    expect(markup).toContain("12\u202f000 €");
    expect(markup).toContain("Classement annexe remporté");
    expect(markup).toContain("20\u202f000 €");
    expect(markup).toContain("GPM ou sprint intermédiaire");
    expect(markup).toContain("750 €");
  });

  it("affiche le bareme specifique des championnats sans points UCI", () => {
    const markup = renderToStaticMarkup(
      <RaceRewardDetails
        edition={buildEdition({
          categoryCode: "national",
          categoryName: "Championnat national",
          competitionType: "national_road",
          raceFormat: "one_day",
          stages: [],
        })}
      />
    );

    expect(markup).toContain("Championnat");
    expect(markup).toContain("10\u202f000 €");
    expect(markup).toContain("125 XP");
    expect(markup).not.toContain("pts UCI");
    expect(markup).not.toContain("Chaque étape");
  });

  it("précise le règlement collectif lorsqu'un tour contient un TTT", () => {
    const markup = renderToStaticMarkup(
      <RaceRewardDetails
        edition={buildEdition({
          stages: [
            {
              id: "stage-ttt",
              stageType: "team_time_trial",
            } as RaceCalendarEdition["stages"][number],
          ],
        })}
      />
    );

    expect(markup).toContain("rang équipe en TTT");
    expect(markup).toContain(
      "la place et tous les gains du barème sont attribués une seule fois à l’équipe"
    );
  });
});
