import { describe, expect, it } from "vitest";

import type { TeamDivisionCode } from "@/lib/game/economy";
import { calculateNationRiderOverall } from "@/lib/game/nation-rider-ranking";
import { getRiderSportingProfile, type RiderRatings } from "@/lib/game/rider-profile";
import type { SponsorObjectiveDifficulty } from "@/lib/game/sponsor-negotiation";
import type { SponsorSportingPhilosophy } from "@/lib/game/sponsor-philosophy";
import type { GeneratedSponsorObjective, RaceResultObjectiveDetails } from "@/types/sponsor-objective";
import {
  generateProvisionalSponsorObjectives,
  type SponsorObjectiveRaceCandidate,
  type SponsorObjectiveTeamRiderCandidate,
} from "./sponsor-objectives";

type SportingContext = {
  currentDivision: TeamDivisionCode | null;
  projectedDivision: TeamDivisionCode | null;
  projectedRank: number | null;
};
type GeneratorOptions = Parameters<typeof generateProvisionalSponsorObjectives>[0] & {
  teamSportingContext?: SportingContext;
};
type SportingRaceObjective = GeneratedSponsorObjective & { targetDetails: RaceResultObjectiveDetails };

function race(category: "national" | "continental" | "world" | "elite", name: string,
  overrides: Partial<SponsorObjectiveRaceCandidate> = {}): SponsorObjectiveRaceCandidate {
  const id = `${category}-${name}`;
  return {
    raceId: id, raceEditionId: `s5-${id}`, raceSlug: id, raceLabel: `Course ${id}`,
    countryCode: "FR", continentCode: "europe", categoryCode: category,
    registrationPolicy: "open", minimumReputation: 0, competitionType: "standard",
    raceFormat: "one_day", profileTypes: ["sprint"], isGrandTour: false,
    isMonument: false, ...overrides,
  };
}

function catalogue(): SponsorObjectiveRaceCandidate[] {
  return (["national", "continental", "world", "elite"] as const).flatMap(category => {
    const candidates = [
    // Put the attractive domestic mixed tour first: a single sprint/TT stage
    // must not qualify its overall classification as a sprint/TT objective.
    race(category, "mixed-tour", { raceFormat: "stage_race", profileTypes: ["mountain", "sprint", "time_trial"], isGrandTour: category === "elite" }),
    race(category, "sprint", { countryCode: "BE" }),
    race(category, "chrono", { countryCode: "NL", profileTypes: ["time_trial"] }),
    race(category, "cobbles", { countryCode: "BE", profileTypes: ["cobbles"], isMonument: category === "elite" }),
    race(category, "hills", { countryCode: "IT", profileTypes: ["hilly"], isMonument: category === "elite" }),
    race(category, "mountain", { countryCode: "ES", profileTypes: ["mountain"] }),
    race(category, "flat-tour", { countryCode: "DE", raceFormat: "stage_race", profileTypes: ["flat", "time_trial"] }),
    ];
    // Four alternatives per discipline let category tests distinguish genuine
    // category priority from a necessary fallback caused by a sparse calendar.
    return candidates.flatMap(candidate => [candidate, ...[1, 2, 3].map(index => ({
      ...candidate, raceId: `${candidate.raceId}-${index}`, raceEditionId: `${candidate.raceEditionId}-${index}`,
      raceSlug: `${candidate.raceSlug}-${index}`, raceLabel: `${candidate.raceLabel} ${index}`,
      countryCode: ["FR", "BE", "IT"][index - 1],
    }))]);
  });
}

function rider(id: string, base: number, overrides: Partial<RiderRatings> = {}): SponsorObjectiveTeamRiderCandidate {
  const ratings: RiderRatings = {
    mountain: base, hills: base, flat: base, timeTrial: base, cobbles: base,
    sprint: base, acceleration: base, downhill: base, endurance: base,
    resistance: base, recovery: base, breakaway: base, prologue: base, ...overrides,
  };
  return {
    riderId: id, riderName: `Coureur ${id}`, countryCode: "FR", ratings,
    overallRating: calculateNationRiderOverall(ratings), sportingProfile: getRiderSportingProfile(ratings),
    joinedForTargetSeason: false,
  };
}

const roster = (rating: number) => Array.from({ length: 8 }, (_, index) => rider(`r${index}`, rating));
const context = (division: TeamDivisionCode, rank: number, currentDivision = division): SportingContext => ({
  currentDivision, projectedDivision: division, projectedRank: rank,
});

function generate(overrides: Partial<GeneratorOptions> = {}) {
  const options: GeneratorOptions = {
    sponsorCountryCode: "FR", sponsorPrestige: 3, proposedBudget: 800_000,
    sponsorCatalogKey: "sporting-calibration-test", sponsorSector: "Technologie",
    sportingPhilosophy: "ardennes_classics", relationshipYear: 1,
    objectiveDifficulty: "balanced", targetSeasonGameYear: 5, teamReputationPoints: 1_000,
    raceCandidates: catalogue(), teamRiderCandidates: roster(67),
    teamSportingContext: context("continental", 75), random: () => 0,
    ...overrides,
  };
  return generateProvisionalSponsorObjectives(options);
}

function raceObjectives(objectives: readonly GeneratedSponsorObjective[]): SportingRaceObjective[] {
  return objectives.filter((objective): objective is SportingRaceObjective => objective.targetDetails.kind === "race_result");
}

function rankGoal(objective: SportingRaceObjective): number {
  return objective.targetDetails.achievementType === "win" ? 1 : objective.targetDetails.targetRank!;
}

function assertPortfolio(objectives: readonly GeneratedSponsorObjective[], minimumRaceCount = 3) {
  expect(objectives).toHaveLength(10);
  expect(objectives.reduce((sum, objective) => sum + objective.satisfactionPoints, 0)).toBe(100);
  expect(new Set(objectives.map(objective => objective.displayOrder)).size).toBe(10);
  expect(new Set(objectives.map(objective => JSON.stringify(objective.targetDetails))).size).toBe(10);
  const races = raceObjectives(objectives);
  expect(races.length).toBeGreaterThanOrEqual(minimumRaceCount);
  expect(new Set(races.map(objective => objective.targetDetails.raceId)).size).toBe(races.length);
}

function compatibleWithPhilosophy(candidate: SponsorObjectiveRaceCandidate, philosophy: SponsorSportingPhilosophy): boolean {
  const profiles = candidate.profileTypes ?? [];
  switch (philosophy) {
    case "sprints": return candidate.raceFormat === "one_day" && (profiles.includes("sprint") || profiles.includes("flat"));
    case "time_trials": return candidate.raceFormat === "one_day" && profiles.includes("time_trial");
    case "cobbled_classics": return candidate.raceFormat === "one_day" && profiles.includes("cobbles");
    case "ardennes_classics": return candidate.raceFormat === "one_day" && profiles.includes("hilly");
    case "medium_stage_races": return candidate.raceFormat === "stage_race" && candidate.isGrandTour !== true;
    // A smaller stage race can be a coherent stepping stone if no accessible
    // Grand Tour is available; it must still target a general classification.
    case "grand_tour_general": return candidate.raceFormat === "stage_race";
    default: return true;
  }
}

function assertPhilosophyRaces(objectives: readonly GeneratedSponsorObjective[], candidates: readonly SponsorObjectiveRaceCandidate[], philosophy: SponsorSportingPhilosophy) {
  const byId = new Map(candidates.map(candidate => [candidate.raceId, candidate]));
  for (const objective of raceObjectives(objectives)) {
    const candidate = byId.get(objective.targetDetails.raceId);
    expect(candidate, `Unknown course ${objective.targetDetails.raceId}`).toBeDefined();
    expect(compatibleWithPhilosophy(candidate!, philosophy), `${objective.name} conflicts with ${philosophy}`).toBe(true);
  }
}

describe("S5 sponsor objectives follow the team's sporting level", () => {
  it("directs a future Elite team towards Elite races even with a modest sponsor", () => {
    const objectives = generate({
      sponsorPrestige: 1, proposedBudget: 250_000,
      teamSportingContext: context("elite", 18, "world"), teamRiderCandidates: roster(74),
    });
    assertPortfolio(objectives);
    expect(raceObjectives(objectives).every(objective => objective.targetDetails.raceId.startsWith("elite-"))).toBe(true);
  });

  it.each([
    ["world", 38, 69, "world"],
    ["continental", 83, 63, "continental"],
    ["national", 155, 55, "national"],
    ["amateur", 235, 52, "national"],
  ] as const)("aligns a %s squad with races at its sporting level", (division, rank, rating, category) => {
    const objectives = generate({
      teamSportingContext: context(division, rank), teamRiderCandidates: roster(rating),
    });
    assertPortfolio(objectives);
    expect(raceObjectives(objectives).every(objective => objective.targetDetails.raceId.startsWith(`${category}-`))).toBe(true);
  });

  it("does not demand Elite victories or a global top 30 from a weak National squad with a large sponsor", () => {
    const objectives = generate({
      sponsorPrestige: 5, proposedBudget: 2_000_000,
      teamSportingContext: context("national", 150), teamRiderCandidates: roster(54),
    });
    assertPortfolio(objectives);
    const races = raceObjectives(objectives);
    expect(races.every(objective => objective.targetDetails.raceId.startsWith("national-"))).toBe(true);
    expect(races.every(objective => objective.targetDetails.achievementType === "top_n")).toBe(true);
    const ranking = objectives.find(objective => objective.targetDetails.kind === "uci_ranking")!.targetDetails;
    expect(ranking.kind).toBe("uci_ranking");
    if (ranking.kind === "uci_ranking") {
      expect(ranking.targetRank).toBeGreaterThanOrEqual(110);
      expect(ranking.targetRank).toBeLessThanOrEqual(180);
    }
    for (const objective of objectives) {
      if (objective.targetDetails.kind !== "season_wins") continue;
      expect(objective.targetDetails.minimumWinCount).toBeGreaterThanOrEqual(1);
      expect(objective.targetDetails.minimumWinCount).toBeLessThanOrEqual(5);
    }
  });

  it("keeps promoted fragile squads in Elite but asks for placings rather than compulsory victories", () => {
    const objectives = generate({
      sponsorPrestige: 5, proposedBudget: 2_000_000,
      teamSportingContext: context("elite", 20, "world"), teamRiderCandidates: roster(61),
    });
    assertPortfolio(objectives);
    const races = raceObjectives(objectives);
    expect(races.every(objective => objective.targetDetails.raceId.startsWith("elite-"))).toBe(true);
    expect(races.every(objective => objective.targetDetails.achievementType === "top_n")).toBe(true);
    expect(races.every(objective => rankGoal(objective) >= 5)).toBe(true);
  });

  it("recognises a powerful lower-division squad without making unknown Elite wildcards compulsory", () => {
    const objectives = generate({
      teamSportingContext: context("national", 145), teamRiderCandidates: roster(84),
    });
    assertPortfolio(objectives);
    expect(raceObjectives(objectives).every(objective => objective.targetDetails.raceId.startsWith("world-"))).toBe(true);
  });

  it("uses the projected World division for a currently Elite team facing relegation", () => {
    const objectives = generate({
      teamSportingContext: context("world", 32, "elite"), teamRiderCandidates: roster(77),
    });
    assertPortfolio(objectives);
    expect(raceObjectives(objectives).every(objective => objective.targetDetails.raceId.startsWith("world-"))).toBe(true);
    expect(raceObjectives(objectives).some(objective => objective.targetDetails.raceId.startsWith("elite-"))).toBe(false);
  });

  it("uses a prudent National race fallback when S5 has no reliable division, rank or rider ratings", () => {
    const objectives = generate({
      sponsorPrestige: 5, proposedBudget: 2_000_000,
      teamSportingContext: undefined, teamRiderCandidates: [],
    });
    assertPortfolio(objectives);
    expect(raceObjectives(objectives).every(objective => objective.targetDetails.raceId.startsWith("national-"))).toBe(true);
    // The absence of ratings is retained as unknown, not reported as a real
    // zero-strength roster that would artificially alter sporting demands.
    expect(objectives.every(objective => objective.targetDetails.sportingCalibration?.teamStrength === null)).toBe(true);
  });

  it.each(["sprints", "time_trials"] as const)("does not mistake a mixed tour's general classification for a %s result", philosophy => {
    const objectives = generate({
      sponsorPrestige: 5, proposedBudget: 2_000_000, sportingPhilosophy: philosophy,
      teamSportingContext: context("national", 145), teamRiderCandidates: roster(58),
    });
    // The existing specialty objective has seven points for a prestige sponsor;
    // domestic and neighboring race objectives must respect the same specialty.
    const specialty = raceObjectives(objectives).find(objective => objective.satisfactionPoints === 7);
    expect(specialty).toBeDefined();
    const candidates = catalogue();
    const candidate = candidates.find(entry => entry.raceId === specialty!.targetDetails.raceId)!;
    expect(candidate.categoryCode).toBe("national");
    expect(compatibleWithPhilosophy(candidate, philosophy)).toBe(true);
    assertPhilosophyRaces(objectives, candidates, philosophy);
  });

  it.each([
    "cobbled_classics", "ardennes_classics", "medium_stage_races", "time_trials", "sprints", "grand_tour_general",
  ] as const)("keeps every named race compatible with %s, including domestic and neighboring objectives", philosophy => {
    const candidates = catalogue();
    const objectives = generate({
      raceCandidates: candidates, sportingPhilosophy: philosophy,
      teamSportingContext: context("elite", 8), teamRiderCandidates: roster(77),
    });
    assertPortfolio(objectives);
    assertPhilosophyRaces(objectives, candidates, philosophy);
  });

  it.each(["sprints", "time_trials"] as const)("falls back to lower-category %s races instead of an incompatible Elite result", philosophy => {
    const profile = philosophy === "sprints" ? "sprint" : "time_trial";
    const candidates = [
      ...[1, 2, 3].map(index => race("national", `${profile}-${index}`, { countryCode: ["FR", "BE", "NL"][index - 1], profileTypes: [profile] })),
      race("elite", "mixed-tour", { raceFormat: "stage_race", isGrandTour: true, profileTypes: ["mountain", "sprint", "time_trial"] }),
      race("elite", "wrong-hills", { profileTypes: ["hilly"] }),
      race("world", "wrong-cobbles", { profileTypes: ["cobbles"] }),
    ];
    const objectives = generate({
      raceCandidates: candidates, sponsorPrestige: 5, proposedBudget: 2_000_000, sportingPhilosophy: philosophy,
      teamSportingContext: context("elite", 8), teamRiderCandidates: roster(77),
    });
    assertPortfolio(objectives);
    assertPhilosophyRaces(objectives, candidates, philosophy);
    expect(raceObjectives(objectives).every(objective => objective.targetDetails.raceId.startsWith("national-"))).toBe(true);
  });

  it("fills a sparse specialty calendar with coherent seasonal goals rather than an unrelated course", () => {
    const candidates = [
      race("continental", "only-sprint", { profileTypes: ["sprint"] }),
      race("continental", "mountain", { profileTypes: ["mountain"] }),
      race("continental", "mixed-tour", { raceFormat: "stage_race", profileTypes: ["mountain", "sprint", "time_trial"] }),
      race("elite", "wrong-cobbles", { profileTypes: ["cobbles"] }),
    ];
    const objectives = generate({ raceCandidates: candidates, sportingPhilosophy: "sprints" });
    assertPortfolio(objectives, 1);
    assertPhilosophyRaces(objectives, candidates, "sprints");
    expect(raceObjectives(objectives)).toHaveLength(1);
    expect(objectives.filter(objective => objective.targetDetails.kind === "season_wins").length).toBeGreaterThanOrEqual(2);
    const seasonGoals = objectives.flatMap(objective => objective.targetDetails.kind === "season_wins"
      ? [`${objective.targetDetails.winScope}:${objective.targetDetails.minimumWinCount}`] : []);
    expect(new Set(seasonGoals).size).toBe(seasonGoals.length);
  });

  it.each([["balanced", 2], ["accessible", 1]] as const)("keeps ten distinct commitments within the %s win cap when no compatible chrono exists", (difficulty, maximumWinCount) => {
    const candidates = [
      // A time trial stage still does not make the tour's general classification
      // a valid fallback for a sponsor whose philosophy is time trials.
      race("national", "mixed-tour", { raceFormat: "stage_race", profileTypes: ["mountain", "time_trial"] }),
      race("national", "sprint", { profileTypes: ["sprint"] }),
      race("national", "hills", { profileTypes: ["hilly"] }),
      race("world", "cobbles", { profileTypes: ["cobbles"] }),
    ];
    const objectives = generate({
      raceCandidates: candidates, sportingPhilosophy: "time_trials",
      sponsorPrestige: 5, proposedBudget: 2_000_000,
      objectiveDifficulty: difficulty,
      teamSportingContext: context("national", 150), teamRiderCandidates: roster(54),
    });
    assertPortfolio(objectives, 0);
    expect(raceObjectives(objectives)).toHaveLength(0);
    expect(objectives.some(objective => objective.targetDetails.kind === "infrastructure")).toBe(true);
    expect(objectives.some(objective => objective.targetDetails.kind === "homegrown_roster")).toBe(true);
    const seasonGoals = objectives.flatMap(objective => objective.targetDetails.kind === "season_wins"
      ? [{ scope: objective.targetDetails.winScope, count: objective.targetDetails.minimumWinCount }] : []);
    expect(new Set(seasonGoals.map(goal => `${goal.scope}:${goal.count}`)).size).toBe(seasonGoals.length);
    expect(seasonGoals.every(goal => goal.count >= 1 && goal.count <= maximumWinCount), JSON.stringify(seasonGoals)).toBe(true);
    expect(seasonGoals.every(goal => goal.scope !== "stage_race_general")).toBe(true);
  });

  it("does not let a newly signed climbing leader override a sprint sponsor's philosophy", () => {
    const newcomer = {
      ...rider("new-climber", 56, { mountain: 90, endurance: 85, recovery: 83, resistance: 80 }),
      joinedForTargetSeason: true,
    };
    const candidates = catalogue();
    const objectives = generate({
      raceCandidates: candidates, sportingPhilosophy: "sprints",
      teamRiderCandidates: [newcomer, ...roster(56)],
    });
    assertPortfolio(objectives);
    assertPhilosophyRaces(objectives, candidates, "sprints");
    expect(objectives.some(objective => objective.targetDetails.leaderRiderId === newcomer.riderId)).toBe(false);
  });

  it("credits a strong sprinter despite a low average over unrelated mountain and cobble ratings", () => {
    const options: Partial<GeneratorOptions> = {
      sponsorPrestige: 5, proposedBudget: 2_000_000, sportingPhilosophy: "sprints",
      teamSportingContext: context("national", 145),
    };
    const weak = generate({ ...options, teamRiderCandidates: roster(54) });
    const specialist = rider("specialist", 45, { sprint: 90, acceleration: 84, flat: 72, endurance: 68, resistance: 68, recovery: 65 });
    expect(specialist.overallRating).toBeLessThan(65);
    const stronger = generate({ ...options, teamRiderCandidates: [specialist, ...roster(54)] });
    const specialty = (objectives: GeneratedSponsorObjective[]) => raceObjectives(objectives).find(objective => objective.satisfactionPoints === 7)!;
    expect(rankGoal(specialty(stronger))).toBeLessThan(rankGoal(specialty(weak)));
  });

  it("falls back to accessible categories when the desired Elite calendar is not open", () => {
    const candidates = catalogue().map(candidate => candidate.categoryCode === "elite"
      ? { ...candidate, registrationPolicy: "criteria_pending" as const }
      : candidate);
    const objectives = generate({
      raceCandidates: candidates, teamSportingContext: context("elite", 8), teamRiderCandidates: roster(77),
    });
    assertPortfolio(objectives);
    const selected = raceObjectives(objectives);
    expect(selected.every(objective => objective.targetDetails.raceId.startsWith("world-"))).toBe(true);
    expect(selected.every(objective => candidates.find(candidate => candidate.raceId === objective.targetDetails.raceId)?.registrationPolicy === "open")).toBe(true);
  });

  it.each(["accessible", "balanced", "ambitious"] as const)("preserves a complete coherent portfolio with %s negotiations", difficulty => {
    const objectives = generate({
      sponsorPrestige: 5, proposedBudget: 2_000_000, objectiveDifficulty: difficulty,
      teamSportingContext: context("continental", 78), teamRiderCandidates: roster(63),
    });
    assertPortfolio(objectives);
    expect(raceObjectives(objectives).every(objective => objective.targetDetails.raceId.startsWith("continental-"))).toBe(true);
  });

  it("keeps accessible demands no harder than ambitious demands for the same squad and specialty", () => {
    function specialtyRank(difficulty: SponsorObjectiveDifficulty) {
      return rankGoal(raceObjectives(generate({
        sponsorPrestige: 5, proposedBudget: 2_000_000, objectiveDifficulty: difficulty,
        sportingPhilosophy: "sprints", teamSportingContext: context("continental", 78), teamRiderCandidates: roster(64),
      })).find(objective => objective.satisfactionPoints === 7)!);
    }
    expect(specialtyRank("accessible")).toBeGreaterThanOrEqual(specialtyRank("balanced"));
    expect(specialtyRank("balanced")).toBeGreaterThanOrEqual(specialtyRank("ambitious"));
  });

  it.each(["national_preference", "youth_development"] as const)("preserves the %s sponsor's non-racing commitments and total weights", philosophy => {
    const objectives = generate({ sportingPhilosophy: philosophy });
    assertPortfolio(objectives);
    expect(objectives.some(objective => objective.targetDetails.kind === "nationality_quota")).toBe(true);
    if (philosophy === "youth_development") {
      expect(objectives.filter(objective => objective.targetDetails.kind === "youth_development")).toHaveLength(4);
    } else {
      expect(objectives.find(objective => objective.targetDetails.kind === "nationality_quota")?.satisfactionPoints).toBe(30);
    }
  });

  it("does not reinterpret season four using a newly supplied sporting context", () => {
    const options: Partial<GeneratorOptions> = {
      targetSeasonGameYear: 4, sponsorPrestige: 5, proposedBudget: 2_000_000,
      teamRiderCandidates: roster(54),
    };
    expect(generate({ ...options, teamSportingContext: context("national", 150) }))
      .toEqual(generate({ ...options, teamSportingContext: undefined }));
  });

  it("is deterministic and leaves the calendar and rider ratings untouched", () => {
    const raceCandidates = catalogue();
    const teamRiderCandidates = roster(69);
    const before = structuredClone({ raceCandidates, teamRiderCandidates });
    const options: Partial<GeneratorOptions> = { raceCandidates, teamRiderCandidates, teamSportingContext: context("world", 36) };
    expect(generate(options)).toEqual(generate(options));
    expect({ raceCandidates, teamRiderCandidates }).toEqual(before);
  });
});
