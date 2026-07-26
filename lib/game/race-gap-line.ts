import type { RaceGroupSnapshot } from "@/lib/game/race-simulation";

export type RaceGapLineEntry = {
  group: RaceGroupSnapshot;
  position: number;
  gapToLeaderSeconds: number;
};

export function buildRaceGapLine(
  groups: readonly RaceGroupSnapshot[],
): RaceGapLineEntry[] {
  return groups
    .map((group, sourceIndex) => ({
      group,
      sourceIndex,
      gapToLeaderSeconds: Math.max(
        0,
        Math.round(group.gapToLeaderSeconds),
      ),
    }))
    .sort(
      (first, second) =>
        first.gapToLeaderSeconds -
          second.gapToLeaderSeconds ||
        first.sourceIndex - second.sourceIndex,
    )
    .map(
      (
        { group, gapToLeaderSeconds },
        index,
      ) => ({
        group,
        position: index + 1,
        gapToLeaderSeconds,
      }),
    );
}
