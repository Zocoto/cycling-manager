import { describe, expect, it } from "vitest";

import {
  calculateFederationHostingAttendance,
  calculateFederationHostingSelectionScore,
  calculateFederationRaceReturn,
  FEDERATION_HOSTING_EVENTS,
  getFederationRenownLabel,
} from "@/lib/game/federation-hosting";

describe("federation hosting", () => {
  it("offers separate CM, CC and Nations Cup candidacies for pros and juniors", () => {
    expect(FEDERATION_HOSTING_EVENTS).toHaveLength(6);
    expect(FEDERATION_HOSTING_EVENTS.map((event) => event.type)).toEqual([
      "world_championship_pro",
      "continental_championship_pro",
      "nations_cup_pro",
      "world_championship_junior",
      "continental_championship_junior",
      "nations_cup_junior",
    ]);
  });

  it("makes hosting recency the main automatic selection factor", () => {
    expect(
      calculateFederationHostingSelectionScore({
        targetGameYear: 12,
        lastHostedGameYear: 3,
        nationRank: 173,
        renown: 0,
      }),
    ).toEqual({
      recencyPoints: 600,
      rankingPoints: 1,
      renownPoints: 0,
      total: 601,
    });
    expect(
      calculateFederationHostingSelectionScore({
        targetGameYear: 12,
        lastHostedGameYear: 11,
        nationRank: 1,
        renown: 1_000,
      }).total,
    ).toBe(400);
  });

  it("turns participation and renown into attendance and financial return", () => {
    const low = calculateFederationHostingAttendance({
      eventType: "nations_cup_junior",
      participationRate: 0.5,
      renown: 100,
    });
    const high = calculateFederationHostingAttendance({
      eventType: "nations_cup_junior",
      participationRate: 1,
      renown: 900,
    });

    expect(high.attendance).toBeGreaterThan(low.attendance);
    expect(high.grossRevenue).toBe(high.attendance * 11);
    expect(high.netReturn).toBe(high.grossRevenue - 550_000);
  });

  it("keeps low-ranked national races money-only and higher ranks mixed", () => {
    expect(
      calculateFederationRaceReturn({
        categoryCode: "national",
        completedStageCount: 2,
        starterCount: 120,
        officeLevel: 1,
      }).kind,
    ).toBe("money");
    expect(
      calculateFederationRaceReturn({
        categoryCode: "continental",
        completedStageCount: 2,
        starterCount: 120,
        officeLevel: 1,
      }),
    ).toMatchObject({ kind: "mixed", prestige: 6 });
    expect(getFederationRenownLabel(620)).toBe("Grande nation cycliste");
  });
});
