import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HalloweenEvent } from "@/components/halloween/halloween-event";
import { GameHeader } from "@/components/game/game-header";
import { getGameHeaderData } from "@/services/game-header-data";
import type { HalloweenState } from "@/lib/game/halloween-event";
import "@/components/halloween/halloween.css";

export const metadata = { title: "Halloween · Cyclostratège", robots: { index: false, follow: false } };
export default async function HalloweenPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const { onglet = "accueil" } = await searchParams;
  if (onglet === "poursuite") redirect("/jeu/halloween/poursuite");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const [headerData, { data, error }] = await Promise.all([
    getGameHeaderData(supabase, user.id).catch((headerError: unknown) => {
      console.error("Impossible de charger le header Halloween.", headerError);
      return null;
    }),
    supabase.rpc("get_current_halloween_state"),
  ]);
  return <>
    <GameHeader displayName={headerData?.displayName} sponsor={headerData?.teamSponsorVisual} simulatorEmail={user.email} />
    {error || !data ? <section className="mx-auto max-w-3xl p-8"><h1>Halloween se prépare</h1><p>La page est momentanément indisponible. Réessayez dans quelques instants. Aucun essai ni aucune roue n’a été consommé.</p></section> : <HalloweenEvent key={onglet} initial={data as HalloweenState} initialTab={onglet} />}
  </>;
}
