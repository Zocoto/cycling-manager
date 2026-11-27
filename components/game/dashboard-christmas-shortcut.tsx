import Image from "next/image";
import Link from "@/components/ui/app-link";
import { CHRISTMAS_EVENT_HREF, isChristmasEventOpen } from "@/lib/game/christmas-event";

export function DashboardChristmasShortcut({ now = new Date() }: { now?: Date } = {}) {
  if (!isChristmasEventOpen(now)) return null;
  return (
    <Link href={CHRISTMAS_EVENT_HREF} prefetchOnIntent data-dashboard-christmas
      className="relative mt-5 flex min-w-0 items-center justify-between gap-4 overflow-hidden rounded-2xl border border-[#D6B367]/50 bg-[#183B30] px-5 py-4 text-[#FFF5DC] shadow-sm">
      <div className="relative z-10 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#E9C87F]">Le Noël du Peloton · 1er au 31 décembre</p>
        <p className="mt-1 text-sm font-bold sm:text-base">La tournée de Rudolphe, l’Avent et le sapin vous attendent.</p>
        <span className="mt-3 inline-flex rounded-full bg-[#E9C87F] px-4 py-2 text-xs font-black text-[#17392E]">Ouvrir Noël →</span>
      </div>
      <Image src="/jeu/noel/experience/rudolphe-lanterne-rouge.webp" alt="" aria-hidden="true" width={110} height={85}
        className="h-20 w-24 shrink-0 object-contain sm:h-24 sm:w-32" unoptimized />
    </Link>
  );
}
