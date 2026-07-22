import { describe, expect, it } from "vitest";

import {
  normalizeGameObjective,
  selectDashboardObjectives,
  type GameObjective,
  type GameObjectiveRow,
} from "./objectives";

function objective(
  key: string,
  overrides: Partial<GameObjective> = {}
): GameObjective {
  return {
    key,
    type: "secondary",
    group: "test",
    title: key,
    description: key,
    currentValue: 0,
    targetValue: 10,
    progressPercent: 0,
    reward: {
      cash: 0,
      experience: 10,
      reputation: 0,
      itemName: null,
      itemKind: null,
    },
    displayOrder: 100,
    completed: false,
    claimedAt: null,
    ...overrides,
  };
}

describe("normalizeGameObjective", () => {
  it("normalise les nombres Postgres et borne la progression à 100 %", () => {
    const row: GameObjectiveRow = {
      objective_key: "victory_1",
      objective_type: "secondary",
      objective_group: "victories",
      title: "Le goût de la victoire",
      description: "Gagner.",
      current_value: "3",
      target_value: "1",
      reward_cash: "5000.00",
      reward_experience: 20,
      reward_reputation: "1.50",
      reward_item_name: null,
      reward_item_kind: null,
      display_order: 100,
      claimed_at: null,
      is_completed: true,
    };

    expect(normalizeGameObjective(row)).toMatchObject({
      currentValue: 3,
      targetValue: 1,
      progressPercent: 100,
      reward: { cash: 5000, experience: 20, reputation: 1.5 },
    });
  });
});

describe("selectDashboardObjectives", () => {
  it("met les récompenses disponibles avant les objectifs primaires puis les plus avancés", () => {
    const selected = selectDashboardObjectives([
      objective("secondary-progress", { progressPercent: 90 }),
      objective("primary-progress", {
        type: "primary",
        progressPercent: 20,
      }),
      objective("secondary-ready", {
        completed: true,
        progressPercent: 100,
      }),
      objective("primary-ready", {
        type: "primary",
        completed: true,
        progressPercent: 100,
      }),
      objective("already-claimed", {
        completed: true,
        claimedAt: "2026-07-22T10:00:00.000Z",
      }),
    ]);

    expect(selected.map((entry) => entry.key)).toEqual([
      "primary-ready",
      "secondary-ready",
      "primary-progress",
    ]);
  });
});
