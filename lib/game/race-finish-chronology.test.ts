import { describe, expect, it } from "vitest";

import provincesFinish from "./__fixtures__/provinces-stage6-finish-inputs.json";
import {
  applyChronologicalRoadFinishEffort,
  normalizeRoadFinishGroupTimes,
} from "./race-simulation";

type FinishRow = {
  riderId: string;
  elapsedTimeSeconds: number;
  score: number;
};

function classify(rows: FinishRow[]) {
  const winnerTime = rows[0].elapsedTimeSeconds;
  const results = rows.map((row, index) => ({
    riderId: row.riderId,
    rank: index + 1,
    status: "finished" as const,
    elapsedTimeSeconds: Math.round(row.elapsedTimeSeconds),
    gapToWinnerSeconds: Math.max(
      0,
      Math.round(row.elapsedTimeSeconds - winnerTime),
    ),
    energyAfter: 50,
    injury: null,
    abandonment: null,
  }));
  normalizeRoadFinishGroupTimes({ results });
  return results;
}

describe("chronologie de l'effort final", () => {
  it("reproduit puis empêche les 15 dépassements artificiels du cas Burkhanov", () => {
    const groups = provincesFinish.groups;
    const results = provincesFinish.riders;
    const effortGapSecondsByRiderId = new Map(
      results.map((row) => [row.riderId, row.effortGapSeconds]),
    );
    const burkhanov = results.find(
      (row) => row.name === "Shamyrat Burkhanov",
    )!;
    const teammates = results.filter((row) =>
      ["Mario Sorrentino", "Hrvoje Kranjc", "Mile Marić", "Theuns Visser"].includes(
        row.name,
      ),
    );
    const rearGroup = groups.find((group) =>
      group.riderIds.includes(teammates[0].riderId),
    )!;
    expect(teammates).toHaveLength(4);
    expect(rearGroup.riderIds).toHaveLength(15);
    expect(burkhanov.elapsedTimeSeconds).toBe(20889.000760013772);
    expect(burkhanov.effortGapSeconds).toBe(34.65468057866042);

    // Verify that these real frozen inputs expose the reported regression.
    const oldFinish = classify(
      results
        .map((row) => ({
          ...row,
          elapsedTimeSeconds: row.elapsedTimeSeconds + row.effortGapSeconds,
        }))
        .sort(
          (first, second) =>
            first.elapsedTimeSeconds - second.elapsedTimeSeconds ||
            second.score - first.score,
        ),
    );
    const oldLeader = oldFinish.find((row) => row.riderId === burkhanov.riderId)!;
    expect(oldLeader.gapToWinnerSeconds).toBe(47);
    for (const teammate of teammates) {
      const oldTeammate = oldFinish.find((row) => row.riderId === teammate.riderId)!;
      expect(oldLeader.elapsedTimeSeconds - oldTeammate.elapsedTimeSeconds).toBe(11);
    }

    const correctedRows = applyChronologicalRoadFinishEffort({
      results,
      groups,
      effortGapSecondsByRiderId,
    });
    const corrected = classify(correctedRows);
    const leader = corrected.find((row) => row.riderId === burkhanov.riderId)!;
    for (const riderId of rearGroup.riderIds) {
      const rear = corrected.find((row) => row.riderId === riderId)!;
      expect(leader.rank).toBeLessThan(rear.rank);
      expect(leader.elapsedTimeSeconds).toBeLessThanOrEqual(rear.elapsedTimeSeconds);
    }
    expect(correctedRows.find((row) => row.riderId === burkhanov.riderId)!
      .elapsedTimeSeconds).toBe(20916);
    expect(corrected).toHaveLength(180);
    expect(new Set(corrected.map((row) => row.riderId)).size).toBe(180);
  });

  it.each([0, 0.1, 1, 3, 3.1, 27])(
    "empêche un dépassement au score à la limite d'un écart physique de %s s",
    (gap) => {
      const rows = applyChronologicalRoadFinishEffort({
        results: [
          { riderId: "front", elapsedTimeSeconds: 100, score: 10 },
          { riderId: "rear", elapsedTimeSeconds: 100 + gap, score: 100 },
        ],
        groups: [
          { riderIds: ["rear"], gapToLeaderSeconds: gap },
          { riderIds: ["front"], gapToLeaderSeconds: 0 },
        ].reverse(),
        effortGapSecondsByRiderId: new Map([["front", 40]]),
      });
      expect(rows.map((row) => row.riderId)).toEqual(["front", "rear"]);
      expect(rows.map((row) => row.elapsedTimeSeconds)).toEqual([
        100 + gap,
        100 + gap,
      ]);
      const official = classify(rows);
      expect(official[0].rank).toBe(1);
      expect(official[1].rank).toBe(2);
      expect(official[0].elapsedTimeSeconds).toBeLessThanOrEqual(
        official[1].elapsedTimeSeconds,
      );
    },
  );

  it("préserve une sélection réelle au sein d'un même groupe jusqu'au prochain groupe", () => {
    const rows = applyChronologicalRoadFinishEffort({
      results: [
        { riderId: "strong", elapsedTimeSeconds: 100, score: 100 },
        { riderId: "middle", elapsedTimeSeconds: 100, score: 80 },
        { riderId: "weak", elapsedTimeSeconds: 100, score: 60 },
        { riderId: "rear", elapsedTimeSeconds: 135, score: 110 },
      ],
      groups: [
        { riderIds: ["strong", "middle", "weak"], gapToLeaderSeconds: 0 },
        { riderIds: ["rear"], gapToLeaderSeconds: 35 },
      ],
      effortGapSecondsByRiderId: new Map([
        ["middle", 14],
        ["weak", 40],
      ]),
    });
    expect(rows.map((row) => [row.riderId, row.elapsedTimeSeconds])).toEqual([
      ["strong", 100],
      ["middle", 114],
      ["weak", 135],
      ["rear", 135],
    ]);
  });

  it("conserve les écarts sans limite artificielle quand aucun groupe ne suit", () => {
    const rows = applyChronologicalRoadFinishEffort({
      results: [
        { riderId: "strong", elapsedTimeSeconds: 100, score: 100 },
        { riderId: "weak", elapsedTimeSeconds: 100, score: 60 },
      ],
      groups: [{ riderIds: ["strong", "weak"], gapToLeaderSeconds: 0 }],
      effortGapSecondsByRiderId: new Map([["weak", 69.4]]),
    });
    expect(rows[1].elapsedTimeSeconds).toBe(169.4);
  });

  it("conserve le gain d'une attaque et les dépassements déjà acquis dans une échappée dispersée", () => {
    const rows = applyChronologicalRoadFinishEffort({
      results: [
        { riderId: "attacker", elapsedTimeSeconds: 88, score: 110 },
        { riderId: "escape-tail", elapsedTimeSeconds: 130, score: 80 },
        { riderId: "chaser", elapsedTimeSeconds: 120, score: 90 },
      ],
      groups: [
        { riderIds: ["attacker", "escape-tail"], gapToLeaderSeconds: 0 },
        { riderIds: ["chaser"], gapToLeaderSeconds: 20 },
      ],
      effortGapSecondsByRiderId: new Map([
        ["escape-tail", 6],
        ["chaser", 3],
      ]),
    });
    expect(rows.map((row) => [row.riderId, row.elapsedTimeSeconds])).toEqual([
      ["attacker", 88],
      ["chaser", 123],
      ["escape-tail", 136],
    ]);
  });

  it("ne prolonge pas le temps collectif des attardés pour compenser une pénalité devant", () => {
    const rows = applyChronologicalRoadFinishEffort({
      results: [
        { riderId: "front", elapsedTimeSeconds: 100, score: 20 },
        { riderId: "rear", elapsedTimeSeconds: 110, score: 100 },
        { riderId: "last", elapsedTimeSeconds: 150, score: 80 },
      ],
      groups: [
        { riderIds: ["front"], gapToLeaderSeconds: 0 },
        { riderIds: ["rear"], gapToLeaderSeconds: 10 },
        { riderIds: ["last"], gapToLeaderSeconds: 50 },
      ],
      effortGapSecondsByRiderId: new Map([["front", 100]]),
    });
    expect(rows.map((row) => row.elapsedTimeSeconds)).toEqual([110, 110, 150]);
  });

  it("résout sans cycle les égalités d'un groupe dispersé chevauchant une autre horloge", () => {
    const rows = applyChronologicalRoadFinishEffort({
      results: [
        { riderId: "early-member", elapsedTimeSeconds: 100, score: 10 },
        { riderId: "late-member", elapsedTimeSeconds: 103, score: 100 },
        { riderId: "other-group", elapsedTimeSeconds: 103, score: 50 },
      ],
      groups: [
        { riderIds: ["other-group"], gapToLeaderSeconds: 0 },
        { riderIds: ["early-member", "late-member"], gapToLeaderSeconds: 1 },
      ],
      effortGapSecondsByRiderId: new Map([["early-member", 10]]),
    });
    expect(rows.map((row) => row.riderId)).toEqual([
      "early-member", "other-group", "late-member",
    ]);
    expect(rows.every((row) => row.elapsedTimeSeconds === 103)).toBe(true);
  });

  it("garde le classement au score dans un groupe compact et les temps neutralisés inchangés", () => {
    const input = [
      { riderId: "slow", elapsedTimeSeconds: 100, score: 20 },
      { riderId: "fast", elapsedTimeSeconds: 100, score: 100 },
      { riderId: "rear", elapsedTimeSeconds: 140, score: 120 },
    ];
    const groups = [
      { riderIds: ["slow", "fast"], gapToLeaderSeconds: 0 },
      { riderIds: ["rear"], gapToLeaderSeconds: 40 },
    ];
    const frozenInput = structuredClone(input);
    const frozenGroups = structuredClone(groups);
    expect(applyChronologicalRoadFinishEffort({
      results: input,
      groups,
      effortGapSecondsByRiderId: new Map(),
    })).toEqual([input[1], input[0], input[2]]);
    expect(input).toEqual(frozenInput);
    expect(groups).toEqual(frozenGroups);
  });

  it("préserve chaque ordre intergroupe des horloges physiques sur des cas adverses déterministes", () => {
    let randomState = 20261019;
    const next = () => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 2 ** 32;
    };
    for (let scenario = 0; scenario < 80; scenario += 1) {
      const results = Array.from({ length: 18 }, (_, index) => ({
        riderId: `rider-${index}`,
        elapsedTimeSeconds: 100 + Math.floor(next() * 60),
        score: Math.floor(next() * 100),
      }));
      const groups = Array.from({ length: 6 }, (_, groupIndex) => ({
        riderIds: results.filter((_, index) => index % 6 === groupIndex)
          .map((row) => row.riderId),
        gapToLeaderSeconds: groupIndex,
      }));
      const effortGapSecondsByRiderId = new Map(
        results.map((row) => [row.riderId, Math.floor(next() * 120)]),
      );
      const finished = applyChronologicalRoadFinishEffort({
        results,
        groups,
        effortGapSecondsByRiderId,
      });
      const groupById = new Map(
        groups.flatMap((group, index) => group.riderIds.map((id) => [id, index] as const)),
      );
      const rankById = new Map(finished.map((row, index) => [row.riderId, index]));
      for (const [index, row] of finished.entries()) {
        const before = results.find((candidate) => candidate.riderId === row.riderId)!;
        expect(row.elapsedTimeSeconds).toBeGreaterThanOrEqual(before.elapsedTimeSeconds);
        expect(row.elapsedTimeSeconds).toBeLessThanOrEqual(
          before.elapsedTimeSeconds + effortGapSecondsByRiderId.get(row.riderId)!,
        );
        expect(row.elapsedTimeSeconds).toBeGreaterThanOrEqual(
          finished[index - 1]?.elapsedTimeSeconds ?? 0,
        );
      }
      for (const first of results) {
        for (const second of results) {
          const firstGroup = groupById.get(first.riderId)!;
          const secondGroup = groupById.get(second.riderId)!;
          if (firstGroup === secondGroup) continue;
          const physicalOrder = first.elapsedTimeSeconds - second.elapsedTimeSeconds ||
            firstGroup - secondGroup;
          if (physicalOrder < 0) {
            expect(rankById.get(first.riderId), JSON.stringify({
              scenario,
              first,
              second,
              finished,
            })).toBeLessThan(rankById.get(second.riderId)!);
          }
        }
      }
    }
  });
});
