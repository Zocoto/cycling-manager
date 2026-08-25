import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getTutorialDefinition } from "@/lib/tutorial/catalog";
import { ONBOARDING_TUTORIAL_KEY } from "@/lib/tutorial/onboarding";

const profileFormSource = readFileSync(
  join(process.cwd(), "components/game/sporting-director-profile-form.tsx"),
  "utf8",
);

describe("onboarding profile focus", () => {
  const onboarding = getTutorialDefinition(ONBOARDING_TUTORIAL_KEY);

  it("ne redemande jamais le nom déjà saisi à l’inscription", () => {
    const overview = onboarding?.steps.find(
      (step) => step.key === "profile-overview",
    );
    const avatar = onboarding?.steps.find(
      (step) => step.key === "profile-form",
    );

    expect(onboarding?.version).toBeGreaterThanOrEqual(2);
    expect(overview?.content).toContain("déjà celui choisi lors de l’inscription");
    expect(avatar?.content).toContain("déjà renseigné");
    expect(avatar?.content).not.toContain("Choisissez votre nom");
  });

  it("découpe le profil en trois actions ciblées dans l’ordre visuel", () => {
    const profileSteps = onboarding?.steps.filter((step) =>
      ["profile-form", "profile-nationality", "profile-save"].includes(
        step.key,
      ),
    );

    expect(
      profileSteps?.map((step) => ({
        key: step.key,
        targetId: step.targetId,
        interactive: step.allowTargetInteraction,
      })),
    ).toEqual([
      {
        key: "profile-form",
        targetId: "profile-avatar",
        interactive: true,
      },
      {
        key: "profile-nationality",
        targetId: "profile-nationality",
        interactive: true,
      },
      {
        key: "profile-save",
        targetId: "profile-save",
        interactive: true,
      },
    ]);
  });

  it("expose chaque cible dans le formulaire et avance après validation", () => {
    for (const targetId of [
      "profile-avatar",
      "profile-nationality",
      "profile-save",
    ]) {
      expect(profileFormSource).toContain(`data-tutorial-id="${targetId}"`);
    }

    expect(profileFormSource).toContain(
      'tutorialStepKey !== "profile-save"',
    );
  });
});
