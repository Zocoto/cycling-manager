import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import Link from "@/components/ui/app-link";
import { GameHeader } from "@/components/game/game-header";
import { GameNewsPublication } from "@/components/game/game-news-publication";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getGameHeaderData } from "@/services/game-header-data";
import { getPublishedGameNewsById } from "@/services/game-product-news";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function ConnectedGameNewsDetail({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [header, article, locale] = await Promise.all([getGameHeaderData(supabase, user.id), getPublishedGameNewsById(id), getRequestLocale()]);
  if (!article) notFound();
  return <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]"><GameHeader displayName={header.displayName} sponsor={header.teamSponsorVisual} simulatorEmail={user.email} />
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12"><nav className="mb-6 flex flex-wrap gap-5 text-sm font-bold text-[#176951]" aria-label="Navigation des actualités"><Link href="/jeu/nouveautes">← Toutes les actualités</Link><Link href="/jeu">Bureau du DS</Link><Link href="/jeu/guide">Guide du jeu</Link></nav><GameNewsPublication article={article} connected locale={locale} /></section>
  </main>;
}
