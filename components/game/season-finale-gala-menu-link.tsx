import Link from "@/components/ui/app-link";
import { SEASON_FINALE_GALA_ROUTE } from "@/lib/game/season-finale-gala";

export function SeasonFinaleGalaMenuLink({ isEnglish = false, onClick }: { isEnglish?: boolean; onClick?: () => void }) {
  return <Link href={SEASON_FINALE_GALA_ROUTE} prefetchOnIntent showPendingIndicator={false}
    onClick={onClick} data-mobile-more-destination={SEASON_FINALE_GALA_ROUTE}
    className="flex min-h-16 items-center gap-3 rounded-xl border border-[#F2C94C]/60 bg-gradient-to-r from-[#F2C94C]/20 to-[#F2C94C]/5 px-3 py-3 text-[#FFFDF4] transition hover:bg-[#F2C94C]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] sm:col-span-2">
    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F2C94C] text-xl text-[#17261E]">★</span>
    <span className="min-w-0 flex-1">
      <span className="block text-[9px] font-black uppercase tracking-[0.15em] text-[#F2C94C]">{isEnglish ? "Season finale · PCM video" : "Événement de fin de saison · Vidéo PCM"}</span>
      <span className="mt-1 block text-sm font-black">{isEnglish ? "Season Finale Gala" : "Grand Gala de fin de saison"}</span>
    </span>
    <span aria-hidden="true" className="text-lg text-[#F2C94C]">→</span>
  </Link>;
}
