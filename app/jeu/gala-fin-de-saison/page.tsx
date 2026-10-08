import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AppLink from "@/components/ui/app-link";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { PcmGalaStartlistExportPanel } from "@/components/game/pcm-gala-startlist-export-panel";
import { SeasonFinaleGalaPresentation, SeasonFinaleGalaPrizes } from "@/components/game/season-finale-gala-presentation";
import { SeasonFinaleGalaResults } from "@/components/game/season-finale-gala-results";
import { SeasonFinaleGalaRewardsAdmin } from "@/components/game/season-finale-gala-rewards-admin";
import { canAccessPcmExport } from "@/lib/game/pcm-export/access";
import { readGalaYoutubeVideoId, SEASON_FINALE_GALA_EVENT_KEY, SEASON_FINALE_GALA_NAME } from "@/lib/game/season-finale-gala";
import { SEASON_FINALE_GALA_RESULTS_VIDEO_IDS } from "@/lib/game/season-finale-gala-results-data";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getSeasonFinaleGalaPublishedRewards } from "@/services/season-finale-gala-results";
import styles from "@/components/game/season-finale-gala.module.css";

export const metadata: Metadata = {
  title: SEASON_FINALE_GALA_NAME,
  description: "Les résultats du Grand Gala : films des deux poules, classements et récompenses par membre.",
};

export default async function SeasonFinaleGalaPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  const [headerData, rewards] = await Promise.all([
    getGameHeaderData(supabase, user.id), getSeasonFinaleGalaPublishedRewards(supabase).catch((error: unknown) => {
      console.error("Impossible de charger les récompenses du gala :", error);
      return null;
    }),
  ]);
  const videoIds = {
    1: readGalaYoutubeVideoId(process.env.PCM_GALA_REPLAY_YOUTUBE_URL) ?? SEASON_FINALE_GALA_RESULTS_VIDEO_IDS[1],
    2: readGalaYoutubeVideoId(process.env.PCM_GALA_REPLAY_YOUTUBE_URL_GROUP_2) ?? SEASON_FINALE_GALA_RESULTS_VIDEO_IDS[2],
  };

  return (
    <main data-gala-page className={styles.page}>
      <GameHeader simulatorEmail={user.email} displayName={headerData.displayName} sponsor={headerData.teamSponsorVisual} maxWidth="wide" />
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-8 sm:py-9">
        <div className="flex justify-end"><BackToOfficeLink className={styles.backLink} /></div>
        <SeasonFinaleGalaPresentation />
        <SeasonFinaleGalaResults videoIds={videoIds} rewards={rewards} />
        <SeasonFinaleGalaPrizes />
        {canAccessPcmExport(user.email) ? (
          <div className="mt-6 border-t border-[#393C44] pt-5">
            <SeasonFinaleGalaRewardsAdmin />
            <PcmGalaStartlistExportPanel eventKey={SEASON_FINALE_GALA_EVENT_KEY} compact />
            <p className="mt-3 text-xs leading-5 text-[#A5A9B3]">Archive administrative : <AppLink href="/jeu/export-pcm?gala=fin-de-saison" className="font-semibold text-[#D2B46B] underline">base PCM du gala</AppLink> et équipes engagées.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
