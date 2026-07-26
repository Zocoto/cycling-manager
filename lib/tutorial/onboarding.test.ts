import { describe, expect, it } from "vitest";

import {
  getTutorialRequirementError,
  shouldAutoStartOnboarding,
} from "@/lib/tutorial/onboarding";
import type { TutorialProgressRow } from "@/types/tutorial";

function createProgress(
  status: TutorialProgressRow["status"],
): TutorialProgressRow {
  return {
    id: "progress-id",
    sporting_director_id: "director-id",
    tutorial_key: "onboarding-core",
    tutorial_type: "onboarding",
    tutorial_version: 1,
    status,
    current_step_key: null,
    current_route: null,
    started_at: null,
    completed_at: null,
    skipped_at: null,
    metadata: {},
    created_at: "2026-07-24T00:00:00.000Z",
    updated_at: "2026-07-24T00:00:00.000Z",
  };
}

describe("shouldAutoStartOnboarding", () => {
  it("propose le parcours à une carrière incomplète", () => {
    expect(
      shouldAutoStartOnboarding({
        state: {
          profileComplete: false,
          teamCreated: false,
          riderCount: 0,
        },
        progress: null,
      }),
    ).toBe(true);
  });

  it("ne force pas le parcours sur une ancienne carrière déjà complète", () => {
    expect(
      shouldAutoStartOnboarding({
        state: {
          profileComplete: true,
          teamCreated: true,
          riderCount: 7,
        },
        progress: null,
      }),
    ).toBe(false);
  });

  it("reprend automatiquement une progression interrompue", () => {
    expect(
      shouldAutoStartOnboarding({
        state: {
          profileComplete: true,
          teamCreated: true,
          riderCount: 7,
        },
        progress: createProgress("in_progress"),
      }),
    ).toBe(true);
  });

  it("ne relance pas un parcours terminé ou ignoré", () => {
    const state = {
      profileComplete: false,
      teamCreated: false,
      riderCount: 0,
    };

    expect(
      shouldAutoStartOnboarding({
        state,
        progress: createProgress("completed"),
      }),
    ).toBe(false);

    expect(
      shouldAutoStartOnboarding({
        state,
        progress: createProgress("skipped"),
      }),
    ).toBe(false);
  });
});

describe("getTutorialRequirementError", () => {
  it("bloque l’étape de fondation tant que le profil est incomplet", () => {
    expect(
      getTutorialRequirementError({
        requirement: "profile_complete",
        state: {
          profileComplete: false,
          teamCreated: false,
          riderCount: 0,
        },
      }),
    ).toContain("Finalisez");
  });

  it("bloque l’effectif tant que l’équipe n’existe pas", () => {
    expect(
      getTutorialRequirementError({
        requirement: "team_created",
        state: {
          profileComplete: true,
          teamCreated: false,
          riderCount: 0,
        },
      }),
    ).toContain("Fondez");
  });

  it("autorise une étape lorsque sa condition est remplie", () => {
    expect(
      getTutorialRequirementError({
        requirement: "team_created",
        state: {
          profileComplete: true,
          teamCreated: true,
          riderCount: 7,
        },
      }),
    ).toBeNull();
  });
});
