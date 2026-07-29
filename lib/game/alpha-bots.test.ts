import { describe, expect, it } from "vitest";

import {
  ALPHA_BOT_PROFILES,
  buildAlphaBotCycleKey,
  buildRaceRoster,
  chooseTrainingPlan,
  deterministicIndex,
} from "@/lib/game/alpha-bots";

describe("alpha manager bots", () => {
  it("defines five natural and distinct profiles", () => {
    expect(ALPHA_BOT_PROFILES).toHaveLength(5);
    expect(new Set(ALPHA_BOT_PROFILES.map((profile) => profile.key)).size).toBe(
      5,
    );
    expect(
      new Set(ALPHA_BOT_PROFILES.map((profile) => profile.managerName)).size,
    ).toBe(5);
    expect(
      ALPHA_BOT_PROFILES.every(
        (profile) =>
          !profile.managerName.toLowerCase().includes("bot") &&
          !profile.teamName.toLowerCase().includes("bot"),
      ),
    ).toBe(true);
  });

  it("builds one cycle key per Paris day and slot", () => {
    const date = new Date("2026-07-29T23:30:00.000Z");
    expect(buildAlphaBotCycleKey(date, "morning")).toBe(
      "2026-07-30:morning",
    );
    expect(buildAlphaBotCycleKey(date, "evening")).toBe(
      "2026-07-30:evening",
    );
  });

  it("uses deterministic choices", () => {
    expect(deterministicIndex("same-cycle", 7)).toBe(
      deterministicIndex("same-cycle", 7),
    );
    expect(deterministicIndex("same-cycle", 0)).toBe(-1);
  });

  it("rests riders below the profile threshold", () => {
    const profile = ALPHA_BOT_PROFILES[0];
    const plan = chooseTrainingPlan(profile, {
      id: "rider",
      firstName: "A",
      lastName: "B",
      countryName: "France",
      countryCode: "FR",
      avatarProfileKey: null,
      avatarSeed: null,
      age: 22,
      potentialSteps: 4,
      form: profile.minimumForm - 1,
      declineProfile: {
        seasonPointsBeforeTraining: 0,
        naturalMultiplier: 1,
        longevityTier: "standard",
        hasIronHealth: false,
      },
      ratings: {
        mountain: 70,
        hills: 60,
        flat: 50,
        time_trial: 50,
        cobbles: 45,
        sprint: 40,
        acceleration: 55,
        downhill: 60,
        endurance: 65,
        resistance: 60,
        recovery: 60,
        breakaway: 55,
        prologue: 45,
      },
      plan: {
        intensity: 50,
        domain: "climber",
        trainerContractId: null,
        effectiveFromDayNumber: 1,
        isPending: false,
      },
      latestReport: null,
      seasonReport: null,
    } as never);
    expect(plan.intensity).toBe(0);
    expect(plan.domain).toBe("climber");
  });

  it("selects a valid sprint roster and explicit roles", () => {
    const edition = {
      id: "edition",
      raceId: "race",
      slug: "course",
      name: "Course",
      shortName: null,
      countryName: "France",
      countryCode: "FR",
      categoryCode: "amateur",
      categoryName: "Amateur",
      prestigeRank: 1,
      raceFormat: "one_day",
      competitionType: "standard",
      registrationClosesAt: null,
      wildcardClosesAt: null,
      withdrawalClosesAt: null,
      registrationPolicy: "open",
      minimumReputation: null,
      minimumRosterSize: 2,
      maximumRosterSize: 3,
      engagedRiderCount: 0,
      engagedRiders: [],
      currentTeamRegistration: null,
      stages: [
        {
          id: "stage",
          dayNumber: 2,
          stageNumber: 1,
          name: "Étape",
          stageType: "road",
          status: "planned",
          profileType: "sprint",
          distanceKm: 150,
          daySlot: "early",
          departureAt: null,
          segments: [],
        },
      ],
    } as never;
    const riders = [
      makeRosterRider("sprinter", { sprint: 75, flat: 65 }),
      makeRosterRider("leadout", { sprint: 68, flat: 70 }),
      makeRosterRider("climber", { sprint: 40, flat: 50, mountain: 80 }),
    ];
    const roster = buildRaceRoster(
      ALPHA_BOT_PROFILES[2],
      edition,
      riders as never,
    );
    expect(roster).toHaveLength(2);
    expect(roster[0]).toEqual({ riderId: "sprinter", role: "sprinter" });
    expect(roster[1]).toEqual({ riderId: "leadout", role: "leadout" });
  });
});

function makeRosterRider(
  riderId: string,
  overrides: Partial<{
    mountain: number;
    hills: number;
    flat: number;
    timeTrial: number;
    cobbles: number;
    sprint: number;
  }>,
) {
  return {
    riderId,
    firstName: riderId,
    lastName: "Test",
    countryName: "France",
    countryCode: "FR",
    avatarProfileKey: "europe_west_01",
    avatarSeed: 1,
    age: 25,
    mountain: 50,
    hills: 50,
    flat: 50,
    timeTrial: 50,
    cobbles: 50,
    sprint: 50,
    isSelected: false,
    isAvailable: true,
    unavailability: null,
    conflict: null,
    ...overrides,
  };
}
