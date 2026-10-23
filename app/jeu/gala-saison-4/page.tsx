import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GameHeader } from "@/components/game/game-header";
import { SeasonFourGalaPreview } from "@/components/game/season-four-gala-preview";
import { canExportSeasonFourGala } from "@/lib/game/season-four-gala-access";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentSeasonFourGalaContext } from "@/services/season-four-gala-registration";
import { GALA_EVENTS } from "@/lib/game/season-four-gala";
import type { SeasonFourGalaContext } from "@/lib/game/season-four-gala-registration";
import styles from "@/components/game/season-four-gala.module.css";

export const metadata: Metadata = {
  title: "Le Grand Gala · Saison 4 · Inscriptions",
  robots: { index: false, follow: false },
};

export default async function SeasonFourGalaPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const [header,context] = await Promise.all([
    getGameHeaderData(supabase,user.id),
    getCurrentSeasonFourGalaContext(supabase).catch((error:unknown):SeasonFourGalaContext=>{
      console.error('Inscriptions du gala indisponibles.',error);
      return {isOpen:false,team:null,program:null,selections:{},riders:[],counts:{"world-tour":0,continental:0},unavailable:true};
    }),
  ]);
  return <main className={styles.page} data-gala-s4-page>
    <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" />
    <SeasonFourGalaPreview context={context} canExport={canExportSeasonFourGala(user.id)} exportStatus={{counts:Object.fromEntries(GALA_EVENTS.map(event=>[event.key,context.courseCounts?.[event.key] ?? 0])),unavailable:context.unavailable}}/>
  </main>;
}
