import Link from "@/components/ui/app-link";
import { SEASON_FINALE_GALA_NAME, SEASON_FINALE_GALA_ROUTE } from "@/lib/game/season-finale-gala";

const GALA_SHORTCUT_ENDS_AT = Date.parse("2026-10-10T00:00:00+02:00");

export function DashboardGalaShortcut({ now }: { now: number }) {
  if (now >= GALA_SHORTCUT_ENDS_AT) return null;

  return (
    <Link href={SEASON_FINALE_GALA_ROUTE} prefetchOnIntent showPendingIndicator={false} className="mt-5 flex min-h-16 items-center gap-3 rounded-xl border border-[#8F7C50] bg-[#D2B46B] px-4 py-3 text-[#101114] transition hover:bg-[#E2C784] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8F7C50] sm:px-5">
      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#101114]/25">★</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{SEASON_FINALE_GALA_NAME}</span>
        <strong className="mt-0.5 block text-sm font-black">Les résultats sont tombés</strong>
        <span className="mt-0.5 block text-[11px]">Les deux films · Classements · Récompenses</span>
      </span>
      <span aria-hidden="true" className="text-lg">↗</span>
    </Link>
  );
}
