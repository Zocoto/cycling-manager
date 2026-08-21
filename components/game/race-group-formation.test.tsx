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

    expect(markup).toContain('data-race-group-formation="peloton-front"');
    expect(markup).toContain('data-race-rider-weave="active"');
    expect(markup.match(/translate\(/g)).toHaveLength(8);
    expect(markup).toContain("translate(-");
    expect(markup).toContain("translate(62");
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
    expect(markup).toContain('data-race-road-anchor="wheels"');
    expect(markup.match(/data-race-car-front="right"/g)).toHaveLength(2);
    expect(markup).not.toContain("-bottom-7");
    expect(markup.match(/cm-support-car/g)).toHaveLength(2);
    expect(markup.match(/data-race-car-direction="right"/g)).toHaveLength(2);
    expect(markup.match(/cm-race-car-wheel/g)).toHaveLength(4);
    expect(markup.match(/data-race-car-wheel-rotor="centered"/g)).toHaveLength(4);
    expect(markup).not.toContain("transform-origin");
    expect(markup).not.toContain("transform:rotate");
    expect(markup).toContain("#145A4A");
    expect(markup).toContain("#F2C94C");
  });
  it("renders a breakaway in a paceline", () => {
    const riders = Array.from({ length: 6 }, (_, index) => buildRider(index + 1));
    const riderIds = riders.map((rider) => rider.id);
    const group: RaceGroupSnapshot = {
      id: "breakaway",
      label: "Échappée",
      type: "breakaway",
      riderIds,
      gapToLeaderSeconds: 0,
      averageEnergy: 68,
    };
    const markup = renderToStaticMarkup(
      <RaceGroupFormation
        group={group}
        riderIds={riderIds}
        riderById={new Map(riders.map((rider) => [rider.id, rider]))}
        incidents={[]}
        primeWinnerId={null}
        primeResult={null}
        isMoving
        compact={false}
      />,
    );

    expect(markup).toContain('data-race-group-formation="breakaway-line"');
    expect(markup).toContain("translate(-");
    expect(markup).toContain("translate(5");
  });

  it("puts the current relay at the front and varies pedalling effort", () => {
    const riders = Array.from({ length: 6 }, (_, index) => buildRider(index + 1));
    const riderIds = riders.map((rider) => rider.id);
    const group: RaceGroupSnapshot = {
      id: "dynamic-breakaway",
      label: "Échappée",
      type: "breakaway",
      riderIds,
      gapToLeaderSeconds: 0,
      averageEnergy: 68,
    };
    const markup = renderToStaticMarkup(
      <RaceGroupFormation
        group={group}
        riderIds={riderIds}
        riderById={new Map(riders.map((rider) => [rider.id, rider]))}
        incidents={[]}
        primeWinnerId={null}
        primeResult={null}
        isMoving
        compact={false}
        frontDynamics={{
          breakawayCooperation: 0.78,
          activeRelayRiderIds: ["rider-5"],
          chasePressure: 0.72,
        }}
        terrain="climb"
      />,
    );

    expect(markup).toContain('data-race-breakaway-state="organized"');
    expect(markup).toContain('data-race-rider-effort="relay"');
    expect(markup).toContain('data-race-rider-effort="sheltered"');
    expect(markup).toContain('data-race-cyclist-airflow="relay"');
    expect(markup).toContain('data-race-rider-climbing-pose="standing"');
    expect(markup).toContain('data-race-cyclist-pose="standing-climb"');
    expect(markup).toContain("cm-bike-standing");
    expect(markup.indexOf("Coureur 5")).toBeLessThan(
      markup.indexOf("Coureur 1"),
    );
  });

  it("opens the group for an intermediate sprint battle", () => {
    const riders = Array.from({ length: 6 }, (_, index) => buildRider(index + 1));
    const riderIds = riders.map((rider) => rider.id);
    const group: RaceGroupSnapshot = {
      id: "breakaway",
      label: "Échappée",
      type: "breakaway",
      riderIds,
      gapToLeaderSeconds: 0,
      averageEnergy: 68,
    };
    const markup = renderToStaticMarkup(
      <RaceGroupFormation
        group={group}
        riderIds={riderIds}
        riderById={new Map(riders.map((rider) => [rider.id, rider]))}
        incidents={[]}
        primeWinnerId={null}
        primeResult={null}
        primeSprintContenderIds={riderIds.slice(0, 3)}
        primeSprintProgress={0.5}
        isMoving
        compact={false}
      />,
    );

    expect(markup).toContain('data-race-group-formation="prime-sprint"');
    expect(markup).toContain('data-race-prime-sprint="active"');
    expect(markup.match(/data-prime-sprint-contender=/g)).toHaveLength(3);
    expect(markup).toContain("Sprint · 1");
  });

  it("animates fallen riders and detached wheels during a mass crash", () => {
    const riders = Array.from({ length: 5 }, (_, index) => buildRider(index + 1));
    const riderIds = riders.map((rider) => rider.id);
    const group: RaceGroupSnapshot = {
      id: "crash-group",
      label: "Peloton",
      type: "peloton",
      riderIds,
      gapToLeaderSeconds: 0,
      averageEnergy: 59,
    };
    const markup = renderToStaticMarkup(
      <RaceGroupFormation
        group={group}
        riderIds={riderIds}
        riderById={new Map(riders.map((rider) => [rider.id, rider]))}
        incidents={[
          {
            id: "mass-crash",
            type: "crash_mass",
            riderIds: riderIds.slice(0, 4),
            abandonedRiderIds: [],
            label: "Chute massive",
          },
        ]}
        primeWinnerId={null}
        primeResult={null}
        isMoving
        compact={false}
      />,
    );

    expect(markup.match(/data-race-rider-incident="crash_mass"/g)).toHaveLength(4);
    expect(markup).toContain("cm-race-rider-crash");
    expect(markup).toContain('data-race-loose-wheel="crash"');
    expect(markup).toContain("cm-race-loose-wheel");
  });
});
