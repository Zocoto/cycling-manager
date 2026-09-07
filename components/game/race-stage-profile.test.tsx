import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceSegmentPrime,
  RaceStageSegment,
} from "@/lib/game/race-profiles";

import { RaceStageProfile } from "./race-stage-profile";

describe("RaceStageProfile", () => {
  it("ne mentionne pas de GPM avec un sprint intermediaire seul", () => {
    const markup = renderToStaticMarkup(
      <RaceStageProfile
        segments={[
          createSegment({
            type: "intermediate_sprint",
            category: null,
            pointsScale: [20, 17, 15],
          }),
        ]}
        showLegend
      />
    );

    expect(markup).not.toContain("GPM");
    expect(markup).toContain("Sprint interm");
  });

  it("conserve la mention GPM quand une prime montagne existe", () => {
    const markup = renderToStaticMarkup(
      <RaceStageProfile
        segments={[
          createSegment({
            type: "mountain",
            category: "3",
            pointsScale: [2, 1],
          }),
        ]}
        showLegend
      />
    );

    expect(markup).toContain("GPM");
  });

  it("affiche la météo connue dans le coin supérieur du profil", () => {
    const markup = renderToStaticMarkup(
      <RaceStageProfile
        segments={[createSegment(null)]}
        compact
        weather={{
          condition: "rain",
          rainIntensity: "steady",
          temperatureC: 13,
          windSpeedKph: 21,
          windDirection: "crosswind",
          windIntensity: "breeze",
          isWet: true,
        }}
      />,
    );

    expect(markup).toContain('data-stage-weather="rain"');
    expect(markup).toContain('data-stage-weather-slot="reserved"');
    expect(markup).toContain("Pluie continue");
    expect(markup).toContain("Météo de l’étape");
    expect(markup.indexOf('data-stage-weather="rain"')).toBeLessThan(
      markup.indexOf("<svg"),
    );
  });

  it("masque la condition et affiche un verrou avant la fenêtre de prévision", () => {
    const markup = renderToStaticMarkup(
      <RaceStageProfile
        segments={[createSegment(null)]}
        compact
        weatherUnavailableLabel="Prévision disponible dans 3 jours"
      />,
    );

    expect(markup).toContain('data-stage-weather="hidden"');
    expect(markup).toContain("Prévision disponible dans 3 jours");
    expect(markup).not.toContain("Météo de l’étape");
  });
});

function createSegment(
  prime: RaceSegmentPrime | null,
): RaceStageSegment {
  return {
    segmentNumber: 1,
    distanceKm: 10,
    terrain: "flat",
    averageGradientPct: 0,
    surface: "asphalt",
    prime,
  };
}
