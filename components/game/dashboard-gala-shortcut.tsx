import Link from "@/components/ui/app-link";
import { SEASON_FINALE_GALA_NAME, SEASON_FINALE_GALA_ROUTE } from "@/lib/game/season-finale-gala";

export function DashboardGalaShortcut() {
  return (
    <Link href={SEASON_FINALE_GALA_ROUTE} prefetchOnIntent showPendingIndicator={false} className="mt-5 flex min-h-16 items-center gap-3 rounded-xl border border-[#8F7C50] bg-[#101114] px-4 py-3 text-[#E5E7ED] transition hover:border-[#D2B46B] hover:bg-[#18191D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D2B46B] sm:px-5">
      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#D2B46B]/40 text-[#D2B46B]">★</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#F0E3C2]">{SEASON_FINALE_GALA_NAME}</span>
        <span className="mt-0.5 block text-[11px] text-[#BFC3CE]">Course hors-circuit · Vidéo PCM · Inscriptions</span>
      </span>
      <span aria-hidden="true" className="text-lg text-[#D2B46B]">↗</span>
    </Link>
  );
}
