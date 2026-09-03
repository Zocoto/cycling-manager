import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getRaceCyclistJerseyVisual,
  getRaceCyclistSkinPalette,
  SideRaceCyclist,
  TopRaceCyclist,
} from "./race-cyclist";
import type { RiderSimulationInput } from "@/lib/game/race-simulation";

const baseRider: RiderSimulationInput = {
  id: "rider-west-africa",
  name: "Amadou Diallo",
  teamId: "team-a",
  teamName: "Team A",
  teamPrimaryColor: "#176951",
  teamSecondaryColor: "#FFFDF4",
  avatarProfileKey: "west_africa",
  avatarSeed: 123456,
  age: 26,
  form: 75,
  role: "sprinter",
  ratings: {
    flat: 70,
    mountain: 50,
    hills: 55,
    cobbles: 52,
    downhill: 60,
    sprint: 78,
    acceleration: 76,
    timeTrial: 58,
    prologue: 60,
    endurance: 67,
    resistance: 66,
    recovery: 64,
    breakaway: 48,
  },
};

describe("race cyclist visuals", () => {
  it("réutilise la carnation unique de l'avatar dans les deux vues live", () => {
    const palette = getRaceCyclistSkinPalette(baseRider);
    const markup = renderToStaticMarkup(
      <>
        <SideRaceCyclist rider={baseRider} />
        <TopRaceCyclist rider={baseRider} />
      </>
    );

    expect(palette.skinTone).not.toBe("#E7B18C");
    expect(markup).toContain(`fill="${palette.skinTone}"`);
    expect(markup).toContain(`stroke="${palette.skinShadow}"`);
    expect(markup).not.toContain("#E7B18C");
  });

  it("priorise la palette et le motif du sponsor dans les deux vues live", () => {
    const sponsoredRider: RiderSimulationInput = {
      ...baseRider,
      teamJersey: {
        primaryColor: "#5B1A78",
        secondaryColor: "#F4C542",
        accentColor: "#FFFFFF",
        pattern: "diagonal",
        status: "sponsored",
        imagePath: "/images/sponsors/test/jersey-modern.png",
      },
    };
    const visual = getRaceCyclistJerseyVisual(sponsoredRider);
    const markup = renderToStaticMarkup(
      <>
        <SideRaceCyclist rider={sponsoredRider} />
        <TopRaceCyclist rider={sponsoredRider} />
      </>,
    );

    expect(visual).toMatchObject({
      status: "team",
      primaryColor: "#5B1A78",
      secondaryColor: "#F4C542",
      accentColor: "#FFFFFF",
    });
    expect(markup).toContain("#5B1A78");
    expect(markup).toContain("#F4C542");
  });

  it("affiche le drapeau exact du champion de France dans le live", () => {
    const champion: RiderSimulationInput = {
      ...baseRider,
      activeNationalChampion: {
        countryCode: "FR",
        championshipType: "road",
      },
    };
    const visual = getRaceCyclistJerseyVisual(champion);
    const markup = renderToStaticMarkup(
      <SideRaceCyclist rider={champion} />
    );

    expect(visual).toMatchObject({
      status: "national-champion",
      countryCode: "FR",
      primaryColor: "#000091",
      secondaryColor: "#FFFFFF",
      accentColor: "#E1000F",
    });
    expect(markup).toContain('data-national-champion-flag="fr"');
    expect(markup).toContain('href="/images/flags/4x3/fr.svg"');
    expect(markup).not.toContain("foreignObject");
  });

  it("affiche le dessin fédéral publié sur le maillot de la sélection", () => {
    const nationalRider: RiderSimulationInput = {
      ...baseRider,
      teamJersey: {
        primaryColor: "#FFFFFF",
        secondaryColor: "#111111",
        accentColor: "#F2C94C",
        pattern: "solid",
        status: "national-team",
        countryCode: "BE",
        nationalDesign: {
          schemaVersion: 2,
          baseColor: "#FFFFFF",
          elements: [
            {
              id: "belgian-band",
              kind: "band",
              shape: "rectangle",
              color: "#111111",
              secondaryColor: "#FDDA24",
              x: 60,
              y: 72,
              width: 180,
              height: 22,
              rotation: 12,
              opacity: 1,
            },
          ],
        },
      },
    };
    const visual = getRaceCyclistJerseyVisual(nationalRider);
    const markup = renderToStaticMarkup(
      <>
        <SideRaceCyclist rider={nationalRider} />
        <TopRaceCyclist rider={nationalRider} />
      </>,
    );

    expect(visual).toMatchObject({
      status: "national-team",
      countryCode: "BE",
      nationalDesign: { schemaVersion: 2 },
    });
    expect(markup).toContain("belgian-band");
    expect(markup).toContain("#FDDA24");
    expect(markup).not.toContain('data-national-champion-flag="be"');
  });

  it("fait passer le maillot jaune devant le titre national", () => {
    const tourLeader: RiderSimulationInput = {
      ...baseRider,
      activeNationalChampion: {
        countryCode: "FR",
        championshipType: "road",
      },
      classificationJersey: "general",
    };
    const visual = getRaceCyclistJerseyVisual(tourLeader);
    const markup = renderToStaticMarkup(
      <SideRaceCyclist rider={tourLeader} />
    );

    expect(visual).toMatchObject({
      status: "classification-leader",
      shortLabel: "Maillot jaune",
      primaryColor: "#F5D547",
    });
    expect(markup).not.toContain("data-national-champion-flag");
  });

  it("dessine les pois rouges dans les deux vues du grimpeur", () => {
    const mountainLeader: RiderSimulationInput = {
      ...baseRider,
      classificationJersey: "mountain",
    };
    const markup = renderToStaticMarkup(
      <>
        <SideRaceCyclist rider={mountainLeader} />
        <TopRaceCyclist rider={mountainLeader} />
      </>
    );

    expect(markup).toContain("#D62839");
    expect((markup.match(/<circle/g) ?? []).length).toBeGreaterThan(10);
  });
});
