import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceGroupSnapshot,
  RiderSimulationInput,
} from "@/lib/game/race-simulation";

import {
  RaceGroupFormation,
  RaceSupportConvoy,
} from "./race-group-formation";

function buildRider(index: number): RiderSimulationInput {
  return {
    id: `rider-${index}`,
    name: `Coureur ${index}`,
    teamId: `team-${index % 3}`,
    teamName: `Équipe ${index % 3}`,
    teamPrimaryColor: "#173F5F",
    teamSecondaryColor: "#F2C94C",
    avatarProfileKey: "western_europe",
    avatarSeed: index,
    age: 24,
    form: 82,
    role: index === 1 ? "leader" : "domestique",
    ratings: {
      flat: 68,
      mountain: 64,
      hills: 70,
      cobbles: 61,
      downhill: 66,
      sprint: 63,
      acceleration: 65,
      timeTrial: 67,
      prologue: 66,
      endurance: 71,
      resistance: 69,
      recovery: 68,
      breakaway: 65,
    },
  };
}

describe("race group formation", () => {
  it("spreads a group across several road lanes and depths", () => {
    const riders = Array.from({ length: 9 }, (_, index) =>
      buildRider(index + 1),
    );
    const riderIds = riders.map((rider) => rider.id);
    const group: RaceGroupSnapshot = {
      id: "peloton",
      label: "Peloton",
      type: "peloton",
      riderIds,
      gapToLeaderSeconds: 0,
      averageEnergy: 74,
    };
    const markup = renderToStaticMarkup(
      <RaceGroupFormation
        group={group}
        riderIds={riderIds.slice(0, 8)}
        riderById={new Map(riders.map((rider) => [rider.id, rider]))}
        incidents={[]}
        primeWinnerId={null}
        primeResult={null}
        isMoving
        compact={false}
      />,
    );

    expect(markup).toContain('data-race-group-formation="wide"');
    expect(markup.match(/translate\(/g)).toHaveLength(8);
    expect(markup).toContain("translate(-");
    expect(markup).toContain("translate(4");
    expect(markup).toContain("+1");
  });

  it("renders the optional two-car convoy in team colors", () => {
    const markup = renderToStaticMarkup(
      <RaceSupportConvoy
        left={18}
        top={58}
        primaryColor="#145A4A"
        secondaryColor="#F2C94C"
        isMoving
        showSecondCar
      />,
    );

    expect(markup).toContain('data-race-support-convoy="true"');
    expect(markup.match(/cm-support-car/g)).toHaveLength(2);
    expect(markup).toContain("#145A4A");
    expect(markup).toContain("#F2C94C");
  });
});
