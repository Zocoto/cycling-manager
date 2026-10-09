import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HalloweenRunner } from "@/components/halloween/halloween-runner";
import type { HalloweenState } from "@/lib/game/halloween-event";
import Link from "next/link";
import "@/components/halloween/halloween-console.css";

export const metadata = { title: "Cycling Hollow · Cyclo Stratège", robots: { index: false, follow: false } };

export default async function HalloweenPursuitPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const { data, error } = await supabase.rpc("get_current_halloween_state");
  if (error || !data) return <main className="halloween-console-unavailable"><h1>Poursuite momentanément indisponible</h1><p>Aucun essai n’a été consommé.</p><Link href="/jeu/halloween">← Retour à Halloween</Link></main>;
  const state = data as HalloweenState;
  if (!state.joined) redirect("/jeu/halloween");
  return <HalloweenRunner state={state} />;
}
