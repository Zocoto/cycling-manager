import Link from "@/components/ui/app-link";
import { SEASON_FINALE_GALA_ROUTE } from "@/lib/game/season-finale-gala";

export function SeasonFinaleGalaMenuLink({ isEnglish = false, onClick }: { isEnglish?: boolean; onClick?: () => void }) {
  return <Link href={SEASON_FINALE_GALA_ROUTE} prefetchOnIntent showPendingIndicator={false}
    onClick={onClick} data-mobile-more-destination={SEASON_FINALE_GALA_ROUTE}
    className="flex min-h-14 items-center gap-3 rounded-xl border border-[#8F7C50] bg-[#D2B46B] px-3 py-3 text-[#101114] transition hover:bg-[#E2C784] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8F7C50] sm:col-span-2">
    <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#101114]/25">★</span>
    <span className="min-w-0 flex-1">
      <span className="block text-[9px] font-semibold uppercase tracking-[0.15em]">{isEnglish ? "Season finale · PCM video" : "Événement de fin de saison · Vidéo PCM"}</span>
      <span className="mt-1 block text-sm font-black">{isEnglish ? "Season Finale Gala" : "Grand Gala de fin de saison"}</span>
      <strong className="mt-0.5 block text-xs font-black">{isEnglish ? "The results are in" : "Les résultats sont tombés"}</strong>
    </span>
    <span aria-hidden="true" className="text-lg">→</span>
  </Link>;
}
