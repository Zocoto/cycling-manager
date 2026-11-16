import { expect, it } from "vitest";
import type { RaceStageSegment } from "./race-profiles";
import { simulateRaceStage, type RiderSimulationInput } from "./race-simulation";

function rider(id: string, teamId: string, role: RiderSimulationInput["role"], mountain: number): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId,
    teamName: teamId,
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#FFFDF4",
    age: 27,
    form: 75,
    role,
    ratings: {
      flat: 72,
      mountain,
      hills: 78,
      resistance: 72,
      endurance: 72,
      recovery: 72,
      cobbles: 65,
      downhill: 70,
      sprint: 60,
      acceleration: 70,
      timeTrial: 65,
      prologue: 64,
      breakaway: 50,
    },
  };
}

it("laisse un grimpeur moins fort battre le favori isolé grâce au travail de ses équipiers", () => {
  const route: [number, RaceStageSegment["terrain"], number][] = [
    [30, "flat", 0],
    [16, "climb", 8],
    [18, "descent", -6],
    [18, "climb", 8],
    [18, "descent", -5],
    [15, "flat", 0],
    [17, "climb", 8],
    [15, "descent", -6],
    [20, "climb", 8],
  ];
  const segments: RaceStageSegment[] = route.map(([distanceKm, terrain, averageGradientPct], index) => ({
    segmentNumber: index + 1,
    distanceKm,
    terrain,
    averageGradientPct,
    surface: "asphalt",
    prime: null,
  }));
  const teamStrategies = ["a", "b", "c"].map((teamId) => ({
    teamId,
    objective: "stage_win" as const,
    collectivePosture: "balanced" as const,
    breakawayPolicy: "avoid" as const,
    chasePolicy: "never" as const,
    lieutenantRiderId: null,
    dangerPacerRiderId: null,
    protectorRiderId: null,
    breakawayRiderId: null,
    attackOrders: [],
  }));

  function run(helperRole: "free_agent" | "domestique") {
    return simulateRaceStage({
      id: "extreme",
      name: "Étape à quatre cols",
      stageType: "road",
      profileType: "mountain",
      isStageRace: true,
      seed: 2,
      segments,
      teamStrategies,
      riders: [
        rider("Champ", "a", "leader", 85),
        rider("Rival", "b", "leader", 81),
        rider("h1", "b", helperRole, 82),
        rider("h2", "b", helperRole, 82),
        rider("h3", "b", helperRole, 81),
        rider("Other", "c", "leader", 79),
      ],
    });
  }

  const alone = run("free_agent");
  const supported = run("domestique");

  expect(alone.results[0]?.riderId).toBe("Champ");
  expect(alone.results[0].energyAfter).toBeLessThan(30);
  expect(supported.results[0]?.riderId).toBe("Rival");
  expect(supported.results[0].energyAfter).toBeGreaterThan(
    alone.results.find((result) => result.riderId === "Rival")!.energyAfter,
  );
  expect(supported.teamWork?.some((entry) =>
    entry.kind === "protection" && entry.targetRiderIds.includes("Rival"),
  )).toBe(true);
});
