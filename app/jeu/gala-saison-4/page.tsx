import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GameHeader } from "@/components/game/game-header";
import { SeasonFourGalaExports } from "@/components/game/season-four-gala-exports";
import { SeasonFourGalaResults } from "@/components/game/season-four-gala-results";
import { canExportSeasonFourGala } from "@/lib/game/season-four-gala-access";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getSeasonFourGalaLiveParticipants, getSeasonFourGalaPublishedResults } from "@/services/season-four-gala-results";
import { getSeasonFourGalaExportStatus } from "@/services/season-four-gala-startlists";
import styles from "@/components/game/season-four-gala.module.css";

export const metadata: Metadata = {
  title: "Le Grand Gala · Saison 4 · Résultats",
  robots: { index: false, follow: false },
};

export default async function SeasonFourGalaPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const canExport = canExportSeasonFourGala(user.id);
  const [header, results, liveParticipants, exportStatus] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getSeasonFourGalaPublishedResults().catch(() => {
      console.error("gala_s4_results_read_failed");
      return null;
    }),
    getSeasonFourGalaLiveParticipants().catch(() => {
      console.error("gala_s4_live_participants_read_failed");
      return null;
    }),
    canExport ? getSeasonFourGalaExportStatus().catch(() => ({ counts: {}, unavailable: true })) : null,
  ]);

  return (
    <main className={styles.page} data-gala-s4-page>
      <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" />
      <div className={styles.shell}>
        <SeasonFourGalaResults results={results} liveParticipants={liveParticipants} />
        {exportStatus ? <SeasonFourGalaExports status={exportStatus} /> : null}
      </div>
    </main>
  );
}
