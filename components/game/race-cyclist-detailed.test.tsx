import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RiderSimulationInput } from "@/lib/game/race-simulation";

import {
  getRaceCyclistMorphology,
  getRaceCyclistTeamHelmetPalette,
  SideRaceCyclist,
  TopRaceCyclist,
} from "./race-cyclist-detailed";

const rider: RiderSimulationInput = {
  id: "detailed-rider",
  name: "Cédric Gérard",
  teamId: "team-detail",
  teamName: "Équipe Detail",
  teamPrimaryColor: "#173F5F",
  teamSecondaryColor: "#F2C94C",
  teamJersey: {
    primaryColor: "#214E43",
    secondaryColor: "#E58A2B",
    accentColor: "#EAF4EF",
    pattern: "chevron",
    status: "sponsored",
    imagePath: "/images/sponsors/detail/jersey.png",
  },
  avatarProfileKey: "western_europe",
  avatarSeed: 42,
  age: 25,
  form: 80,
  role: "leader",
  ratings: {
    flat: 70,
    mountain: 70,
    hills: 70,
    cobbles: 60,
    downhill: 66,
    sprint: 61,
    acceleration: 65,
    timeTrial: 68,
    prologue: 67,
    endurance: 72,
    resistance: 70,
    recovery: 69,
    breakaway: 64,
  },
};

describe("detailed race cyclist", () => {
  it("draws a detailed bike with a single synchronized pedal rig", () => {
    const markup = renderToStaticMarkup(
      <SideRaceCyclist rider={rider} isMoving />,
    );

    expect(markup).toContain('data-detailed-race-bike="true"');
    expect(markup).toContain('data-race-bike-texture="carbon-metal"');
    expect(markup).toContain('data-race-bike-detail="competition-road"');
    expect(markup).toContain('data-race-bike-component="carbon-frame"');
    expect(markup).toContain('data-race-bike-component="drivetrain"');
    expect(markup).toContain('data-race-bike-component="disc-brakes"');
    expect(markup).toContain('data-race-bike-component="cockpit"');
    expect(markup).toContain('data-race-bike-component="hydration"');
    expect(markup).toContain('data-race-bike-component="cables"');
    expect(markup).toContain('data-race-bike-detail="professional-drop-bars"');
    expect(markup).toContain('data-race-bike-detail="electronic-derailleur"');
    expect(markup).toContain('data-race-wheel-detail="professional-road-wheel"');
    expect(markup).toContain('data-race-jersey-texture="technical-fabric"');
    expect(markup).toContain('data-race-helmet-texture="vented-shell"');
    expect(markup).toContain('data-race-cyclist-anatomy="torso"');
    expect(markup).toContain('data-race-cyclist-anatomy="pelvis"');
    expect(markup).toContain('data-race-cyclist-anatomy="front-upper-arm"');
    expect(markup).toContain('data-race-cyclist-anatomy="front-forearm"');
    expect(markup).toContain('data-race-cyclist-anatomy="front-leg"');
    expect(markup).toContain('data-race-cyclist-anatomy="rear-leg"');
    expect(markup).toContain('data-race-cyclist-joint="front-knee"');
    expect(markup).toContain('data-race-cyclist-joint="front-shoulder"');
    expect(markup.match(/data-race-cyclist-anatomy="articulated-kneecap"/g)).toHaveLength(2);
    expect(markup).toContain('data-race-rider-equipment="helmet-y-strap"');
    expect(markup).toContain('data-race-rider-equipment="glove"');
    expect(markup).toContain('data-race-rider-equipment="aero-sock"');
    expect(markup).toContain('data-race-jersey-detail="technical-collar"');
    expect(markup).toContain('data-race-shorts-detail="compression-panels"');
    expect(markup).toContain('data-race-face-detail="skin-volume"');
    expect(markup).toContain('data-race-jersey-artwork="official-team-kit"');
    expect(markup).toContain(rider.teamJersey!.imagePath!);
    expect(markup).not.toContain("m35 19-8 8");
    expect(markup).toContain('data-race-cyclist-direction="finish-right"');
    expect(markup).toContain('data-race-cyclist-scale="broadcast-aligned"');
    expect(markup).toContain("cm-race-cyclist");
    expect(markup).toContain('data-race-cyclist-pose="seated"');
    expect(markup).toContain('data-race-pedal-rig="synchronized"');
    expect(markup).toContain('data-race-pedaling="active"');
    expect(markup.match(/data-race-foot-contact=/g)).toHaveLength(2);
    expect(markup).toContain('data-race-pedal-platform="front"');
    expect(markup).toContain('data-race-pedal-platform="rear"');
    expect(markup).toContain('data-race-bike-detail="anatomic-saddle"');
    expect(markup).toContain('data-race-pedal-cycle-duration="0.5s"');
    expect(markup).not.toContain("cm-bike-leg-front");
    expect(markup).not.toContain("cm-bike-leg-back");
    expect((markup.match(/<path/g) ?? []).length).toBeGreaterThan(20);
  });

  it("uses real height and weight to keep rider silhouettes distinct", () => {
    const climber = {
      ...rider,
      physiology: {
        heightCm: 169,
        weightKg: 56,
        baselineWeightKg: 56,
        physiologyVersion: 1,
      },
    };
    const sprinter = {
      ...rider,
      id: "powerful-rider",
      physiology: {
        heightCm: 188,
        weightKg: 84,
        baselineWeightKg: 84,
        physiologyVersion: 1,
      },
    };

    const climberMorphology = getRaceCyclistMorphology(climber);
    const sprinterMorphology = getRaceCyclistMorphology(sprinter);
    const markup = renderToStaticMarkup(
      <>
        <SideRaceCyclist rider={climber} />
        <SideRaceCyclist rider={sprinter} />
      </>,
    );

    expect(climberMorphology.profile).toBe("slender");
    expect(sprinterMorphology.profile).toBe("powerful");
    expect(sprinterMorphology.heightScale).toBeGreaterThan(
      climberMorphology.heightScale,
    );
    expect(sprinterMorphology.breadthScale).toBeGreaterThan(
      climberMorphology.breadthScale,
    );
    expect(markup).toContain('data-race-rider-height-cm="169"');
    expect(markup).toContain('data-race-rider-weight-kg="84"');
    expect(markup).toContain('data-race-rider-proportions="physiology-scaled"');
  });

  it("uses a dedicated anatomically raised pose when climbing out of the saddle", () => {
    const markup = renderToStaticMarkup(
      <SideRaceCyclist rider={rider} isMoving ridingPose="standing" />,
    );

    expect(markup).toContain('data-race-cyclist-pose="standing-climb"');
    expect(markup).toContain("cm-bike-standing");
    expect(markup).toContain("M39.2 23.5C38.8 19.2");
    expect(markup).toContain('data-race-rider-proportions="bike-anchored"');
    expect(markup).toContain('data-race-pedal-rig="synchronized"');
    expect(markup).not.toContain("cm-bike-bob");
  });

  it("changes cadence and airflow for a rider currently taking a relay", () => {
    const markup = renderToStaticMarkup(
      <SideRaceCyclist rider={rider} isMoving effort="relay" />,
    );

    expect(markup).toContain('data-race-cyclist-effort="relay"');
    expect(markup).toContain('data-race-cyclist-airflow="relay"');
    expect(markup).toContain("cm-race-cyclist-effort-relay");
    expect(markup).toContain('data-race-pedal-cycle-duration="0.38s"');
  });

  it("keeps team colors on helmets in side and top views", () => {
    const palette = getRaceCyclistTeamHelmetPalette(rider);
    const markup = renderToStaticMarkup(
      <>
        <SideRaceCyclist rider={{ ...rider, classificationJersey: "general" }} />
        <TopRaceCyclist rider={{ ...rider, classificationJersey: "general" }} />
      </>,
    );

    expect(palette).toEqual({
      primary: "#214E43",
      secondary: "#E58A2B",
      accent: "#EAF4EF",
    });
    expect(markup.match(/data-race-helmet-team-colors="true"/g)).toHaveLength(2);
    expect(markup.match(/data-race-cyclist-scale="broadcast-aligned"/g)).toHaveLength(2);
    expect(markup).toContain("h-10 w-24");
    expect(markup).toContain("#214E43");
    expect(markup).toContain("#E58A2B");
  });

  it("uses an aero helmet and an optional rear disc wheel in time trials", () => {
    const markup = renderToStaticMarkup(
      <SideRaceCyclist
        rider={rider}
        timeTrial
        rearDiscWheel
      />,
    );

    expect(markup).toContain('data-race-time-trial-helmet="aero"');
    expect(markup).toContain('data-race-wheel="rear-disc"');
    expect(markup).toContain('data-race-wheel="spoked"');
  });
  it("raises both arms for the winner before the line", () => {
    const markup = renderToStaticMarkup(
      <>
        <SideRaceCyclist rider={rider} celebrating />
        <TopRaceCyclist rider={rider} celebrating />
      </>,
    );

    expect(markup.match(/data-race-victory-pose="arms-raised"/g)).toHaveLength(2);
    expect(markup.match(/data-race-victory-torso="upright"/g)).toHaveLength(3);
    expect(markup).toContain("M42 10C39.8 12.3 39.2 16.1");
    expect(markup).toContain("M43 14C41 11 39.2 7.3 37 4");
    expect(markup.match(/cm-victory-arms/g)).toHaveLength(2);
  });
});
