import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GameHeader } from "@/components/game/game-header";
import { SeasonFourGalaPreview } from "@/components/game/season-four-gala-preview";
import { canAccessSeasonFourGala } from "@/lib/game/season-four-gala-access";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import styles from "@/components/game/season-four-gala.module.css";

export const metadata: Metadata = {
  title: "Gala de la saison 4 · Aperçu privé",
  robots: { index: false, follow: false },
};

export default async function SeasonFourGalaPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  if (!canAccessSeasonFourGala(user.id)) notFound();
  const header = await getGameHeaderData(supabase, user.id);
  return <main className={styles.page} data-gala-s4-page>
    <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" />
    <SeasonFourGalaPreview />
  </main>;
}
