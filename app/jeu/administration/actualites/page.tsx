import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import Link from "@/components/ui/app-link";
import { GameHeader } from "@/components/game/game-header";
import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameNewsEditor } from "@/components/game/game-news-editor";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentGameStaffRole } from "@/services/game-staff-access";
import { getGameHeaderData } from "@/services/game-header-data";
import { getGameNewsEditorArticles } from "@/services/game-product-news";
import { saveGameNewsAction } from "./actions";

export const metadata: Metadata = { title: "Gestion des actualités" };
export default async function GameNewsAdministration({ searchParams }: { searchParams: Promise<{ id?: string; nouvelle?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const role = await getCurrentGameStaffRole(supabase);
  if (!role) notFound();
  const [header, articles, query] = await Promise.all([
    getGameHeaderData(supabase, user.id), getGameNewsEditorArticles(supabase),
    searchParams,
  ]);
  const selected = query.id ? articles.find((article) => article.id === query.id) : null;
  if (query.id && !selected) notFound();
  // A distinct navigation resets a saved "new" editor without a full reload.
  const creationKey = query.nouvelle && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(query.nouvelle) ? query.nouvelle : "new";
  const newDraftId = creationKey === "new" ? randomUUID() : creationKey;
  return <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
    <GameHeader simulatorEmail={user.email} displayName={header.displayName} sponsor={header.teamSponsorVisual} maxWidth="wide" />
    <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">Équipe du jeu</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">Gérer les actualités</h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">Préparez vos annonces, gardez un brouillon puis publiez sur l’accueil et dans le bureau des DS. Modifier un brouillon ne change pas la version en ligne.</p></div>
        <BackToOfficeLink />
      </header>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[#315B3E]/15 bg-white p-4">
          <Link href={`/jeu/administration/actualites?nouvelle=${randomUUID()}`} className="block rounded-xl bg-[#173C2E] px-4 py-3 text-center text-sm font-black text-white">+ Nouvelle actualité</Link>
          <h2 className="mt-5 text-xs font-black uppercase tracking-wider text-[#60756E]">Publications et brouillons</h2>
          <ul className="mt-3 max-h-[65vh] space-y-2 overflow-y-auto">{articles.map((article) => <li key={article.id}><Link href={`/jeu/administration/actualites?id=${article.id}`} aria-current={selected?.id === article.id ? "page" : undefined} className={`block rounded-xl border px-3 py-3 text-sm font-bold ${selected?.id === article.id ? "border-[#278B70] bg-[#EAF7EE]" : "border-[#315B3E]/10 hover:bg-[#F4F8F5]"}`}>
            {article.draft.title || "Brouillon sans titre"}<span className="mt-1 block text-[10px] font-semibold text-[#60756E]">{!article.published ? "Brouillon" : article.hasUnpublishedChanges ? "Publiée · modifications en brouillon" : "Publiée"}</span>
          </Link></li>)}</ul>
        </aside>
        <GameNewsEditor key={selected?.id ?? creationKey} initialArticle={selected ?? null} newDraftId={newDraftId} action={saveGameNewsAction} />
      </div>
    </section>
  </main>;
}
