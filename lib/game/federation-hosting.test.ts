import { describe, expect, it } from "vitest";

import {
  calculateFederationHostingAttendance,
  calculateFederationHostingSelectionScore,
  calculateFederationRaceReturn,
  FEDERATION_HOSTING_EVENTS,
  getFederationHostingEventsForGameYear,
  getFederationRenownLabel,
  projectFederationHostingReturn,
} from "@/lib/game/federation-hosting";

describe("federation hosting", () => {
  it("replaces only the professional Nations Cup in quadriennial seasons", () => {
    expect(FEDERATION_HOSTING_EVENTS).toHaveLength(7);
    expect(getFederationHostingEventsForGameYear(3).map((event) => event.type)).toEqual([
      "world_championship_pro",
      "continental_championship_pro",
      "nations_cup_pro",
      "world_championship_junior",
      "continental_championship_junior",
    ]);
    expect(getFederationHostingEventsForGameYear(4).map((event) => event.type)).toEqual([
      "world_championship_pro",
      "continental_championship_pro",
      "quadrennial_games_pro",
      "world_championship_junior",
      "continental_championship_junior",
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
      organizationPoints: 0,
      total: 601,
    });
    expect(
      calculateFederationHostingSelectionScore({
        targetGameYear: 12,
        lastHostedGameYear: 11,
        nationRank: 1,
        renown: 1_000,
      }).total,
    ).toBe(350);
    expect(calculateFederationHostingSelectionScore({
      targetGameYear: 12,
      lastHostedGameYear: 11,
      nationRank: 1,
      renown: 1_000,
      organizationOfficeLevel: 5,
    }).total).toBe(400);
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

  it("projects hosting income from the reduced tariff before any draw", () => {
    const economics = {
      catalogCost: 1_440_000,
      prestigeGain: 35,
      countryTarget: 25,
      readerTarget: 70,
      seatTarget: 320,
      baseRate: 0.85,
      countryCapRate: 0.5,
      readerCapRate: 0.1,
      seatCapRate: 0.05,
      drawEligibleCountryRate: 0.6,
      drawSmallRate: 0.15,
      drawSmallProbability: 0.3,
      drawLargeRate: 0.35,
      drawLargeProbability: 0.1,
    };
    expect(projectFederationHostingReturn({
      economics, hostingCost: 1_440_000, countryRate: 0.8, readerRate: 0.6, seatRate: 0.5,
    })).toEqual({ grossRevenue: 1_922_400, netReturn: 482_400 });
    expect(projectFederationHostingReturn({
      economics, hostingCost: 1_400_000, countryRate: 2, readerRate: 2, seatRate: -1,
    })).toEqual({ grossRevenue: 2_088_000, netReturn: 688_000 });
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
