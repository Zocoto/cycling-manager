"use client";

import {
  useEffect,
  useRef,
} from "react";

import { useTutorial } from "@/components/tutorial/tutorial-provider";

export function TutorialRouteResume({
  tutorialKey,
  currentStepKey,
}: {
  tutorialKey: string;
  currentStepKey: string;
}) {
  const attemptedSignatureRef =
    useRef<string | null>(null);

  const {
    activeTutorial,
    isPending,
    startTutorial,
  } = useTutorial();

  useEffect(() => {
    const signature =
      `${tutorialKey}:${currentStepKey}`;

    const activeStep =
      activeTutorial?.definition.steps[
        activeTutorial.currentStepIndex
      ];

    if (
      isPending ||
      attemptedSignatureRef.current ===
        signature ||
      (activeTutorial?.definition.key ===
        tutorialKey &&
        activeStep?.key === currentStepKey)
    ) {
      return;
    }

    attemptedSignatureRef.current =
      signature;

    void startTutorial({
      tutorialKey,
      launchSource: "resume",
      restartFromBeginning: false,
    });
  }, [
    activeTutorial,
    currentStepKey,
    isPending,
    startTutorial,
    tutorialKey,
  ]);

  return null;
}
