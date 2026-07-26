import { describe, expect, it } from "vitest";

import {
  createAmateurRiderJersey,
  createNationalChampionRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  getNationalChampionPalette,
} from "./rider-jersey";

describe("maillot contextuel du portrait", () => {
  it("reprend les couleurs et le motif de l’équipe amateur", () => {
    expect(
      createAmateurRiderJersey({
        pattern: "diagonal",
        primaryColor: "#123456",
        secondaryColor: "#ABCDEF",
        accentColor: "#FEDCBA",
      }),
    ).toEqual({
      pattern: "diagonal",
      primaryColor: "#123456",
      secondaryColor: "#ABCDEF",
      accentColor: "#FEDCBA",
      status: "amateur",
    });
  });

  it("propage les nouveaux motifs jusque sur les avatars", () => {
    expect(
      createAmateurRiderJersey({
        pattern: "chevron",
        primaryColor: "#123456",
        secondaryColor: "#ABCDEF",
        accentColor: "#FEDCBA",
      }).pattern,
    ).toBe("chevron");

    expect(
      createAmateurRiderJersey({
        pattern: "checkerboard",
        primaryColor: "#123456",
        secondaryColor: "#ABCDEF",
        accentColor: "#FEDCBA",
      }).pattern,
    ).toBe("checkerboard");
  });

  it("convertit le style du sponsor pour le buste du portrait", () => {
    expect(
      createSponsoredRiderJersey({
        colors: {
          primary: "#102030",
          secondary: "#405060",
          accent: "#708090",
          background: "#FFFFFF",
          text: "#000000",
        },
        style: "bold",
      }),
    ).toMatchObject({
      pattern: "split",
      primaryColor: "#102030",
      status: "sponsored",
    });
  });

  it("reprend les couleurs exactes du drapeau bulgare", () => {
    expect(getNationalChampionPalette("BG").dominantColors).toEqual([
      "#FFFFFF",
      "#00966E",
      "#D62612",
    ]);
    expect(
      createNationalChampionRiderJersey({
        countryCode: "bg",
        championshipType: "road",
      }),
    ).toMatchObject({
      status: "national-champion",
      countryCode: "BG",
      championshipType: "road",
      primaryColor: "#FFFFFF",
      secondaryColor: "#00966E",
      accentColor: "#D62612",
      pattern: "solid",
    });
  });

  it("conserve le bleu, le blanc et le rouge du drapeau français", () => {
    expect(getNationalChampionPalette("FR").dominantColors).toEqual([
      "#000091",
      "#FFFFFF",
      "#E1000F",
    ]);
  });
  it("utilise un maillot gris pour un coureur libre", () => {
    expect(FREE_AGENT_RIDER_JERSEY).toMatchObject({
      pattern: "solid",
      status: "free-agent",
      primaryColor: "#7B8582",
    });
  });
});
