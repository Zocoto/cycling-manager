import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DevelopmentRaceStatus,
  DevelopmentResultRiderLink,
} from "./development-team-panel";

describe("DevelopmentResultRiderLink", () => {
  it("ouvre la fiche d’un junior adverse lorsqu’il est rattaché à une DevTeam", () => {
    const markup = renderToStaticMarkup(
      <DevelopmentResultRiderLink
        result={{
          academyRiderId: "4d317908-d942-4e1a-8d75-4f464ef7c49b",
          riderName: "Junior rival",
        }}
      />,
    );

    expect(markup).toContain(
      'href="/jeu/centre-de-formation/development/4d317908-d942-4e1a-8d75-4f464ef7c49b"',
    );
    expect(markup).toContain("Junior rival");
  });

  it("laisse les participants simulés sans fiche en simple texte", () => {
    const markup = renderToStaticMarkup(
      <DevelopmentResultRiderLink
        result={{ academyRiderId: null, riderName: "Junior simulé" }}
      />,
    );

    expect(markup).toBe("Junior simulé");
  });
});

describe("DevelopmentRaceStatus", () => {
  const cancelledRace = {
    status: "cancelled" as const,
    raceFormat: "one_day" as const,
    startDayNumber: 26,
    endDayNumber: 26,
    registration: null,
    canRegister: false,
  };

  it.each([
    ["CN junior", "national_road" as const],
    ["CC junior", "continental_road" as const],
    ["CM junior", "world_road" as const],
  ])("affiche une annulation explicite pour un %s", (_, competitionType) => {
    const markup = renderToStaticMarkup(
      <DevelopmentRaceStatus
        race={{ ...cancelledRace, competitionType }}
        registeredCount={0}
        currentDayNumber={28}
      />,
    );

    expect(markup).toContain("Épreuve annulée");
    expect(markup).not.toContain("Résultats en cours");
  });

  it("affiche immédiatement l’annulation, même avant la date de course", () => {
    const markup = renderToStaticMarkup(
      <DevelopmentRaceStatus
        race={{ ...cancelledRace, competitionType: "world_time_trial" }}
        registeredCount={0}
        currentDayNumber={10}
      />,
    );

    expect(markup).toContain("Épreuve annulée");
    expect(markup).not.toContain("Sélection fédérale");
  });
});
