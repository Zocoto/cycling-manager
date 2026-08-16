import { describe, expect, it } from "vitest";

import {
  RACE_RECONNAISSANCE_BASE_BONUS,
  RACE_RECONNAISSANCE_DURATION_DAYS,
  canTeamRecognizeRace,
  getRacePreparerBonusPercentage,
  getRaceReconnaissanceBonus,
  getRaceReconnaissanceCost,
} from "@/lib/game/race-reconnaissance";

describe("race reconnaissance", () => {
  it("always lasts two days and starts from a +2 rating bonus", () => {
    expect(RACE_RECONNAISSANCE_DURATION_DAYS).toBe(2);
    expect(RACE_RECONNAISSANCE_BASE_BONUS).toBe(2);
    expect(getRaceReconnaissanceBonus()).toBe(2);
  });

  it("adds five percent of efficiency per preparer level", () => {
    expect(
      Array.from({ length: 5 }, (_, index) =>
        getRacePreparerBonusPercentage(index + 1),
      ),
    ).toEqual([5, 10, 15, 20, 25]);
    expect(getRaceReconnaissanceBonus(1)).toBe(2.1);
    expect(getRaceReconnaissanceBonus(5)).toBe(2.5);
  });

  it("makes elite reconnaissance more expensive than lower categories", () => {
    expect(
      getRaceReconnaissanceCost({
        categoryCode: "elite",
        raceFormat: "one_day",
      }),
    ).toBe(20_000);
    expect(
      getRaceReconnaissanceCost({
        categoryCode: "national",
        raceFormat: "one_day",
      }),
    ).toBe(4_000);
    expect(
      getRaceReconnaissanceCost({
        categoryCode: "regional",
        raceFormat: "one_day",
      }),
    ).toBe(2_500);
  });

  it("charges a single tour stage less than a full one-day race", () => {
    expect(
      getRaceReconnaissanceCost({
        categoryCode: "world",
        raceFormat: "stage_race",
      }),
    ).toBeLessThan(
      getRaceReconnaissanceCost({
        categoryCode: "world",
        raceFormat: "one_day",
      }),
    );
  });

  it("allows reconnaissance for races open to the team's reputation", () => {
    expect(
      canTeamRecognizeRace({
        registrationStatus: null,
        registrationPolicy: "open",
        registrationClosesAt: "2026-07-30T12:00:00Z",
        minimumReputation: 20,
        reputationPoints: 30,
        now: new Date("2026-07-26T12:00:00Z"),
      }),
    ).toBe(true);
    expect(
      canTeamRecognizeRace({
        registrationStatus: null,
        registrationPolicy: "open",
        registrationClosesAt: "2026-07-30T12:00:00Z",
        minimumReputation: 40,
        reputationPoints: 30,
        now: new Date("2026-07-26T12:00:00Z"),
      }),
    ).toBe(false);
  });

  it("keeps accepted races eligible after registrations close", () => {
    expect(
      canTeamRecognizeRace({
        registrationStatus: "accepted",
        registrationPolicy: "closed",
        registrationClosesAt: "2026-07-25T12:00:00Z",
        minimumReputation: 40,
        reputationPoints: 0,
        now: new Date("2026-07-26T12:00:00Z"),
      }),
    ).toBe(true);
  });
});
