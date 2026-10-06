import Link from "@/components/ui/app-link";
import { SEASON_FINALE_GALA_ROUTE } from "@/lib/game/season-finale-gala";

export function SeasonFinaleGalaMenuLink({ isEnglish = false, onClick }: { isEnglish?: boolean; onClick?: () => void }) {
  return <Link href={SEASON_FINALE_GALA_ROUTE} prefetchOnIntent showPendingIndicator={false}
    onClick={onClick} data-mobile-more-destination={SEASON_FINALE_GALA_ROUTE}
    className="flex min-h-14 items-center gap-3 rounded-xl border border-[#8F7C50] bg-[#101114] px-3 py-3 text-[#E5E7ED] transition hover:bg-[#1B1D22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D2B46B] sm:col-span-2">
    <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#D2B46B]/40 text-[#D2B46B]">★</span>
    <span className="min-w-0 flex-1">
      <span className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-[#BFC3CE]">{isEnglish ? "Season finale · PCM video" : "Événement de fin de saison · Vidéo PCM"}</span>
      <span className="mt-1 block text-sm font-black">{isEnglish ? "Season Finale Gala" : "Grand Gala de fin de saison"}</span>
    </span>
    <span aria-hidden="true" className="text-lg text-[#D2B46B]">→</span>
  </Link>;
}
