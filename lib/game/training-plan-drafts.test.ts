import { describe, expect, it } from "vitest";

import {
  countTrainingPlansByTrainer,
  getChangedTrainingPlanIds,
  type TrainingPlanDraft,
} from "@/lib/game/training-plan-drafts";

const initialPlans: TrainingPlanDraft[] = [
  {
    riderId: "rider-a",
    intensity: 50,
    domain: "climber",
    trainerContractId: "trainer-a",
  },
  {
    riderId: "rider-b",
    intensity: 40,
    domain: "sprinter",
    trainerContractId: null,
  },
];

describe("training plan drafts", () => {
  it("ne retient que les coureurs dont le programme a réellement changé", () => {
    expect(
      getChangedTrainingPlanIds(initialPlans, [
        initialPlans[0],
        { ...initialPlans[1], intensity: 65 },
      ]),
    ).toEqual(["rider-b"]);
  });

  it("ne conserve plus une ligne lorsque le DS revient à sa valeur initiale", () => {
    const changed = { ...initialPlans[0], domain: "rouleur" as const };
    expect(getChangedTrainingPlanIds(initialPlans, [changed, initialPlans[1]])).toEqual([
      "rider-a",
    ]);
    expect(getChangedTrainingPlanIds(initialPlans, initialPlans)).toEqual([]);
  });

  it("recalcule les quotas d’entraîneurs sur l’ensemble des brouillons", () => {
    expect(
      countTrainingPlansByTrainer([
        initialPlans[0],
        { ...initialPlans[1], trainerContractId: "trainer-a" },
      ]),
    ).toEqual({ "trainer-a": 2 });
  });
});
