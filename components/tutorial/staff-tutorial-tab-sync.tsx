"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useTutorial } from "@/components/tutorial/tutorial-provider";
import {
  STAFF_TUTORIAL_KEY,
  STAFF_TUTORIAL_MARKET_STEP_KEYS,
  STAFF_TUTORIAL_TEAM_STEP_KEY,
} from "@/lib/tutorial/staff";

export function StaffTutorialTabSync() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeTutorial } = useTutorial();
  const currentStep =
    activeTutorial?.definition.steps[activeTutorial.currentStepIndex];
  const currentTab = searchParams.get("onglet") ?? "marche";

  useEffect(() => {
    if (activeTutorial?.definition.key !== STAFF_TUTORIAL_KEY || !currentStep) {
      return;
    }

    if (
      currentStep.key === STAFF_TUTORIAL_TEAM_STEP_KEY &&
      currentTab !== "equipe"
    ) {
      router.replace("/jeu/staff?onglet=equipe", { scroll: false });
      return;
    }

    if (
      STAFF_TUTORIAL_MARKET_STEP_KEYS.some(
        (stepKey) => stepKey === currentStep.key,
      ) &&
      currentTab !== "marche"
    ) {
      router.replace("/jeu/staff?onglet=marche", { scroll: false });
    }
  }, [activeTutorial?.definition.key, currentStep, currentTab, router]);

  return null;
}
