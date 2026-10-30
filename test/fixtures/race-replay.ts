import type { RaceCalendarEdition, RaceCalendarStage } from "@/lib/game/race-calendar";
import { createDemoSimulationInput } from "@/lib/game/race-simulation-demo";
import { simulateRaceStage } from "@/lib/game/race-simulation";
import { OFFICIAL_RACE_ENGINE_VERSION, type LockedOfficialStageSimulation } from "@/lib/game/official-race-simulation";

export function createRaceReplayFixture(chrono = false) {
  const base = createDemoSimulationInput(chrono ? "chrono-algarve" : "sprint-littoral", "replay-pace-preview");
  const input = {
    ...base,
    isStageRace: false,
    riders: base.riders.slice(0, 12),
    segments: base.segments.slice(0, 3).map((segment, index) => ({
      ...segment, segmentNumber: index + 1, distanceKm: 5,
      terrain: "flat" as const, averageGradientPct: 0, surface: "asphalt" as const, prime: null,
    })),
  };
  const stage: RaceCalendarStage = {
    id: input.id, dayNumber: 1, stageNumber: 1, name: input.name,
    stageType: input.stageType, profileType: input.profileType, status: "completed",
    distanceKm: 15, daySlot: "early", departureAt: "2026-10-29T13:00:00Z", segments: input.segments,
  };
  const edition: RaceCalendarEdition = {
    id: "replay-preview", raceId: "replay-preview", slug: "replay-preview", name: input.name, shortName: null,
    countryName: "France", countryCode: "FR", categoryCode: "local", categoryName: "Local", prestigeRank: 1,
    raceFormat: "one_day", competitionType: "standard", registrationClosesAt: null, wildcardClosesAt: null,
    withdrawalClosesAt: null, registrationPolicy: "closed", minimumReputation: null,
    minimumRosterSize: 1, maximumRosterSize: 8, engagedRiderCount: input.riders.length,
    engagedRiders: input.riders, currentTeamRegistration: null, stages: [stage],
  };
  const locked: LockedOfficialStageSimulation = {
    stageId: stage.id, raceEditionId: edition.id, engineVersion: OFFICIAL_RACE_ENGINE_VERSION,
    seed: String(input.seed), input, simulation: simulateRaceStage(input),
  };
  return { edition, stage, lockedSimulations: [locked] };
}
