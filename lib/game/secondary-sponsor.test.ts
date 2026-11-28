import { describe, expect, it } from "vitest";
import {
  calculateSecondarySponsorObjectiveReward, calculateSecondarySponsorNationalityReward,
  getSecondarySponsorEligibleCategoryCodes, getSecondarySponsorObjectiveCount,
  getSecondarySponsorTargetRank, getSecondarySponsorFailurePenalty,
  getSecondarySponsorNationalityTarget, normalizeSecondarySponsorLogoPlacement,
  getSecondarySponsorFundingProfiles, getSecondarySponsorObjectiveDifficulty, priceSecondarySponsorOffers,
} from "./secondary-sponsor";

describe("secondary sponsor", () => {
  it("offers three to five objectives according to sponsor prestige", () => {
    expect([1,2,3,4,5].map(value => getSecondarySponsorObjectiveCount(value as 1|2|3|4|5))).toEqual([3,3,4,4,5]);
  });
  it("sets the sporting category using team reputation, independently of sponsor prestige", () => {
    expect(getSecondarySponsorEligibleCategoryCodes(1_500)).toEqual(["continental","world","elite"]);
    expect(getSecondarySponsorEligibleCategoryCodes(5_000)).toEqual(["world","elite"]);
    expect(getSecondarySponsorEligibleCategoryCodes(25_000)).toEqual(["world","elite"]);
  });
  it("scales rewards with reputation, category and target difficulty", () => {
    const rank = getSecondarySponsorTargetRank({prestige:5,categoryCode:"elite",index:0});
    const basic = calculateSecondarySponsorObjectiveReward({prestige:5,categoryCode:"elite",targetRank:rank,reputationPoints:1_500});
    const strong = calculateSecondarySponsorObjectiveReward({prestige:5,categoryCode:"elite",targetRank:rank,reputationPoints:15_000});
    expect(rank).toBe(2);
    expect(basic).toBe(260_000);
    expect(strong).toBe(520_000);
    expect(calculateSecondarySponsorObjectiveReward({prestige:1,categoryCode:"world",targetRank:10,reputationPoints:15_000})).toBe(198_000);
    expect(calculateSecondarySponsorObjectiveReward({prestige:5,categoryCode:"elite",targetRank:1,reputationPoints:15_000})).toBeGreaterThan(strong);
    expect(calculateSecondarySponsorObjectiveReward({prestige:5,categoryCode:"elite",targetRank:rank,reputationPoints:1_000_000})).toBe(strong);
  });
  it("attaches a bounded reputation risk only to large rewards", () => {
    expect(getSecondarySponsorFailurePenalty(99_999)).toBe(0);
    expect(getSecondarySponsorFailurePenalty(120_000)).toBe(10);
    expect(getSecondarySponsorFailurePenalty(200_000)).toBe(10);
    expect(getSecondarySponsorFailurePenalty(520_000)).toBe(25);
    expect(getSecondarySponsorFailurePenalty(10_000_000)).toBe(25);
  });
  it.each([0,5,9,10,19,20,29,30,50])("keeps the numeric nationality target below 10 percent for roster size %i", rosterSize => {
    const count=getSecondarySponsorNationalityTarget({rosterSize,prestige:5,sponsorCountryCode:"AM",principalCountryCode:"CO"});
    expect(count).toBeLessThanOrEqual(Math.floor(rosterSize/10));
    expect(count).toBeLessThanOrEqual(3);
    expect(Number.isInteger(count)).toBe(true);
  });
  it("never adds a roster objective for a sponsor of the principal sponsor's nationality", () => {
    expect(getSecondarySponsorNationalityTarget({rosterSize:40,prestige:5,sponsorCountryCode:"CO",principalCountryCode:"CO"})).toBe(0);
    expect(getSecondarySponsorNationalityTarget({rosterSize:40,prestige:5,sponsorCountryCode:"AM",principalCountryCode:null})).toBe(0);
    expect(getSecondarySponsorNationalityTarget({rosterSize:40,prestige:1,sponsorCountryCode:"AM",principalCountryCode:"CO"})).toBe(1);
  });
  it("rewards nationality objectives according to the concrete target and team strength", () => {
    const small=calculateSecondarySponsorNationalityReward({targetCount:1,prestige:1,reputationPoints:1_500});
    const strong=calculateSecondarySponsorNationalityReward({targetCount:3,prestige:5,reputationPoints:15_000});
    expect(small).toBe(45_000);
    expect(strong).toBe(208_000);
  });
  it("bounds placement and preserves the contrasting logo choice", () => {
    expect(normalizeSecondarySponsorLogoPlacement({xPercent:-100,yPercent:200,scale:9,rotationDegrees:-90,colorMode:"white"})).toEqual({xPercent:15,yPercent:78,scale:1.8,rotationDegrees:-45,colorMode:"white"});
    expect(normalizeSecondarySponsorLogoPlacement({xPercent:50,yPercent:48,scale:1,rotationDegrees:0})).toEqual({xPercent:50,yPercent:48,scale:1,rotationDegrees:0});
  });
});

describe("varied secondary sponsor quotes", () => {
  const offers = (difficulty = 1.5) => ["brand-a", "brand-b", "brand-c"].map(id => ({ id,
    objectives: [100_000, 200_000, 300_000].map(weight => ({ weight, difficulty })) }));
  const totals = (rewards: number[][]) => rewards.map(goals => goals.reduce((sum, amount) => sum + Math.round(amount * 100), 0) / 100);

  it("offers three stable, clearly different totals rather than three thirty-percent ceilings", () => {
    const input = { principalBudgetPerSeason: 2_000_000, seed: "team-season", offers: offers() };
    const priced = priceSecondarySponsorOffers(input);
    expect(priceSecondarySponsorOffers(input)).toEqual(priced);
    const sorted = totals(priced).sort((a, b) => a - b);
    expect(sorted[1] - sorted[0]).toBeGreaterThanOrEqual(100_000);
    expect(sorted[2] - sorted[1]).toBeGreaterThanOrEqual(100_000);
    expect(sorted[0]).toBeLessThan(600_000);
    expect(sorted[2]).toBeGreaterThan(600_000);
    for (const row of priced) {
      expect(row.every(amount => amount > 0)).toBe(true);
      expect(row[2] / row[0]).toBeCloseTo(3, 4);
      expect(row[1] / row[0]).toBeCloseTo(2, 4);
    }
  });

  it("keeps the funding appetite attached to the same brands when display order changes", () => {
    const ids = offers().map(offer => offer.id);
    expect(getSecondarySponsorFundingProfiles("team-season", ids)).toEqual(getSecondarySponsorFundingProfiles("team-season", ids.toReversed()));
    const normal = priceSecondarySponsorOffers({ principalBudgetPerSeason: 2_000_000, seed: "team-season", offers: offers() });
    const reversed = priceSecondarySponsorOffers({ principalBudgetPerSeason: 2_000_000, seed: "team-season", offers: offers().toReversed() });
    expect(reversed).toEqual(normal.toReversed());
  });

  it("makes the prudent target easier and the ambitious target harder", () => {
    const target = { prestige: 5 as const, categoryCode: "elite" as const, index: 0 };
    expect([0, 1, 2].map(fundingProfile => getSecondarySponsorTargetRank({ ...target, fundingProfile: fundingProfile as 0 | 1 | 2 })))
      .toEqual([4, 2, 1]);
  });

  it("increases rewards with the actual category, placing and whole-race format", () => {
    const demand = (categoryCode: "continental" | "elite", targetRank: number, raceFormat: "one_day" | "stage_race" = "one_day", isGrandTour = false) =>
      getSecondarySponsorObjectiveDifficulty({ categoryCode, targetRank, raceFormat, isGrandTour });
    const situations = [demand("continental", 10), demand("elite", 10), demand("elite", 3), demand("elite", 1),
      demand("elite", 1, "stage_race"), demand("elite", 1, "stage_race", true)];
    expect(situations).toEqual([...situations].sort((a, b) => a - b));
    const quote = (difficulty: number) => totals(priceSecondarySponsorOffers({ principalBudgetPerSeason: 2_000_000, seed: "same-financial-signatures", offers: offers(difficulty) }));
    for (let index = 1; index < situations.length; index++) {
      const previous = quote(situations[index - 1]), harder = quote(situations[index]);
      expect(harder.every((amount, slot) => amount >= previous[slot])).toBe(true);
      expect(harder.some((amount, slot) => amount > previous[slot])).toBe(true);
    }
    const oneHarder = offers();
    oneHarder[0].objectives[0] = { weight: 200_000, difficulty: 3 };
    const old = priceSecondarySponsorOffers({ principalBudgetPerSeason: 2_000_000, seed: "same-financial-signatures", offers: offers() });
    const next = priceSecondarySponsorOffers({ principalBudgetPerSeason: 2_000_000, seed: "same-financial-signatures", offers: oneHarder });
    expect(next[0][0]).toBeGreaterThan(old[0][0]);
  });

  it("centres the population near thirty percent and reserves exceptional bids for a small minority", () => {
    const ratios: number[] = [];
    for (let index = 0; index < 1_000; index++) {
      const amounts = totals(priceSecondarySponsorOffers({ principalBudgetPerSeason: 2_000_000, seed: `pricing-seed-${index}`, offers: offers() }));
      expect(new Set(amounts).size).toBe(3);
      ratios.push(...amounts.map(amount => amount / 2_000_000));
    }
    const rare = ratios.filter(ratio => ratio < 0.15 || ratio > 0.5);
    expect(rare.length / ratios.length).toBeGreaterThan(0.035);
    expect(rare.length / ratios.length).toBeLessThan(0.065);
    expect(ratios.some(ratio => ratio < 0.12)).toBe(true);
    expect(ratios.some(ratio => ratio > 0.6)).toBe(true);
    expect(ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length).toBeGreaterThan(0.28);
    expect(ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length).toBeLessThan(0.34);
    expect(new Set(ratios).size).toBeGreaterThan(100);
  });

  it.each([0.01, 1, 10, 100_000, 10_000_000, 999_999_999_999.99])("keeps exact positive cents, distinct totals and legal objective amounts at primary budget %s", budget => {
    const unequal = offers();
    unequal[0].objectives = [{ weight: 10_000_000, difficulty: 3 }, { weight: 0.01, difficulty: 1 }, { weight: 0.01, difficulty: 1 }];
    const priced = priceSecondarySponsorOffers({ principalBudgetPerSeason: budget, seed: "edge-budget", offers: unequal });
    expect(new Set(totals(priced)).size).toBe(3);
    for (const row of priced) for (const amount of row) {
      expect(amount).toBeGreaterThanOrEqual(0.01);
      expect(amount).toBeLessThanOrEqual(5_000_000);
      expect(Math.round(amount * 100) / 100).toBe(amount);
    }
  });

  it("rejects invalid reference budgets, duplicate brands and unusable goal weights", () => {
    expect(() => priceSecondarySponsorOffers({ principalBudgetPerSeason: 0, seed: "bad", offers: offers() })).toThrow();
    const duplicate = offers(); duplicate[1].id = duplicate[0].id;
    expect(() => priceSecondarySponsorOffers({ principalBudgetPerSeason: 2_000_000, seed: "bad", offers: duplicate })).toThrow();
    const invalid = offers(); invalid[0].objectives[0].weight = 0;
    expect(() => priceSecondarySponsorOffers({ principalBudgetPerSeason: 2_000_000, seed: "bad", offers: invalid })).toThrow();
  });
});
