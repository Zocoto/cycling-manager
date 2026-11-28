import { describe, expect, it } from "vitest";
import type { SponsorObjectiveTargetDetails } from "@/types/sponsor-objective";
import {
  allocateSponsorObjectiveSatisfactionPoints,
  assertSponsorObjectivePlanConsistency,
  getSponsorObjectiveDifficultyWeight,
  haveOverlappingSponsorObjectiveRequirements,
} from "./sponsor-objective-consistency";

const race = (id: string, rank: number): SponsorObjectiveTargetDetails => ({
  kind: "race_result", raceId: id, raceEditionId: `edition-${id}`, raceSlug: id, raceLabel: id,
  countryCode: "FR", achievementType: rank === 1 ? "win" : "top_n", targetRank: rank === 1 ? null : rank, requiredCount: 1,
});
const targets: SponsorObjectiveTargetDetails[] = [
  race("a", 5), race("b", 10),
  { kind: "nationality_quota", countryCode: "FR", minimumPercentage: 30 },
  { kind: "season_wins", winScope: "stages", minimumWinCount: 3 },
  { kind: "uci_ranking", rankingScope: "teams", targetRank: 100 },
  { kind: "nation_uci_ranking", countryCode: "FR", targetRank: 10 },
  { kind: "national_championship", countryCode: "FR", championshipType: "road", requiredTitleCount: 1 },
  { kind: "homegrown_roster", minimumPercentage: 5 },
  { kind: "infrastructure", minimumCompletedCount: 1 },
  { kind: "youth_development", metric: "promotions", minimumCount: 1 },
];

describe("sponsor objective requirement families", () => {
  it("rejects nested thresholds and broad counters while retaining independent metrics", () => {
    expect(haveOverlappingSponsorObjectiveRequirements(targets[3], { kind: "season_wins", winScope: "stages", minimumWinCount: 6 })).toBe(true);
    expect(haveOverlappingSponsorObjectiveRequirements(targets[3], { kind: "season_wins", winScope: "all", minimumWinCount: 12 })).toBe(true);
    expect(haveOverlappingSponsorObjectiveRequirements(targets[3], { kind: "season_wins", winScope: "one_day_races", minimumWinCount: 3 })).toBe(false);
    expect(haveOverlappingSponsorObjectiveRequirements(race("a", 1), race("a", 10))).toBe(true);
    expect(haveOverlappingSponsorObjectiveRequirements(race("a", 1), race("b", 1))).toBe(false);
    expect(haveOverlappingSponsorObjectiveRequirements(targets[6], { kind: "national_championship", countryCode: "fr", championshipType: "any", requiredTitleCount: 2 })).toBe(true);
    expect(haveOverlappingSponsorObjectiveRequirements(targets[6], { kind: "national_championship", countryCode: "FR", championshipType: "time_trial", requiredTitleCount: 1 })).toBe(false);
    expect(haveOverlappingSponsorObjectiveRequirements(targets[8], { kind: "infrastructure", minimumCompletedCount: 3 })).toBe(true);
  });

  it("keeps separate visibility counters and rejects duplicated thresholds within a counter", () => {
    const classic = { kind: "race_visibility", metric: "classic_breakaways", minimumCount: 2 } as const;
    const stages = { ...classic, metric: "stage_breakaways" } as const;
    expect(haveOverlappingSponsorObjectiveRequirements(classic, stages)).toBe(false);
    expect(haveOverlappingSponsorObjectiveRequirements(classic, { ...classic, minimumCount: 4 })).toBe(true);
    expect(getSponsorObjectiveDifficultyWeight(classic, { sportingPhilosophy: "visibility" })).toBeCloseTo(11.5);
  });

  it("validates ten distinct positive commitments with exactly 100 satisfaction points", () => {
    const points = allocateSponsorObjectiveSatisfactionPoints(targets);
    expect(() => assertSponsorObjectivePlanConsistency(targets.map((targetDetails, index) => ({ targetDetails, satisfactionPoints: points[index] })))).not.toThrow();
    expect(points.every(point => Number.isInteger(point) && point > 0)).toBe(true);
    expect(points.reduce((sum, point) => sum + point, 0)).toBe(100);
    expect(allocateSponsorObjectiveSatisfactionPoints(targets)).toEqual(points);
    expect(() => assertSponsorObjectivePlanConsistency(targets.map((targetDetails, index) => ({ targetDetails: index === 1 ? targets[0] : targetDetails, satisfactionPoints: 10 })))).toThrow("engagements équivalents");
  });
});

describe("satisfaction follows final requirement difficulty", () => {
  it("gives six stage wins more raw weight than three irrespective of their former slots", () => {
    const three = { kind: "season_wins", winScope: "stages", minimumWinCount: 3 } as const;
    const six = { ...three, minimumWinCount: 6 };
    expect(getSponsorObjectiveDifficultyWeight(six)).toBeGreaterThan(getSponsorObjectiveDifficultyWeight(three));
    const points = allocateSponsorObjectiveSatisfactionPoints([three, six, ...targets.slice(2, 10)]);
    expect(points[1]).toBeGreaterThanOrEqual(points[0]);
  });

  it("never reduces a quota's normalized reward when its count increases", () => {
    const rewards = Array.from({ length: 30 }, (_, index) => {
      const changed = [...targets];
      changed[3] = { kind: "season_wins", winScope: "stages", minimumWinCount: index + 1 };
      return allocateSponsorObjectiveSatisfactionPoints(changed)[3];
    });
    expect(rewards.every((reward, index) => !index || reward >= rewards[index - 1])).toBe(true);
  });

  it("rewards harder ranks, higher categories, percentages and count targets monotonically", () => {
    const rankRewards = [50, 20, 10, 5, 3, 1].map(rank => {
      const changed = [...targets]; changed[0] = race("a", rank);
      return allocateSponsorObjectiveSatisfactionPoints(changed)[0];
    });
    const categoryRewards = (["national", "continental", "world", "elite"] as const).map(category =>
      allocateSponsorObjectiveSatisfactionPoints(targets, { raceCategories: new Map([["a", category]]) })[0]);
    const percentRewards = [10, 20, 30, 50, 70, 100].map(minimumPercentage => {
      const changed = [...targets]; changed[2] = { kind: "nationality_quota", countryCode: "FR", minimumPercentage };
      return allocateSponsorObjectiveSatisfactionPoints(changed)[2];
    });
    for (const rewards of [rankRewards, categoryRewards, percentRewards]) {
      expect(rewards.every((reward, index) => !index || reward >= rewards[index - 1])).toBe(true);
    }
    expect(getSponsorObjectiveDifficultyWeight({ kind: "season_wins", winScope: "stages", minimumWinCount: 3 }))
      .toBeGreaterThan(getSponsorObjectiveDifficultyWeight({ kind: "season_wins", winScope: "all", minimumWinCount: 3 }));
  });

  it("bounds the sponsor's family preference to fifteen percent", () => {
    expect(getSponsorObjectiveDifficultyWeight(targets[2], { sportingPhilosophy: "national_preference" }))
      .toBeCloseTo(getSponsorObjectiveDifficultyWeight(targets[2]) * 1.15);
  });
});
