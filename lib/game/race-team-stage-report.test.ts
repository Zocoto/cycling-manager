import { describe, expect, it } from "vitest";
import { buildTeamStageReport } from "./race-team-stage-report";
import { createRaceTeamWorkRecorder } from "./race-team-work";
import { simulateRaceStage, type StageSimulationResult } from "./race-simulation";
import { createDemoSimulationInput } from "./race-simulation-demo";
import type { OfficialRiderResult } from "./race-results";

const results: OfficialRiderResult[] = ["leader", "helper", "other"].map((id, index) => ({
  riderId: id, riderName: id === "leader" ? "Lucas Martin" : id === "helper" ? "Marc Petit" : "Paul Autre",
  teamId: id === "other" ? "foreign" : "own", teamName: id === "other" ? "Autre équipe" : "Notre équipe",
  rank: index + 2, status: "finished", elapsedTimeMs: 1000000, gapToWinnerMs: index * 1000,
  mountainPoints: 0, sprintPoints: 0, abandonmentReason: null,
}));
function simulation(): StageSimulationResult {
  const group = (type: "peloton" | "breakaway" | "dropped", ids: string[], gap = 0) => ({
    id: type, label: type, type, riderIds: ids, gapToLeaderSeconds: gap, averageEnergy: 50,
  });
  return {
    stageId: "stage", seed: "test", resolvedRiders: results.map((rider) => ({
      id: rider.riderId, name: rider.riderName, teamId: rider.teamId, role: rider.riderId === "leader" ? "leader" : "domestique",
    })) as StageSimulationResult["resolvedRiders"], results: [], primes: [], mountainPoints: {}, sprintPoints: {},
    timeline: [
      { segmentNumber: 1, completedDistanceKm: 10, groups: [group("peloton", ["leader", "other"]), group("breakaway", ["helper"])], incidents: [], abandonments: [], commentary: ["Marc Petit place une attaque."] },
      { segmentNumber: 2, completedDistanceKm: 20, groups: [group("peloton", ["other"]), group("dropped", ["leader", "helper"], 25)], incidents: [{ id: "puncture", type: "puncture", riderIds: ["leader"], abandonedRiderIds: [], label: "Crevaison" }, { id: "foreign-crash", type: "crash_individual", riderIds: ["other"], abandonedRiderIds: [], label: "Chute" }], abandonments: [], commentary: ["Marc Petit attend Lucas Martin pour organiser son retour."] },
      { segmentNumber: 3, completedDistanceKm: 30, groups: [group("peloton", ["leader", "helper", "other"])], incidents: [], abandonments: [], commentary: [] },
      { segmentNumber: 4, completedDistanceKm: 40, groups: [group("dropped", ["leader", "helper"], 2), group("peloton", ["other"])], incidents: [], abandonments: [], commentary: [] },
    ],
    teamWork: [{ riderId: "helper", kind: "protection", targetRiderIds: ["leader"], startKm: 0, endKm: 10 }, { riderId: "helper", kind: "recovery", targetRiderIds: ["leader"], startKm: 20, endKm: 25 }],
  };
}

describe("team stage report", () => {
  it("restitue les actions, les incidents et les décrochages de l’équipe dans l’ordre", () => {
    const report = buildTeamStageReport({ teamId: "own", stageId: "stage", results, simulation: simulation() })!;
    expect(report.riders).toHaveLength(2);
    expect(report.events.map((event) => event.title)).toEqual(expect.arrayContaining(["Protection", "En échappée", "Attaque / accélération", "Décrochage", "Crevaison / avarie", "Retour dans le peloton", "Aide au retour"]));
    expect(report.events.some((event) => event.id === "foreign-crash")).toBe(false);
    expect(report.events.every((event) => event.riderIds.every((id) => id !== "other"))).toBe(true);
    expect(report.events.map((event) => event.distanceKm)).toEqual([...report.events.map((event) => event.distanceKm)].sort((a, b) => a - b));
    expect(report.riders[1].workKm).toMatchObject({ protection: 10, recovery: 5 });
    expect(report.events.find((event) => event.title === "Protection")?.detail).toBe("Marc Petit pour Lucas Martin.");
    expect(report.riders[0].result.rank).toBe(2);
    expect(report.events.some((event) => event.title === "Décrochage" && event.distanceKm === 40)).toBe(false);
  });
  it("ne fabrique pas de travail réalisé pour les anciens scénarios", () => {
    const old = simulation(); delete old.teamWork;
    const report = buildTeamStageReport({ teamId: "own", stageId: "stage", results, simulation: old })!;
    expect(report.hasWorkRecording).toBe(false);
    expect(report.riders.every((rider) => rider.workKm === null && rider.relayKm === null)).toBe(true);
    expect(report.events.some((event) => event.title === "Protection")).toBe(false);
  });
  it("garde les résultats officiels lorsque le scénario manque ou concerne une autre étape", () => {
    const report = buildTeamStageReport({ teamId: "own", stageId: "other-stage", results, simulation: simulation() })!;
    expect(report.hasTimeline).toBe(false);
    expect(report.events).toEqual([]);
    expect(report.riders[0].role).toBeNull();
    expect(buildTeamStageReport({ teamId: null, stageId: "stage", results })).toBeNull();
    expect(buildTeamStageReport({ teamId: "spectator", stageId: "stage", results })).toBeNull();
  });
  it("fusionne le travail continu sans combler les pauses ni changer les bénéficiaires", () => {
    const recorder = createRaceTeamWorkRecorder();
    recorder.record({ riderId: "helper", kind: "protection", targetRiderIds: ["leader"], startKm: 0, endKm: 2 });
    recorder.record({ riderId: "helper", kind: "protection", targetRiderIds: ["leader"], startKm: 2, endKm: 4 });
    recorder.record({ riderId: "helper", kind: "protection", targetRiderIds: ["leader"], startKm: 6, endKm: 8 });
    recorder.record({ riderId: "helper", kind: "protection", targetRiderIds: ["other"], startKm: 8, endKm: 10 });
    expect(recorder.periods.map((period) => [period.startKm, period.endKm])).toEqual([[0, 4], [6, 8], [8, 10]]);
  });
  it("enregistre du soutien réel pour les prochaines simulations avec des intervalles valides", () => {
    const input = createDemoSimulationInput("sprint-littoral", 7);
    const run = simulateRaceStage(input);
    expect(run.teamWork?.some((period) => period.kind === "protection")).toBe(true);
    const riders = new Map(input.riders.map((rider) => [rider.id, rider]));
    for (const period of run.teamWork ?? []) {
      expect(period.endKm).toBeGreaterThan(period.startKm);
      for (const id of period.targetRiderIds) expect(riders.get(id)?.teamId).toBe(riders.get(period.riderId)?.teamId);
    }
  });
});
