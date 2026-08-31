import "flag-icons/css/flag-icons.min.css";
import "./mobile.css";

import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { after, connection } from "next/server";

import { GameHeaderIndicatorsProvider } from "@/components/game/game-header-indicators-provider";
import { GamePresenceHeartbeat } from "@/components/game/game-presence-heartbeat";
import { GameRouteLoading } from "@/components/game/game-route-loading";
import {
  TutorialProvider,
  type TutorialProviderBootstrap,
} from "@/components/tutorial/tutorial-provider";
import { TutorialCenterLauncher } from "@/components/tutorial/tutorial-center-launcher";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ONBOARDING_TUTORIAL_KEY,
  shouldAutoStartOnboarding,
} from "@/lib/tutorial/onboarding";
import { getAuthenticatedTutorialOnboardingState } from "@/lib/tutorial/onboarding-state";
import { listAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

async function synchronizeGameEntryState(
  supabase: SupabaseServerClient,
): Promise<void> {
  const [dailyReputation, attendance] = await Promise.all([
    supabase.rpc("settle_current_team_staff_daily_reputation"),
    supabase.rpc("record_current_sporting_director_attendance"),
  ]);

  if (dailyReputation.error) {
    console.error(
      "Impossible d’actualiser la réputation quotidienne du staff.",
      dailyReputation.error,
    );
  }

  if (attendance.error) {
    console.error(
      "Impossible d’enregistrer la présence quotidienne du Directeur Sportif.",
      attendance.error,
    );
  }
}

async function loadTutorialBootstrap(): Promise<TutorialProviderBootstrap> {
  try {
    const supabase = await createSupabaseServerClient();

    after(() => synchronizeGameEntryState(supabase));

    const [progress, onboardingState] = await Promise.all([
      listAuthenticatedTutorialProgress(supabase),
      getAuthenticatedTutorialOnboardingState(supabase),
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
  const tutorialBootstrapPromise = loadTutorialBootstrap();

  return (
    <TutorialProvider bootstrapPromise={tutorialBootstrapPromise}>
      <GameHeaderIndicatorsProvider>
        <GamePresenceHeartbeat />
        <div className="game-shell">
          {children}
          <TutorialCenterLauncher />
        </div>
      </GameHeaderIndicatorsProvider>
    </TutorialProvider>
  );
}

export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<GameRouteLoading />}>
        <GameRuntime>{children}</GameRuntime>
      </Suspense>
    </>
  );
}
