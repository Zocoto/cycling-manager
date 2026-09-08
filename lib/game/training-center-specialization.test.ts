import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getSkippedLowFormRecoveryGain,
  getTrainingCenterSpecializationProgressBonusPercentage,
} from "./training-center-specialization";

describe("training center specializations", () => {
  it("cumule les deux bonus d’Individualisation sur une note secondaire sous 65", () => {
    expect(
      getTrainingCenterSpecializationProgressBonusPercentage({
        specialization: { code: "individualization", infrastructureLevel: 5 },
        ratingKey: "acceleration",
        currentRating: 60,
      }),
    ).toBe(10);
    expect(
      getTrainingCenterSpecializationProgressBonusPercentage({
        specialization: { code: "individualization", infrastructureLevel: 5 },
        ratingKey: "mountain",
        currentRating: 60,
      }),
    ).toBe(5);
  });

  it("respecte les seuils stricts et la puissance du bâtiment", () => {
    expect(
      getTrainingCenterSpecializationProgressBonusPercentage({
        specialization: { code: "individualization", infrastructureLevel: 3 },
        ratingKey: "acceleration",
        currentRating: 64,
      }),
    ).toBe(6);
    expect(
      getTrainingCenterSpecializationProgressBonusPercentage({
        specialization: { code: "individualization", infrastructureLevel: 5 },
        ratingKey: "acceleration",
        currentRating: 65,
      }),
    ).toBe(5);
    expect(
      getTrainingCenterSpecializationProgressBonusPercentage({
        specialization: { code: "individualization", infrastructureLevel: 5 },
        ratingKey: "acceleration",
        currentRating: 70,
      }),
    ).toBe(0);
  });

  it("cumule Haute performance avec l’affinité de nationalité du staff", () => {
    expect(
      getTrainingCenterSpecializationProgressBonusPercentage({
        specialization: { code: "elite_performance", infrastructureLevel: 5 },
        ratingKey: "mountain",
        currentRating: 79,
        trainerCountryMatch: true,
      }),
    ).toBe(7);
    expect(
      getTrainingCenterSpecializationProgressBonusPercentage({
        specialization: { code: "elite_performance", infrastructureLevel: 5 },
        ratingKey: "mountain",
        currentRating: 83,
        trainerCountryMatch: true,
      }),
    ).toBe(5);
  });

  it("porte le repos sous le seuil de forme de 2 à 3 points à pleine puissance", () => {
    expect(
      getSkippedLowFormRecoveryGain({
        specialization: { code: "durability", infrastructureLevel: 3 },
      }),
    ).toBe(2.6);
    expect(
      getSkippedLowFormRecoveryGain({
        specialization: { code: "durability", infrastructureLevel: 4 },
      }),
    ).toBe(2.8);
    expect(
      getSkippedLowFormRecoveryGain({
        specialization: { code: "durability", infrastructureLevel: 5 },
      }),
    ).toBe(3);
  });

  it("câble les deux effets dans le règlement quotidien côté base", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260908140000_activate_training_center_specializations.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "public.get_team_training_center_specialization_progress_multiplier",
    );
    expect(migration).toContain(
      "public.get_team_skipped_training_form_gain(v_session.team_id)",
    );
    expect(migration).toContain("v_stat.current_rating");
    expect(migration).toContain("v_trainer_country_match");
  });
});
