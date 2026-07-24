import "flag-icons/css/flag-icons.min.css";

import type { ReactNode } from "react";
import { connection } from "next/server";

import { RaceSettlementWatcher } from "@/components/game/race-settlement-watcher";
import { TutorialProvider } from "@/components/tutorial/tutorial-provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import type { TutorialProgressRow } from "@/types/tutorial";

async function loadInitialTutorialProgress(): Promise<
  TutorialProgressRow[]
> {
  try {
    const supabase =
      await createSupabaseServerClient();

    return await listAuthenticatedTutorialProgress(
      supabase,
    );
  } catch (error) {
    console.error(
      "Impossible de charger la progression des didacticiels.",
      error,
    );

    return [];
  }
}

export default async function GameLayout({
  children,
}: {
  children: ReactNode;
}) {
  /*
   * L’espace de jeu dépend de la session du joueur.
   * On attend donc explicitement une requête réelle avant
   * de lire les cookies Supabase.
   */
  await connection();

  const tutorialProgress =
    await loadInitialTutorialProgress();

  return (
    <>
      <RaceSettlementWatcher />

      <TutorialProvider
        initialProgress={tutorialProgress}
      >
        {children}
      </TutorialProvider>
    </>
  );
}