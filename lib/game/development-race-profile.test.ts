import { describe, expect, it } from "vitest";

import {
  buildDevelopmentRaceDisplaySegments,
  DEVELOPMENT_RACE_PROFILE_LABELS,
  getDevelopmentMixedProfileDetail,
} from "./development-race-profile";
import { getStageDistance } from "./race-profiles";

describe("buildDevelopmentRaceDisplaySegments", () => {
  it("dessine un parcours junior déterministe à partir du profil officiel", () => {
    const input = {
      stageId: "world-junior-road",
      distanceKm: 142,
      profileType: "hilly" as const,
    };
    const first = buildDevelopmentRaceDisplaySegments(input);
    const second = buildDevelopmentRaceDisplaySegments(input);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(getStageDistance(first)).toBe(142);
    expect(first.some((segment) => segment.terrain === "climb")).toBe(true);
  });
});

describe("getDevelopmentMixedProfileDetail", () => {
  it("détaille les terrains successifs d'un tour mixte", () => {
    expect(
      getDevelopmentMixedProfileDetail({
        profileType: "mixed",
        raceFormat: "stage_race",
        stages: [
          { profileType: "sprint" },
          { profileType: "cobbles" },
          { profileType: "hilly" },
          { profileType: "cobbles" },
        ],
      } as Parameters<typeof getDevelopmentMixedProfileDetail>[0]),
    ).toBe("Programme : plaine · pavés · vallons");
  });

  it("regroupe les profils plats et sprint sous Plaine", () => {
    expect(DEVELOPMENT_RACE_PROFILE_LABELS.flat).toBe("Plaine");
    expect(DEVELOPMENT_RACE_PROFILE_LABELS.sprint).toBe("Plaine");
  });

  it("explique la nature polyvalente d'une classique mixte", () => {
    expect(
      getDevelopmentMixedProfileDetail({
        profileType: "mixed",
        raceFormat: "one_day",
        stages: [{ profileType: "mixed" }],
      } as Parameters<typeof getDevelopmentMixedProfileDetail>[0]),
    ).toBe(
      "Parcours polyvalent : plaine · vallons · montagne · rouleur",
    );
  });

  it("ne rajoute aucun détail aux profils simples", () => {
    expect(
      getDevelopmentMixedProfileDetail({
        profileType: "cobbles",
        raceFormat: "one_day",
        stages: [{ profileType: "cobbles" }],
      } as Parameters<typeof getDevelopmentMixedProfileDetail>[0]),
    ).toBeNull();
  });
});
