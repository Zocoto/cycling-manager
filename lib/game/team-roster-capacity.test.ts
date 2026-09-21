import { describe, expect, it } from "vitest";

import {
  BASE_TEAM_ROSTER_SIZE,
  getRosterManagementRenewalDiscountPercent,
  getRosterManagementRotationCapacity,
  getTeamRosterBaseLimit,
  getTeamRosterTotalLimit,
  getTeamRosterYouthReserveSlots,
  isTeamRosterAtCapacity,
  MAX_TEAM_ROSTER_SIZE,
} from "@/lib/game/team-roster-capacity";

describe("team roster capacity", () => {
  it("keeps 35 riders as the compatibility baseline", () => {
    expect(BASE_TEAM_ROSTER_SIZE).toBe(35);
    expect(MAX_TEAM_ROSTER_SIZE).toBe(35);
  });

  it("adds five general roster places per building level", () => {
    expect([0, 1, 2, 3, 4, 5, 8].map(getTeamRosterBaseLimit)).toEqual([
      35, 40, 45, 50, 55, 60, 60,
    ]);
  });

  it("reserves additional places exclusively for academy graduates", () => {
    expect(
      getTeamRosterYouthReserveSlots({
        buildingLevel: 2,
        specialization: "youth_pathway",
      }),
    ).toBe(0);
    expect(
      [3, 4, 5].map((buildingLevel) =>
        getTeamRosterTotalLimit({
          buildingLevel,
          specialization: "youth_pathway",
        }),
      ),
    ).toEqual([53, 59, 65]);
  });

  it("scales the retention and rotation specializations at levels 3 to 5", () => {
    expect(
      [3, 4, 5].map((buildingLevel) =>
        getRosterManagementRenewalDiscountPercent({
          buildingLevel,
          specialization: "retention_cell",
        }),
      ),
    ).toEqual([3, 4, 5]);
    expect(
      [3, 4, 5].map((buildingLevel) =>
        getRosterManagementRotationCapacity({
          buildingLevel,
          specialization: "rotation_management",
        }),
      ),
    ).toEqual([3, 4, 5]);
  });

  it("considers the roster full from the thirty-fifth rider", () => {
    expect(isTeamRosterAtCapacity(34)).toBe(false);
    expect(isTeamRosterAtCapacity(35)).toBe(true);
    expect(isTeamRosterAtCapacity(36)).toBe(true);
    expect(isTeamRosterAtCapacity(44, 45)).toBe(false);
    expect(isTeamRosterAtCapacity(45, 45)).toBe(true);
  });
});
