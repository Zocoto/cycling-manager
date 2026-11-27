import { describe, expect, it } from "vitest";
import {
  calculateSecondarySponsorObjectiveReward, calculateSecondarySponsorNationalityReward,
  getSecondarySponsorEligibleCategoryCodes, getSecondarySponsorObjectiveCount,
  getSecondarySponsorTargetRank, getSecondarySponsorFailurePenalty,
  getSecondarySponsorNationalityTarget, normalizeSecondarySponsorLogoPlacement,
  capSecondarySponsorObjectiveRewards, getSecondarySponsorMaximumReward,
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

describe("secondary sponsor budget envelope", () => {
  it("caps the entire offer, rather than every objective, at thirty percent", () => {
    expect(getSecondarySponsorMaximumReward(2_000_000)).toBe(600_000);
    expect(capSecondarySponsorObjectiveRewards([424_000,424_000,424_000,424_000,424_000],2_000_000))
      .toEqual([120_000,120_000,120_000,120_000,120_000]);
  });
  it("preserves weights, objective order and a lower existing total", () => {
    const rewards=capSecondarySponsorObjectiveRewards([424_000,424_000,424_000,424_000,169_000],2_000_000);
    expect(Math.round(rewards.reduce((sum,reward)=>sum+reward,0)*100)).toBe(60_000_000);
    expect(rewards[0]).toBe(rewards[1]);
    expect(rewards[0]/rewards[4]).toBeCloseTo(424/169,5);
    expect(capSecondarySponsorObjectiveRewards([45_000,50_000,35_000],2_000_000)).toEqual([45_000,50_000,35_000]);
  });
  it("never rounds past the ceiling and keeps tiny goals positive", () => {
    expect(getSecondarySponsorMaximumReward(3_333.33)).toBe(999.99);
    const rewards=capSecondarySponsorObjectiveRewards([1_000_000,0.01,0.01],10);
    expect(rewards).toEqual([2.98,0.01,0.01]);
    expect(capSecondarySponsorObjectiveRewards([10,10,10],10)).toEqual([1,1,1]);
  });
  it("handles every normal offer size with an exact cents total", () => {
    for(const budget of [1,10,3_333.33,100_000,2_000_000]) {
      for(const count of [3,4,5]) {
        const rewards=capSecondarySponsorObjectiveRewards(Array.from({length:count},(_,i)=>424_000/(i+1)),budget);
        expect(rewards.every(reward=>reward>0)).toBe(true);
        expect(rewards.reduce((sum,reward)=>sum+Math.round(reward*100),0)).toBe(Math.round(getSecondarySponsorMaximumReward(budget)*100));
      }
    }
  });
  it("does not invent a primary sponsor budget or silently drop an objective", () => {
    expect(getSecondarySponsorMaximumReward(Number.NaN)).toBe(0);
    expect(getSecondarySponsorMaximumReward(-1)).toBe(0);
    expect(()=>capSecondarySponsorObjectiveRewards([1,2,3],0)).toThrow("Insufficient primary sponsor budget");
    expect(()=>capSecondarySponsorObjectiveRewards([1,0,3],100)).toThrow("Invalid secondary sponsor reward");
  });
});
