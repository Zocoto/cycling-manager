import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import {
  assignAutomaticRaceRoles,
  simulateRaceStage,
  type RiderSimulationInput,
} from "./race-simulation";

describe("simulateRaceStage", () => {
  it("rejoue exactement la même course avec la même graine", () => {
    const input = createDemoSimulationInput("sprint-littoral", 12);

    expect(simulateRaceStage(input)).toEqual(simulateRaceStage(input));
  });

  it("produit un classement complet avec des rangs uniques", () => {
    const input = createDemoSimulationInput("collines-ardennes", 3);
    const result = simulateRaceStage(input);

    expect(result.results).toHaveLength(input.riders.length);
    expect(result.results.map((item) => item.rank)).toEqual(
      Array.from({ length: input.riders.length }, (_, index) => index + 1)
    );
    expect(result.results[0].gapToWinnerSeconds).toBe(0);
    expect(result.timeline).toHaveLength(input.segments.length);
  });

  it("fait payer davantage d’énergie à une petite échappée", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("collines-ardennes", 7)
    );
    const comparableSnapshot = result.timeline
      .slice(1)
      .find(
        (snapshot) =>
          snapshot.groups.some((group) => group.type === "breakaway") &&
          snapshot.groups.some((group) => group.type === "peloton")
      );

    expect(comparableSnapshot).toBeDefined();
    const breakaway = comparableSnapshot!.groups.find((group) => group.type === "breakaway")!;
    const peloton = comparableSnapshot!.groups.find((group) => group.type === "peloton")!;
    expect(breakaway.averageEnergy).toBeLessThan(peloton.averageEnergy);
  });

  it("attribue les points des GPM et sprints intermédiaires", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("haute-montagne", 2)
    );

    expect(result.primes.some((prime) => prime.prime.type === "mountain")).toBe(true);
    expect(Object.values(result.mountainPoints).some((points) => points > 0)).toBe(true);
    expect(Object.values(result.sprintPoints).some((points) => points > 0)).toBe(true);
  });

  it("favorise un spécialiste du chrono sur un contre-la-montre", () => {
    const input = createDemoSimulationInput("chrono-algarve", 9);
    const result = simulateRaceStage(input);
    const winner = result.resolvedRiders.find(
      (rider) => rider.id === result.results[0].riderId
    )!;

    expect(winner.ratings.timeTrial).toBeGreaterThanOrEqual(78);
    expect(result.timeline.at(-1)?.groups[0].riderIds).toContain(winner.id);
  });
});

describe("assignAutomaticRaceRoles", () => {
  it("désigne automatiquement un leader et un sprinteur sur un profil plat", () => {
    const input = createDemoSimulationInput("sprint-littoral", 1);
    const oneTeam = input.riders
      .filter((rider) => rider.teamId === input.riders[0].teamId)
      .map((rider) => ({ ...rider, role: "auto" as const }));
    const resolved = assignAutomaticRaceRoles(oneTeam, input.segments);

    expect(resolved.filter((rider) => rider.role === "leader")).toHaveLength(1);
    expect(resolved.filter((rider) => rider.role === "sprinter")).toHaveLength(1);
  });

  it("refuse deux leaders dans la même équipe", () => {
    const input = createDemoSimulationInput("sprint-littoral", 1);
    const riders = input.riders.slice(0, 2).map(
      (rider) => ({ ...rider, role: "leader" }) as RiderSimulationInput
    );

    expect(() => assignAutomaticRaceRoles(riders, input.segments)).toThrow(
      "un seul leader"
    );
  });
});
