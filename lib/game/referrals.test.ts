import { describe, expect, it } from "vitest";

import {
  buildReferralInviteUrl,
  getNextReferralMilestone,
  getReferralProgressPercent,
  getUnlockedReferralTrophies,
  type ReferralMilestone,
} from "./referrals";

const milestones: ReferralMilestone[] = [1, 3, 5, 10, 25].map((count) => ({
  count,
  rewardKey: `reward-${count}`,
  rewardName: `Objet ${count}`,
  rewardSummary: "Bonus",
  rewardLevel: count < 5 ? 5 : count < 10 ? 6 : 7,
  granted: false,
  grantedAt: null,
}));

describe("referrals", () => {
  it("construit une URL personnelle encodée", () => {
    expect(buildReferralInviteUrl("https://cyclostrategie.fr/", "DS-ABC123"))
      .toBe("https://cyclostrategie.fr/inscription?parrain=DS-ABC123");
  });

  it("désigne le prochain palier et sa progression", () => {
    const next = getNextReferralMilestone(milestones, 3);
    expect(next?.count).toBe(5);
    expect(getReferralProgressPercent(3, next)).toBe(60);
  });

  it("débloque la tenue du Parrain au trophée des cinq filleuls", () => {
    expect(getUnlockedReferralTrophies(4).map((trophy) => trophy.count))
      .toEqual([1]);
    expect(getUnlockedReferralTrophies(5).map((trophy) => trophy.count))
      .toEqual([1, 5]);
  });
});
