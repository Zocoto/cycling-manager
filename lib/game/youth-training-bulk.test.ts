import { describe, expect, it } from "vitest";

import {
  getChangedYouthTrainingSettings,
  indexYouthTrainingSettings,
} from "./youth-training-bulk";

const initialSettings = [
  {
    academyRiderId: "rider-1",
    trainingPriority: "climber" as const,
    trainingMode: "automatic" as const,
  },
  {
    academyRiderId: "rider-2",
    trainingPriority: "sprinter" as const,
    trainingMode: "manual" as const,
  },
];

describe("gestion groupée des entraînements juniors", () => {
  it("ne remonte aucune modification avec les réglages initiaux", () => {
    const indexed = indexYouthTrainingSettings(initialSettings);

    expect(getChangedYouthTrainingSettings(indexed, indexed)).toEqual([]);
  });

  it("regroupe uniquement les jeunes dont un réglage a changé", () => {
    const initial = indexYouthTrainingSettings(initialSettings);
    const current = {
      ...initial,
      "rider-1": {
        trainingPriority: "puncheur" as const,
        trainingMode: "automatic" as const,
      },
      "rider-2": {
        trainingPriority: "sprinter" as const,
        trainingMode: "automatic" as const,
      },
    };

    expect(getChangedYouthTrainingSettings(initial, current)).toEqual([
      {
        academyRiderId: "rider-1",
        trainingPriority: "puncheur",
        trainingMode: "automatic",
      },
      {
        academyRiderId: "rider-2",
        trainingPriority: "sprinter",
        trainingMode: "automatic",
      },
    ]);
  });

  it("considère un nouveau jeune absent de l’état initial comme modifié", () => {
    expect(
      getChangedYouthTrainingSettings({}, {
        "rider-3": {
          trainingPriority: "rouleur",
          trainingMode: "manual",
        },
      }),
    ).toEqual([
      {
        academyRiderId: "rider-3",
        trainingPriority: "rouleur",
        trainingMode: "manual",
      },
    ]);
  });
});
