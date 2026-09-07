import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FederationSelectionWorkbench } from "@/components/game/federation-selection-workbench";
import { getRaceWeather } from "@/lib/game/race-weather";

describe("FederationSelectionWorkbench hosting", () => {
  it("uses the seasonal professional host without changing the static slot", () => {
    const markup = renderToStaticMarkup(
      <FederationSelectionWorkbench
        countryCode="FR"
        countryName="France"
        riders={[]}
        gameYear={4}
        selectionState={{
          canManage: false,
          automaticSelection: true,
          competitionHosts: {
            continental_championship_pro: {
              countryCode: "DE",
              countryName: "Allemagne",
            },
          },
          forecasts: {},
          selections: {},
          pendingConfirmations: [],
        }}
      />,
    );

    expect(markup).toContain("Pays hôte : Allemagne");
    expect(markup).toContain("fi-de");
  });

  it("shows statistical sorting, rider affinities and federation weather", () => {
    const weather = getRaceWeather("federation-selection-component");
    const markup = renderToStaticMarkup(
      <FederationSelectionWorkbench
        countryCode="FR"
        countryName="France"
        riders={[
          {
            id: "rider-1",
            teamId: "team-1",
            name: "Lou Martin",
            category: "professional",
            juniorAffiliation: null,
            teamName: "Vélo Club",
            age: 24,
            profile: "Montagne",
            overall: 78,
            ratings: {
              mountain: 84,
              hills: 80,
              flat: 71,
              timeTrial: 73,
              cobbles: 66,
              sprint: 64,
              acceleration: 76,
              downhill: 79,
              endurance: 81,
              resistance: 82,
              recovery: 77,
              breakaway: 74,
              prologue: 69,
            },
          },
        ]}
        gameYear={3}
        selectionState={{
          canManage: true,
          automaticSelection: false,
          competitionHosts: {},
          forecasts: {
            "cc-pro-road": {
              slotKey: "cc-pro-road",
              gameYear: 3,
              eventDayNumber: 15,
              revealDayNumber: 14,
              isVisible: true,
              isOfficialCourse: true,
              weather,
            },
          },
          selections: {},
          pendingConfirmations: [],
        }}
      />,
    );

    expect(markup).toContain("Trier par");
    expect(markup).toContain("Accélération");
    expect(markup).toContain("Affinités météo");
    expect(markup).toContain("Prévision fédérale · parcours officiel");
    expect(markup).toContain("Condition favorite");
  });
});
