import Link from "@/components/ui/app-link";

/** No fetch, catalogue import or badge polling in the global header. */
export function CycloStickersShortcut({isEnglish=false}:{isEnglish?:boolean}) {
  const label=isEnglish?"Cyclo-Stickers Album":"Album de Cyclo-Stickers";
  return <Link href="/jeu/album" aria-label={label} title={label} data-cyclo-stickers-shortcut="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D6DFD2]/25 bg-white/5 text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] sm:h-10 sm:w-10">
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M3 3h12.5v10.5L12 17H3V3Zm9 14v-3.5h3.5M6 6h6M6 9h4"/><path d="m7 12 .8 1.5 1.7.2-1.2 1.1.3 1.7-1.6-.8-1.5.8.3-1.7-1.3-1.1 1.7-.2Z" strokeWidth=".8"/></svg>
  </Link>;
}
