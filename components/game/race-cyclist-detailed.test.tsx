import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RiderSimulationInput } from "@/lib/game/race-simulation";

import {
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
  it("draws a detailed bike and independently animated legs", () => {
    const markup = renderToStaticMarkup(
      <SideRaceCyclist rider={rider} isMoving />,
    );

    expect(markup).toContain('data-detailed-race-bike="true"');
    expect(markup).toContain('data-race-bike-texture="carbon-metal"');
    expect(markup).toContain('data-race-jersey-texture="technical-fabric"');
    expect(markup).toContain('data-race-helmet-texture="vented-shell"');
    expect(markup).toContain("cm-bike-leg-front");
    expect(markup).toContain("cm-bike-leg-back");
    expect((markup.match(/<path/g) ?? []).length).toBeGreaterThan(20);
  });

  it("changes cadence and airflow for a rider currently taking a relay", () => {
    const markup = renderToStaticMarkup(
      <SideRaceCyclist rider={rider} isMoving effort="relay" />,
    );

    expect(markup).toContain('data-race-cyclist-effort="relay"');
    expect(markup).toContain('data-race-cyclist-airflow="relay"');
    expect(markup).toContain("cm-race-cyclist-effort-relay");
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
    expect(markup).toContain("M42 10C40 12 39 16");
    expect(markup).toContain("M43 14C41 11 39.2 7.3 37 4");
    expect(markup.match(/cm-victory-arms/g)).toHaveLength(2);
  });
});
