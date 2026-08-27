import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  NATIONAL_CHAMPIONSHIP_RESULTS_ONLY_FROM_GAME_YEAR,
  shouldUseNationalChampionshipResultsOnly,
} from "./national-championship-results-only";
import { createDemoSimulationInput } from "./race-simulation-demo";
import { simulateRaceStageResultsOnly } from "./race-simulation";

describe("championnats nationaux sans live à partir de la saison 2", () => {
  it("limite strictement la règle aux CN des saisons 2 et suivantes", () => {
    expect(NATIONAL_CHAMPIONSHIP_RESULTS_ONLY_FROM_GAME_YEAR).toBe(2);
    expect(
      shouldUseNationalChampionshipResultsOnly({
        gameYear: 1,
        competitionType: "national_road",
      }),
    ).toBe(false);
    expect(
      shouldUseNationalChampionshipResultsOnly({
        gameYear: 2,
        competitionType: "national_road",
      }),
    ).toBe(true);
    expect(
      shouldUseNationalChampionshipResultsOnly({
        gameYear: 4,
        competitionType: "national_time_trial",
      }),
    ).toBe(true);
    expect(
      shouldUseNationalChampionshipResultsOnly({
        gameYear: 4,
        competitionType: "standard",
      }),
    ).toBe(false);
  });

  it("produit un classement déterministe complet sans chronologie de live", () => {
    const input = createDemoSimulationInput("sprint-littoral", 2026);
    const first = simulateRaceStageResultsOnly(input);
    const second = simulateRaceStageResultsOnly(input);

    expect(first).toEqual(second);
    expect(first.timeline).toEqual([]);
    expect(first.primes).toEqual([]);
    expect(first.mountainPoints).toEqual({});
    expect(first.sprintPoints).toEqual({});
    expect(first.results).toHaveLength(input.riders.length);
    expect(first.results.map((result) => result.rank)).toEqual(
      input.riders.map((_, index) => index + 1),
    );
    expect(first.results.every((result) => result.status === "finished")).toBe(
      true,
    );
    expect(first.results[0]).toMatchObject({
      rank: 1,
      gapToWinnerSeconds: 0,
      injury: null,
      abandonment: null,
    });
  });

  it("conserve la spécialité sportive dans un contre-la-montre", () => {
    const source = createDemoSimulationInput("chrono-algarve", 42);
    const riders = source.riders.slice(0, 2).map((rider, index) => ({
      ...rider,
      form: 75,
      role: "auto" as const,
      ratings: {
        flat: 50,
        mountain: 50,
        hills: 50,
        cobbles: 50,
        downhill: 50,
        sprint: 50,
        acceleration: 50,
        timeTrial: index === 0 ? 99 : 20,
        prologue: index === 0 ? 99 : 20,
        endurance: 50,
        resistance: 50,
        recovery: 50,
        breakaway: 50,
      },
    }));
    const simulation = simulateRaceStageResultsOnly({ ...source, riders });

    expect(simulation.results[0]?.riderId).toBe(riders[0]?.id);
  });
});

describe("intégration résultats seuls des CN", () => {
  const service = readFileSync(
    join(process.cwd(), "services/race-results.ts"),
    "utf8",
  );
  const resultPage = readFileSync(
    join(process.cwd(), "app/jeu/resultats/[slug]/[stageNumber]/page.tsx"),
    "utf8",
  );
  it("écarte les CN S2+ du verrouillage des scénarios de replay", () => {
    expect(service).toContain("replayCalendar");
    expect(service).toContain("simulateRaceStageResultsOnly(input)");
    expect(resultPage).toContain("!resultsOnlyNationalChampionship");
    expect(resultPage).toContain("getLockedOfficialRaceSimulations");
    expect(resultPage).not.toContain("ensureLockedOfficialRaceSimulations");
  });

  it("désactive les traitements annexes du live pour les classements seuls", () => {
    expect(service).toContain("if (!resultsOnly)");
    expect(service).toContain("persistStageAttackParticipants");
    expect(service).toContain("persistPostRaceNewsEvents");
  });
});
