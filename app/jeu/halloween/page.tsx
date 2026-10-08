import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HalloweenEvent } from "@/components/halloween/halloween-event";
import type { HalloweenState } from "@/lib/game/halloween-event";
import "@/components/halloween/halloween.css";

export const metadata = { title: "Halloween · Cyclostratège", robots: { index: false, follow: false } };
export default async function HalloweenPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const { onglet = "accueil" } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const { data, error } = await supabase.rpc("get_current_halloween_state");
  if (error || !data) return <section className="rounded-3xl bg-white p-8"><h1>Halloween se prépare</h1><p>Les jeux restent fermés pendant les vérifications. Aucun essai ni aucune roue n’a été consommé.</p></section>;
  return <HalloweenEvent key={onglet} initial={data as HalloweenState} initialTab={onglet} />;
}
