import { describe, expect, it } from "vitest";

import {
  getRiderChampionshipBorderBackground,
  resolveFormerChampionshipBorder,
} from "./rider-championship-border";

const emptyHistory = {
  worldTitles: [],
  continentalTitles: [],
  nationalTitles: [],
};

describe("liseré des anciens champions", () => {
  it("ne remplace pas le maillot distinctif du tenant du titre", () => {
    expect(
      resolveFormerChampionshipBorder({
        ...emptyHistory,
        worldTitles: [
          {
            type: "road",
            seasonName: "Saison 3",
            isActive: true,
          },
        ],
      }),
    ).toBeNull();
  });

  it("donne la priorité au palmarès mondial, route comme CLM", () => {
    const border = resolveFormerChampionshipBorder({
      worldTitles: [
        {
          type: "time_trial",
          seasonName: "Saison 1",
          isActive: false,
        },
      ],
      continentalTitles: [
        {
          type: "road",
          continentCode: "europe",
          continentName: "Europe",
          seasonName: "Saison 2",
          isActive: false,
        },
      ],
      nationalTitles: [],
    });

    expect(border).toMatchObject({
      kind: "world",
      label: "Ancien champion du monde CLM",
    });
    expect(border?.colors).toHaveLength(5);
  });

  it("reprend les couleurs continentales ou nationales du dernier titre", () => {
    const continentalBorder = resolveFormerChampionshipBorder({
      ...emptyHistory,
      continentalTitles: [
        {
          type: "road",
          continentCode: "africa",
          continentName: "Afrique",
          seasonName: "Saison 1",
          isActive: false,
        },
        {
          type: "time_trial",
          continentCode: "europe",
          continentName: "Europe",
          seasonName: "Saison 2",
          isActive: false,
        },
      ],
    });
    const nationalBorder = resolveFormerChampionshipBorder({
      ...emptyHistory,
      nationalTitles: [
        {
          type: "time_trial",
          countryCode: "FR",
          countryName: "France",
          seasonName: "Saison 2",
          isActive: false,
        },
      ],
    });

    expect(continentalBorder).toMatchObject({
      kind: "continental",
      label: "Ancien champion Europe CLM",
    });
    expect(nationalBorder).toMatchObject({
      kind: "national",
      label: "Ancien champion national France CLM",
    });
    expect(getRiderChampionshipBorderBackground(nationalBorder!)).toContain(
      "linear-gradient",
    );
  });
});
