import { describe, expect, it } from "vitest";

import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
} from "./rider-jersey";

describe("maillot contextuel du portrait", () => {
  it("reprend les couleurs et le motif de l’équipe amateur", () => {
    expect(
      createAmateurRiderJersey({
        pattern: "diagonal",
        primaryColor: "#123456",
        secondaryColor: "#ABCDEF",
        accentColor: "#FEDCBA",
      })
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
      }).pattern
    ).toBe("chevron");

    expect(
      createAmateurRiderJersey({
        pattern: "checkerboard",
        primaryColor: "#123456",
        secondaryColor: "#ABCDEF",
        accentColor: "#FEDCBA",
      }).pattern
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
      })
    ).toMatchObject({
      pattern: "split",
      primaryColor: "#102030",
      status: "sponsored",
    });
  });

  it("utilise un maillot gris pour un coureur libre", () => {
    expect(FREE_AGENT_RIDER_JERSEY).toMatchObject({
      pattern: "solid",
      status: "free-agent",
      primaryColor: "#7B8582",
    });
  });
});
