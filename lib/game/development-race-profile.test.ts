import { describe, expect, it } from "vitest";

import { getDevelopmentMixedProfileDetail } from "./development-race-profile";

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
    ).toBe("Programme : sprint · pavés · vallons");
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
