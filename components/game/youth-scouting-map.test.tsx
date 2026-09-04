import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { YouthScoutingMap } from "./youth-scouting-map";

describe("YouthScoutingMap", () => {
  it("sélectionne le pays métier fourni plutôt que la France", () => {
    const countries = [
      {
        id: "country-fr",
        name: "France",
        code: "FR",
        latitude: 46,
        longitude: 2,
        reputation: 8,
        reputationSourceSeasonName: "Saison 1",
        uciNationRank: 8,
        specialty: "rouleur" as const,
        secondarySpecialty: "puncheur" as const,
        specialtyLabel: "Rouleurs",
        secondarySpecialtyLabel: "Puncheurs",
        facilityLevel: 5,
      },
      {
        id: "country-it",
        name: "Italie",
        code: "IT",
        latitude: 42.5,
        longitude: 12.5,
        reputation: 4,
        reputationSourceSeasonName: "Saison 1",
        uciNationRank: 4,
        specialty: "grimpeur" as const,
        secondarySpecialty: "puncheur" as const,
        specialtyLabel: "Grimpeurs",
        secondarySpecialtyLabel: "Puncheurs",
        facilityLevel: 6,
      },
    ];
    const markup = renderToStaticMarkup(
      <YouthScoutingMap
        countries={countries}
        scouts={[]}
        currentDayNumber={1}
        defaultCountryId="country-it"
        scoutingSupervision={{
          currentPercentage: 0,
          stableThroughDayNumber: null,
          remainingDays: 0,
          effects: [],
        }}
      />,
    );

    expect(markup).toContain('name="countryId" value="country-it"');
    expect(markup).toContain("Italie");
  });

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

  it("désactive les durées qui dépasseraient le J28 et ouvre l’erreur en popup", () => {
    const markup = renderToStaticMarkup(
      <YouthScoutingMap
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
        scouts={[
          {
            id: "scout-1",
            contractId: "contract-1",
            firstName: "Ramil",
            lastName: "Ələkbərova",
            level: 2,
            countryId: "country-fr",
            countryName: "France",
            countryCode: "FR",
            activeMissionId: null,
          },
        ]}
        currentDayNumber={22}
        errorMessage="Mission non lancée : la durée choisie dépasse le J28."
        scoutingSupervision={{
          currentPercentage: 0,
          stableThroughDayNumber: null,
          remainingDays: 0,
          effects: [],
        }}
      />,
    );

    expect(markup).toContain(
      '<option value="7" disabled="">7 jours — après J28</option>',
    );
    expect(markup).toContain("la durée de 7 jours dépasserait le J28");
    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain("Le scout reste disponible");
    expect(markup).toContain(
      "Mission non lancée : la durée choisie dépasse le J28.",
    );
  });

  it("explique pourquoi aucune mission ne peut partir après le J25", () => {
    const markup = renderToStaticMarkup(
      <YouthScoutingMap
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
        scouts={[
          {
            id: "scout-1",
            contractId: "contract-1",
            firstName: "Ramil",
            lastName: "Ələkbərova",
            level: 2,
            countryId: "country-fr",
            countryName: "France",
            countryCode: "FR",
            activeMissionId: null,
          },
        ]}
        currentDayNumber={26}
        scoutingSupervision={{
          currentPercentage: 0,
          stableThroughDayNumber: null,
          remainingDays: 0,
          effects: [],
        }}
      />,
    );

    expect(markup).toContain("Aucune durée disponible");
    expect(markup).toContain(
      "il ne reste plus assez de temps pour une mission de 3 jours avant le J28",
    );
    expect(markup).toContain("Pourquoi le scouting est indisponible ?");
  });

  it("rend la carte panoramique accessible par glissement sur téléphone", () => {
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

    expect(markup).toContain("data-scouting-map-scroll");
    expect(markup).toContain("data-scouting-world-map");
    expect(markup).toContain("overflow-x-auto");
    expect(markup).toContain(
      "Faites glisser la carte horizontalement pour explorer le monde",
    );
  });
});
