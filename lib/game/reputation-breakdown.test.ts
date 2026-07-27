import { describe, expect, it } from "vitest";

import { buildSportingDirectorReputationBreakdown } from "./reputation-breakdown";

describe("buildSportingDirectorReputationBreakdown", () => {
  it("regroupe les gains par origine et conserve les derniers \u00e9v\u00e9nements", () => {
    const breakdown = buildSportingDirectorReputationBreakdown(
      [
        {
          source_type: "race_result",
          reputation_points: 2,
          description: "Victoire sur la Classique des Alpes",
          created_at: "2026-07-27T09:00:00.000Z",
        },
        {
          source_type: "stage_result",
          reputation_points: "1.5",
          description: "Victoire d\u2019\u00e9tape sur le Tour du Littoral",
          created_at: "2026-07-26T09:00:00.000Z",
        },
        {
          source_type: "game_objective",
          reputation_points: 1,
          description: "Objectif accompli : Premiers pas",
          created_at: "2026-07-25T09:00:00.000Z",
        },
      ],
      4.5,
    );

    expect(breakdown.items).toEqual([
      {
        key: "race-results",
        label: "R\u00e9sultats en course",
        points: 3.5,
      },
      {
        key: "career-objectives",
        label: "Objectifs de carri\u00e8re",
        points: 1,
      },
    ]);
    expect(breakdown.totalGains).toBe(4.5);
    expect(breakdown.recentGains).toHaveLength(3);
  });

  it("explique l\u2019\u00e9cart entre les gains enregistr\u00e9s et la valeur actuelle", () => {
    const breakdown = buildSportingDirectorReputationBreakdown(
      [
        {
          source_type: "sponsor_objective",
          reputation_points: 5,
          description: "Objectif sponsor rempli",
          created_at: "2026-07-27T09:00:00.000Z",
        },
      ],
      3,
    );

    expect(breakdown.items).toContainEqual({
      key: "adjustments",
      label: "P\u00e9nalit\u00e9s et ajustements",
      points: -2,
    });
    expect(
      breakdown.items.reduce((total, item) => total + item.points, 0),
    ).toBe(breakdown.currentPoints);
  });
});
