import Link from "@/components/ui/app-link";
import { isDraftBannerVisible } from "@/lib/game/season-draft";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSeasonDraftView } from "@/services/season-draft";
import type { DashboardFastSummary } from "@/services/dashboard-fast-summary";

export async function DashboardDraftShortcut({ summaryPromise }: { summaryPromise: Promise<DashboardFastSummary | null> }) {
  const summary = await summaryPromise;
  // No draft query on ordinary days; reuse the dashboard's existing day lookup.
  if (!summary || ![1, 28].includes(summary.seasonDayNumber)) return null;
  let view;
  try { view = await getSeasonDraftView(await createSupabaseServerClient(), false); }
  catch (error) { console.error("Annonce de draft indisponible :", error); return null; }
  if (!isDraftBannerVisible(view)) return null;
  const myTurn = view.mine?.status === "pending" && view.edition?.status === "running" && view.mine.position === view.edition.currentPosition;
  return <Link href="/jeu/draft" prefetchOnIntent showPendingIndicator={false} className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#CBAE69]/60 bg-[#172D2B] px-5 py-4 text-[#F7F4E9]">
      <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#CBAE69]/50 text-xl text-[#F2CF75]">↗</span>
      <span className="min-w-0 flex-1"><span className="block text-xs font-black uppercase tracking-widest text-[#F2CF75]">Draft · Saison {view.edition!.gameYear}</span>
        <strong className="mt-1 block text-sm">{myTurn ? "C’est votre tour : choisissez votre coureur !" : view.edition?.status === "completed" ? "Découvrez les recrutements de la draft" : "Un nouveau départ pour votre équipe"}</strong>
        <span className="mt-1 block text-xs text-[#C0D2C9]">{view.mine ? `Votre position : ${view.mine.position} · ` : ""}Listes à J1 dès 8 h · Sélections à 14 h</span>
      </span><span className="text-sm font-bold text-[#F2CF75]">Ouvrir la draft →</span>
    </Link>;
}
