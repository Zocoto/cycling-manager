import "flag-icons/css/flag-icons.min.css";

import type { ReactNode } from "react";
import { connection } from "next/server";

import { RaceSettlementWatcher } from "@/components/game/race-settlement-watcher";
import { TutorialProvider } from "@/components/tutorial/tutorial-provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ONBOARDING_TUTORIAL_KEY,
  shouldAutoStartOnboarding,
} from "@/lib/tutorial/onboarding";
import { getAuthenticatedTutorialOnboardingState } from "@/lib/tutorial/onboarding-state";
import { listAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import type { TutorialProgressRow } from "@/types/tutorial";

type TutorialBootstrap = {
  progress: TutorialProgressRow[];
  autoStartTutorialKeys: string[];
};

async function loadTutorialBootstrap(): Promise<TutorialBootstrap> {
  try {
    const supabase =
      await createSupabaseServerClient();

    const [progress, onboardingState] =
      await Promise.all([
        listAuthenticatedTutorialProgress(
          supabase,
        ),
        getAuthenticatedTutorialOnboardingState(
          supabase,
        ),
      ]);

    const onboardingProgress =
      progress.find(
        (row) =>
          row.tutorial_key ===
          ONBOARDING_TUTORIAL_KEY,
      ) ?? null;

    return {
      progress,
      autoStartTutorialKeys:
        shouldAutoStartOnboarding({
          state: onboardingState,
          progress: onboardingProgress,
        })
          ? [ONBOARDING_TUTORIAL_KEY]
          : [],
    };
  } catch (error) {
    console.error(
      "Impossible de charger le démarrage des didacticiels.",
      error,
    );

    return {
      progress: [],
      autoStartTutorialKeys: [],
    };
  }
}

export default async function GameLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();

  const tutorialBootstrap =
    await loadTutorialBootstrap();

  return (
    <>
      <RaceSettlementWatcher />

      <TutorialProvider
        initialProgress={
          tutorialBootstrap.progress
        }
        autoStartTutorialKeys={
          tutorialBootstrap.autoStartTutorialKeys
        }
      >
        {children}
      </TutorialProvider>
    </>
  );
}