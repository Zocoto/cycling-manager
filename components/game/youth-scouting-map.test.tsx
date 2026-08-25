import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { YouthScoutingMap } from "./youth-scouting-map";

describe("YouthScoutingMap", () => {
  it("n’affiche que les durées de trois à sept jours", () => {
    const markup = renderToStaticMarkup(
      <YouthScoutingMap
        tutorialMode
        countries={[
          {
            id: "country-fr",
            name: "France",
            code: "FR",
            latitude: 46,
            longitude: 2,
            reputation: 8,
            reputationSourceSeasonName: "Saison 1",
            uciNationRank: 8,
            specialty: "rouleur",
            secondarySpecialty: "puncheur",
            specialtyLabel: "Rouleurs",
            secondarySpecialtyLabel: "Puncheurs",
            facilityLevel: 5,
          },
        ]}
        scouts={[]}
        currentDayNumber={1}
        scoutingSupervision={{
          currentPercentage: 0,
          stableThroughDayNumber: null,
          remainingDays: 0,
          effects: [],
        }}
      />,
    );

    expect(markup).not.toContain('<option value="1"');
    expect(markup).not.toContain('<option value="2"');
    for (const durationDays of [3, 4, 5, 6, 7]) {
      expect(markup).toContain(`<option value="${durationDays}"`);
    }
    expect(markup).toContain(
      "Réputation calculée uniquement depuis le classement UCI Saison 1 : 8e.",
    );
  });
});
