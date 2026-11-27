import { describe, expect, it } from "vitest";
import {
  calculateSecondarySponsorObjectiveReward, calculateSecondarySponsorNationalityReward,
  getSecondarySponsorEligibleCategoryCodes, getSecondarySponsorObjectiveCount,
  getSecondarySponsorTargetRank, getSecondarySponsorFailurePenalty,
  getSecondarySponsorNationalityTarget, normalizeSecondarySponsorLogoPlacement,
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
    expect(getSecondarySponsorFailurePenalty(199_000)).toBe(0);
    expect(getSecondarySponsorFailurePenalty(200_000)).toBe(20);
    expect(getSecondarySponsorFailurePenalty(520_000)).toBe(55);
    expect(getSecondarySponsorFailurePenalty(10_000_000)).toBe(100);
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
