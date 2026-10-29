import { describe, expect, it } from "vitest";

import type { RiderRatings } from "@/lib/game/rider-profile";
import {
  getSponsorObjectiveRaceMinimumRank,
  getSponsorObjectiveUciTargetRank,
  getSponsorObjectiveWinCount,
  resolveSponsorObjectiveSportingLevel,
  type SponsorObjectiveSportingContext,
} from "./sponsor-objective-sporting-level";

function rider(value: number, overrides: Partial<RiderRatings> = {}): RiderRatings {
  return {
    mountain: value, hills: value, flat: value, timeTrial: value, cobbles: value, sprint: value,
    acceleration: value, downhill: value, endurance: value, resistance: value, recovery: value,
    breakaway: value, prologue: value, ...overrides,
  };
}
const national: SponsorObjectiveSportingContext = { currentDivision: "national", projectedDivision: "national", projectedRank: 150 };
const elite: SponsorObjectiveSportingContext = { currentDivision: "world", projectedDivision: "elite", projectedRank: 17 };

describe("sponsor objective sporting levels", () => {
  it("uses the known next-season division before current Elite status, with an Elite fallback only when projection is unknown", () => {
    const promoted = resolveSponsorObjectiveSportingLevel({ context: elite, ratings: [rider(56)] });
    expect(promoted?.division).toBe("elite");
    expect(promoted?.categoryPriorities[0]).toEqual(["elite"]);
    expect(promoted?.teamAmbition).toBe(1);
    const current = resolveSponsorObjectiveSportingLevel({ context: { ...elite, currentDivision: "elite", projectedDivision: "world", projectedRank: 35 }, ratings: [] });
    expect(current?.division).toBe("world");
    expect(current?.categoryPriorities.flat()).not.toContain("elite");
    expect(current?.teamStrength).toBeNull();
    expect(current?.teamAmbition).toBeNull();
    const unknownProjection = resolveSponsorObjectiveSportingLevel({ context: { currentDivision: "elite", projectedDivision: null, projectedRank: null }, ratings: [] });
    expect(unknownProjection?.division).toBe("elite");
    expect(unknownProjection?.categoryPriorities[0]).toEqual(["elite"]);
    const knownRank = resolveSponsorObjectiveSportingLevel({ context: { currentDivision: "elite", projectedDivision: null, projectedRank: 35 }, ratings: [rider(90)] });
    expect(knownRank?.division).toBe("world");
    expect(knownRank?.categoryPriorities.flat()).not.toContain("elite");
  });

  it("keeps a weak National team on National races and a projected World team on World races", () => {
    expect(resolveSponsorObjectiveSportingLevel({ context: national, ratings: Array.from({ length: 6 }, () => rider(55)) })?.categoryPriorities[0]).toEqual(["national"]);
    expect(resolveSponsorObjectiveSportingLevel({ context: { ...national, projectedDivision: "world" }, ratings: [] })?.categoryPriorities[0]).toEqual(["world"]);
  });

  it("recognizes specialists through their primary skill without awarding an unguaranteed Elite wildcard", () => {
    const specialist = rider(40, { sprint: 85, endurance: 70, resistance: 70, recovery: 70 });
    const result = resolveSponsorObjectiveSportingLevel({ context: national, ratings: Array.from({ length: 6 }, () => specialist) });
    expect(result?.teamStrength).toBe(80.5);
    expect(result?.teamAmbition).toBe(5);
    expect(result?.division).toBe("world");
    expect(result?.categoryPriorities.flat()).not.toContain("elite");
  });

  it("does not mistake one star surrounded by weak riders for a deep strong team", () => {
    const thin = resolveSponsorObjectiveSportingLevel({ context: national, ratings: [rider(90), ...Array.from({ length: 5 }, () => rider(40))] });
    const deep = resolveSponsorObjectiveSportingLevel({ context: national, ratings: Array.from({ length: 6 }, () => rider(80)) });
    expect(thin?.teamStrength).toBeCloseTo(52.92, 2);
    expect(thin?.division).toBe("national");
    expect(deep?.teamStrength).toBe(80);
    expect(deep?.division).toBe("world");
  });

  it("does not invent zero-strength ratings for missing or invalid data", () => {
    expect(resolveSponsorObjectiveSportingLevel({ context: undefined, ratings: [] })).toBeNull();
    expect(resolveSponsorObjectiveSportingLevel({ context: undefined, ratings: [rider(0), rider(NaN), rider(101), rider(-1)] })).toBeNull();
    const contextOnly = resolveSponsorObjectiveSportingLevel({ context: elite, ratings: [rider(60, { mountain: Infinity })] });
    expect(contextOnly?.teamStrength).toBeNull();
    expect(contextOnly?.division).toBe("elite");
    const partial = resolveSponsorObjectiveSportingLevel({ context: undefined, ratings: [rider(NaN), rider(70)] });
    expect(partial?.teamStrength).toBe(70);
  });

  it("accepts a positive projected rank as division evidence but never treats rank zero as Elite", () => {
    const context = { currentDivision: null, projectedDivision: null, projectedRank: 12 };
    expect(resolveSponsorObjectiveSportingLevel({ context, ratings: [] })?.division).toBe("elite");
    expect(resolveSponsorObjectiveSportingLevel({ context: { ...context, projectedRank: 0 }, ratings: [] })).toBeNull();
    expect(resolveSponsorObjectiveSportingLevel({ context: { ...context, projectedRank: NaN }, ratings: [] })).toBeNull();
  });
});

describe("race-result sporting calibration", () => {
  it("relaxes an Elite result for a weak roster and keeps a winning target for an exceptional matching leader", () => {
    const race = { categoryCode: "elite" as const, raceFormat: "one_day" as const, profileTypes: ["sprint" as const] };
    expect(getSponsorObjectiveRaceMinimumRank({ race, ratings: [rider(56)], difficulty: "balanced" })).toBe(25);
    expect(getSponsorObjectiveRaceMinimumRank({ race, ratings: [rider(86)], difficulty: "balanced" })).toBe(1);
  });

  it("judges a tour's GC rather than the sprint or time-trial stage it contains", () => {
    const specialist = rider(45, { sprint: 90, timeTrial: 85, flat: 75, endurance: 70, resistance: 70, recovery: 65 });
    const ratings = Array.from({ length: 6 }, () => specialist);
    expect(getSponsorObjectiveRaceMinimumRank({ race: { categoryCode: "world", raceFormat: "one_day", profileTypes: ["sprint"] }, ratings, difficulty: "balanced" })).toBe(1);
    expect(getSponsorObjectiveRaceMinimumRank({ race: { categoryCode: "world", raceFormat: "stage_race", profileTypes: ["mountain", "sprint", "time_trial"], isGrandTour: true }, ratings, difficulty: "balanced" })).toBe(25);
  });

  it("requires more collective depth for a GC than for a one-day result", () => {
    const ratings = [rider(90), ...Array.from({ length: 5 }, () => rider(40))];
    const singleDay = getSponsorObjectiveRaceMinimumRank({ race: { categoryCode: "elite", raceFormat: "one_day", profileTypes: ["mountain"] }, ratings, difficulty: "balanced" });
    const tour = getSponsorObjectiveRaceMinimumRank({ race: { categoryCode: "elite", raceFormat: "stage_race", profileTypes: ["mountain", "time_trial"] }, ratings, difficulty: "balanced" });
    expect(singleDay).toBe(1);
    expect(tour).toBe(15);
  });

  it("changes demands monotonically with the negotiated difficulty", () => {
    const race = { categoryCode: "world" as const, profileTypes: ["sprint" as const] };
    const ratings = [rider(75)];
    expect(getSponsorObjectiveRaceMinimumRank({ race, ratings, difficulty: "accessible" })).toBe(5);
    expect(getSponsorObjectiveRaceMinimumRank({ race, ratings, difficulty: "balanced" })).toBe(3);
    expect(getSponsorObjectiveRaceMinimumRank({ race, ratings, difficulty: "ambitious" })).toBe(1);
  });

  it("leaves an unknown race category or unavailable ratings uncalibrated", () => {
    expect(getSponsorObjectiveRaceMinimumRank({ race: {}, ratings: [rider(60)], difficulty: "balanced" })).toBeNull();
    expect(getSponsorObjectiveRaceMinimumRank({ race: { categoryCode: "world" }, ratings: [], difficulty: "balanced" })).toBeNull();
  });
  it("keeps negotiation distinct inside a broad weak-roster band", () => {
    const race={categoryCode:"elite" as const,raceFormat:"one_day" as const,profileTypes:["hilly" as const]};
    const ratings=[rider(72)];
    expect(["accessible","balanced","ambitious"].map(difficulty=>getSponsorObjectiveRaceMinimumRank({race,ratings,difficulty:difficulty as "accessible"|"balanced"|"ambitious"}))).toEqual([20,15,10]);
    expect(getSponsorObjectiveRaceMinimumRank({race,ratings:[rider(56)],difficulty:"ambitious"})).toBe(20);
    expect(getSponsorObjectiveRaceMinimumRank({race,ratings:[rider(90)],difficulty:"ambitious"})).toBe(1);
  });
});

describe("season objectives near the team's sporting level", () => {
  it("keeps the UCI target near rank 150 instead of asking for a prestige-driven top 30", () => {
    expect(getSponsorObjectiveUciTargetRank({ requestedRank: 30, context: national, difficulty: "balanced" })).toBe(132);
    expect(getSponsorObjectiveUciTargetRank({ requestedRank: 30, context: national, difficulty: "accessible" })).toBe(138);
    expect(getSponsorObjectiveUciTargetRank({ requestedRank: 30, context: national, difficulty: "ambitious" })).toBe(126);
    expect(getSponsorObjectiveUciTargetRank({ requestedRank: 150, context: national, difficulty: "balanced" })).toBe(150);
  });

  it("sets an Elite-scale target for a future Elite team with a modest sponsor", () => {
    expect(getSponsorObjectiveUciTargetRank({ requestedRank: 80, context: elite, difficulty: "balanced" })).toBe(22);
    expect(getSponsorObjectiveUciTargetRank({ requestedRank: 80, context: { ...elite, projectedRank: null }, difficulty: "balanced" })).toBe(20);
    expect(getSponsorObjectiveUciTargetRank({ requestedRank: 1, context: { ...elite, projectedRank: 1 }, difficulty: "ambitious" })).toBe(1);
  });

  it("preserves the requested rank when no reliable context is available", () => {
    expect(getSponsorObjectiveUciTargetRank({ requestedRank: 70, context: undefined, difficulty: "balanced" })).toBe(70);
    expect(getSponsorObjectiveUciTargetRank({ requestedRank: 70, context: { currentDivision: null, projectedDivision: null, projectedRank: 0 }, difficulty: "balanced" })).toBe(70);
  });

  it("caps win demands for weaker known squads while keeping modest requests and high-level ambitions", () => {
    expect(getSponsorObjectiveWinCount({ requestedCount: 12, teamStrength: 55, difficulty: "balanced" })).toBe(2);
    expect(getSponsorObjectiveWinCount({ requestedCount: 12, teamStrength: 55, difficulty: "accessible" })).toBe(1);
    expect(getSponsorObjectiveWinCount({ requestedCount: 12, teamStrength: 55, difficulty: "ambitious" })).toBe(3);
    expect(getSponsorObjectiveWinCount({ requestedCount: 2, teamStrength: 80, difficulty: "balanced" })).toBe(2);
    expect(getSponsorObjectiveWinCount({ requestedCount: 12, teamStrength: 85, difficulty: "balanced" })).toBe(12);
    expect(getSponsorObjectiveWinCount({ requestedCount: 12, teamStrength: 85, difficulty: "ambitious" })).toBe(13);
    expect(getSponsorObjectiveWinCount({ requestedCount: 2, teamStrength: 80, difficulty: "ambitious" })).toBe(3);
  });

  it.each([null, NaN, Infinity, -1, 101])("does not interpret unavailable strength %s as a weak team", (teamStrength) => {
    expect(getSponsorObjectiveWinCount({ requestedCount: 8, teamStrength, difficulty: "accessible" })).toBe(8);
  });
});
