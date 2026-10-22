import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GameHeader } from "@/components/game/game-header";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameNewsCards } from "@/components/game/game-news-publication";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getGameHeaderData } from "@/services/game-header-data";
import { getPublishedGameNews } from "@/services/game-product-news";
import { getRequestLocale } from "@/lib/i18n/server";
import Link from "@/components/ui/app-link";
import { GameReleaseHistory } from "@/components/game/game-release-history";

export const metadata: Metadata = { title: "Actualités du jeu" };
export default async function ConnectedGameNews() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const [header, news, locale] = await Promise.all([getGameHeaderData(supabase, user.id), getPublishedGameNews(), getRequestLocale()]);
  return <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
    <GameHeader displayName={header.displayName} sponsor={header.teamSponsorVisual} simulatorEmail={user.email} />
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">Cyclo Stratège</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">Actualités du jeu</h1><p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">Les dernières nouveautés, sans quitter votre partie.</p></div><BackToOfficeLink /></header>
      <GameNewsCards articles={news} connected locale={locale} />
      {news.length === 0 ? <p className="rounded-2xl bg-white p-6 text-sm text-[#60756E]">Aucune actualité publiée pour le moment.</p> : null}
      <Link href="/jeu/guide" className="mt-7 inline-flex rounded-lg border border-[#315B3E]/20 px-4 py-3 text-sm font-bold text-[#176951]">Consulter le guide du jeu →</Link>
      <GameReleaseHistory />
    </section>
  </main>;
}
