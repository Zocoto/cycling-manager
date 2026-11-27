import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "@/components/ui/app-link";
import { GameHeader } from "@/components/game/game-header";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getRequestLocale } from "@/lib/i18n/server";
import { getChristmasEventPhase } from "@/lib/game/christmas-event";
import { ChristmasExperienceFrame } from "./christmas-experience-frame";

export const metadata: Metadata = {
  title: "Le Noël du Peloton",
  robots: { index: false, follow: false },
};

export default async function ChristmasPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const [header, locale] = await Promise.all([
    getGameHeaderData(supabase, user.id).catch(() => null),
    getRequestLocale(),
  ]);
  const phase = getChristmasEventPhase();
  const english = locale === "en";
  return <>
    <GameHeader displayName={header?.displayName} sponsor={header?.teamSponsorVisual} simulatorEmail={user.email} />
    {phase === "upcoming" ? (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-20" data-christmas-upcoming>
        <section className="rounded-3xl border border-[#D4B66F]/40 bg-[#FFF8E9] p-7 text-[#17392E] shadow-lg sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#863A43]">{english ? "Christmas in the peloton" : "Le Noël du Peloton"}</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">{english ? "Rudolphe is getting ready" : "Rudolphe prépare sa tournée"}</h1>
          <p className="mt-4 text-base leading-7">{english
            ? "The delivery ride, Advent calendar, Bell shop and community tree open on 1 December at midnight, Paris time."
            : "La tournée, le calendrier de l’Avent, la boutique des Grelots et le sapin collectif ouvrent le 1er décembre à minuit, heure de Paris."}</p>
          <Link href="/jeu" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#17392E] px-5 py-3 text-sm font-black text-[#FFF8E9]">{english ? "Back to the DS office" : "Retour au bureau du DS"} →</Link>
        </section>
      </main>
    ) : (
      <main data-christmas-public-event>
        {phase === "closed" ? <p className="bg-[#FFF8E9] px-4 py-4 text-center text-sm font-semibold text-[#17392E]" role="status">{english
          ? "The Christmas rides are over. Your prizes remain in your inventory."
          : "Les tournées de Noël sont terminées. Vos récompenses restent dans votre inventaire."}</p> : null}
        <ChristmasExperienceFrame locale={locale} />
      </main>
    )}
  </>;
}
