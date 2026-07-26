import { describe, expect, it } from "vitest";

import { buildRaceGapLine } from "@/lib/game/race-gap-line";
import type { RaceGroupSnapshot } from "@/lib/game/race-simulation";

describe("buildRaceGapLine", () => {
  it("orders every group from the race head to the last group", () => {
    const entries = buildRaceGapLine([
      createGroup("peloton", 219),
      createGroup("breakaway", 0),
      createGroup("chase", 23),
      createGroup("dropped", 408),
    ]);

    expect(
      entries.map((entry) => ({
        id: entry.group.id,
        position: entry.position,
        gap: entry.gapToLeaderSeconds,
      })),
    ).toEqual([
      {
        id: "breakaway",
        position: 1,
        gap: 0,
      },
      {
        id: "chase",
        position: 2,
        gap: 23,
      },
      {
        id: "peloton",
        position: 3,
        gap: 219,
      },
      {
        id: "dropped",
        position: 4,
        gap: 408,
      },
    ]);
  });

  it("keeps source order for groups at the same gap and normalizes invalid negative gaps", () => {
    const entries = buildRaceGapLine([
      createGroup("first-at-zero", 0),
      createGroup("negative-gap", -12),
      createGroup("second-at-zero", 0),
    ]);

    expect(
      entries.map((entry) => entry.group.id),
    ).toEqual([
      "first-at-zero",
      "negative-gap",
      "second-at-zero",
    ]);
    expect(
      entries.map(
        (entry) => entry.gapToLeaderSeconds,
      ),
    ).toEqual([0, 0, 0]);
  });
});

function createGroup(
  id: string,
  gapToLeaderSeconds: number,
): RaceGroupSnapshot {
  return {
    id,
    label: id,
    type: "peloton",
    riderIds: [`${id}-rider`],
    gapToLeaderSeconds,
    averageEnergy: 50,
  };
}
