import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FederationSelectionWorkbench } from "@/components/game/federation-selection-workbench";
import {
  FederationSelectionCoursePreview,
  getFederationCourseProfileLabel,
} from "@/components/game/federation-selection-course";
import type { FederationSelectionCourse } from "@/lib/game/federation-selection-weather";
import { getRaceWeather } from "@/lib/game/race-weather";

const course: FederationSelectionCourse = {
  raceEditionId: "edition-cc",
  stageId: "stage-cc",
  stageName: "Championnats d’Afrique en ligne",
  stageType: "road",
  profileType: "hilly",
  distanceKm: 180,
  dayNumber: 16,
  countryCode: "ZA",
  countryName: "Afrique du Sud",
  href: "/jeu/courses/championnats-afrique",
  segments: [
    { segmentNumber: 1, distanceKm: 80, terrain: "flat", averageGradientPct: 0, surface: "asphalt", prime: null },
    { segmentNumber: 2, distanceKm: 5, terrain: "climb", averageGradientPct: 5, surface: "asphalt", prime: null },
    { segmentNumber: 3, distanceKm: 95, terrain: "descent", averageGradientPct: -1, surface: "asphalt", prime: null },
  ],
};

describe("FederationSelectionWorkbench hosting", () => {
  it("shows the actual course at J1 while weather and automatic selection stay locked", () => {
    const markup = renderToStaticMarkup(
      <FederationSelectionWorkbench
        countryCode="MU"
        countryName="Maurice"
        riders={[]}
        gameYear={3}
        selectionState={{
          canManage: true,
          automaticSelection: true,
          competitionHosts: {},
          forecasts: {
            "cc-pro-road": {
              slotKey: "cc-pro-road", gameYear: 3, eventDayNumber: 16,
              revealDayNumber: 15, isVisible: false, isOfficialCourse: true,
              weather: null, course,
            },
          },
          selections: {},
          pendingConfirmations: [],
        }}
      />,
    );
    expect(markup).toContain("Profil : Vallonné");
    expect(markup).not.toContain("Profil : Route");
    expect(markup).toContain("J16 · Pays hôte : Afrique du Sud");
    expect(markup).toContain("180 km");
    expect(markup).toContain('href="/jeu/courses/championnats-afrique"');
    expect(markup).toContain("Disponible J15");
    // Navigation and read-only profiles must remain usable in automatic mode.
    const lockedChoices = markup.indexOf("<fieldset disabled");
    expect(lockedChoices).toBeGreaterThan(markup.indexOf("Épreuve à préparer"));
    expect(lockedChoices).toBeGreaterThan(markup.indexOf("</svg>"));
    expect(lockedChoices).toBeGreaterThan(markup.indexOf("Voir la course"));
  });

  it("keeps discipline distinct from terrain, including a cobbled time trial", () => {
    const timeTrial: FederationSelectionCourse = {
      ...course, stageType: "individual_time_trial", profileType: "time_trial",
      segments: [{ segmentNumber: 1, distanceKm: 30, terrain: "flat", averageGradientPct: 0, surface: "cobbles", prime: null }],
    };
    expect(getFederationCourseProfileLabel(timeTrial)).toBe("Plat · Pavé");
    const markup = renderToStaticMarkup(<FederationSelectionCoursePreview course={timeTrial} />);
    expect(markup).toContain("CLM individuel");
  });

  it("shows junior course information without inventing an elevation chart", () => {
    const junior = { ...course, stageName: "Mondiaux juniors", profileType: "mountain" as const, distanceKm: 120, segments: [] };
    expect(getFederationCourseProfileLabel(junior)).toBe("Montagneux");
    const markup = renderToStaticMarkup(<FederationSelectionCoursePreview course={junior} />);
    expect(markup).toContain("Mondiaux juniors");
    expect(markup).toContain("120 km");
    expect(markup).not.toContain("<svg");
  });

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
    expect(markup).toContain("Jeux quadriennaux · Montagne");
    expect(markup).toContain("Nations Cup Juniors · Route");
    expect(markup).not.toContain("Nations Cup · Montagne");
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
