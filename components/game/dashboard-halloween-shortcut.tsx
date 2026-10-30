import Link from "next/link";
import { getDashboardHalloweenEdition } from "@/services/dashboard-halloween";
import { HalloweenHeadlessRider } from "@/components/halloween/halloween-night-ride";
export async function DashboardHalloweenShortcut({ compact = false }: { compact?: boolean } = {}) {
  const edition = await getDashboardHalloweenEdition();
  if (!edition) return null;
  return (
    <Link
      href="/jeu/halloween"
      prefetch={false}
      data-dashboard-halloween
      className={`${compact ? "h-full min-w-0 px-3 py-3 sm:px-5 sm:py-4" : "mt-5 px-5 py-4"} relative isolate flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border border-[#CF985F]/50 bg-[#302833] text-[#F5E5C9] shadow-sm`}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 flex w-24 items-center opacity-20 md:right-48 md:opacity-70">
        <span className="h-[82px] w-full"><HalloweenHeadlessRider decorative /></span>
      </span>
      <div className="relative z-10">
        <span className={`${compact ? "text-[9px] sm:text-xs" : "text-xs"} font-bold uppercase tracking-widest text-[#E9AC6F]`}>Halloween · événement spécial</span>
        <p className={`${compact ? "text-xs sm:text-base" : ""} mt-1 font-semibold`}>Le peloton de minuit vous attend.</p>
      </div>
      <span className={`${compact ? "px-3 text-[10px] sm:px-4 sm:text-sm" : "px-4 text-sm"} relative z-10 rounded-full bg-[#D97B3E] py-2 font-bold text-[#241D26]`}>Jeux & boutique →</span>
    </Link>
  );
}
