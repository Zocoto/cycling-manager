import "flag-icons/css/flag-icons.min.css";

import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";

import { GameRouteLoading } from "@/components/game/game-route-loading";
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

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

async function synchronizeGameEntryState(
  supabase: SupabaseServerClient,
): Promise<void> {
  const [dailyReputation, academyTrainingSettlement] = await Promise.all([
    supabase.rpc("settle_current_team_staff_daily_reputation"),
    supabase.rpc("settle_due_staff_academy_trainings"),
  ]);

  if (dailyReputation.error) {
    console.error(
      "Impossible d’actualiser la réputation quotidienne du staff.",
      dailyReputation.error,
    );
  }

  if (academyTrainingSettlement.error) {
    console.error(
      "Impossible d’actualiser les stages de l’Académie.",
      academyTrainingSettlement.error,
    );
  }
}

async function loadTutorialBootstrap(): Promise<TutorialBootstrap> {
  try {
    const supabase = await createSupabaseServerClient();

    const [progress, onboardingState] = await Promise.all([
      listAuthenticatedTutorialProgress(supabase),
      getAuthenticatedTutorialOnboardingState(supabase),
      synchronizeGameEntryState(supabase),
    ]);

    const onboardingProgress =
      progress.find(
        (row) => row.tutorial_key === ONBOARDING_TUTORIAL_KEY,
      ) ?? null;

    return {
      progress,
      autoStartTutorialKeys: shouldAutoStartOnboarding({
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

async function GameRuntime({ children }: { children: ReactNode }) {
  await connection();
  const tutorialBootstrap = await loadTutorialBootstrap();

  return (
    <TutorialProvider
      initialProgress={tutorialBootstrap.progress}
      autoStartTutorialKeys={tutorialBootstrap.autoStartTutorialKeys}
    >
      {children}
    </TutorialProvider>
  );
}

export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RaceSettlementWatcher />

      <Suspense fallback={<GameRouteLoading />}>
        <GameRuntime>{children}</GameRuntime>
      </Suspense>
    </>
  );
}
