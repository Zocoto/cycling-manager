import { describe, expect, it } from "vitest";

import {
  PCM_GALA_RACES,
  PCM_GALA_ROSTER_SIZE,
  getPcmGalaRace,
  isPcmGalaRaceKey,
} from "@/lib/game/pcm-gala-races";

describe("courses de gala PCM26", () => {
  it("expose exactement les trois profils retenus avec leurs références PCM26", () => {
    expect(PCM_GALA_RACES).toHaveLength(3);
    expect(PCM_GALA_ROSTER_SIZE).toBe(7);
    expect(
      PCM_GALA_RACES.map((race) => ({
        key: race.key,
        raceId: race.pcmSource.raceId,
        stageId: race.pcmSource.stageId,
        type: race.pcmSource.raceType,
      })),
    ).toEqual([
      {
        key: "gala-des-sommets",
        raceId: 172,
        stageId: 1172,
        type: "CLAS_MO",
      },
      {
        key: "gala-des-puncheurs",
        raceId: 15,
        stageId: 1015,
        type: "CLAS_VAL",
      },
      {
        key: "gala-des-sprinteurs",
        raceId: 92,
        stageId: 1092,
        type: "CLAS_PLONLY",
      },
    ]);
  });

  it("conserve pour chaque adaptation CS la distance annoncée", () => {
    for (const race of PCM_GALA_RACES) {
      const segmentDistance = race.segments.reduce(
        (total, segment) => total + segment.distanceKm,
        0,
      );

      expect(segmentDistance).toBe(race.distanceKm);
      expect(race.segments.every((segment) => segment.surface === "asphalt")).toBe(
        true,
      );
    }
  });

  it("rejette les clés étrangères à l'événement", () => {
    expect(isPcmGalaRaceKey("gala-des-sommets")).toBe(true);
    expect(isPcmGalaRaceKey("tour-de-france")).toBe(false);
    expect(getPcmGalaRace("gala-des-puncheurs")?.primaryRating).toBe("hills");
  });
});
