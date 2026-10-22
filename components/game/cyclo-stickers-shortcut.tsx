import Link from "@/components/ui/app-link";

/** No fetch, catalogue import or badge polling in the global header. */
export function CycloStickersShortcut({isEnglish=false}:{isEnglish?:boolean}) {
  const label=isEnglish?"Cyclo-Stickers Album":"Album de Cyclo-Stickers";
  return <Link href="/jeu/album" aria-label={label} title={label} data-cyclo-stickers-shortcut="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D6DFD2]/25 bg-white/5 text-[#D6DFD2] transition hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] sm:h-10 sm:w-10">
    <svg aria-hidden="true" data-cyclo-stickers-icon="portrait-sticker" viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round">
      <rect x="3" y="1" width="14" height="18" rx=".6"/>
      <path d="M5 14V3h10v11H5Z" opacity=".45" strokeWidth=".65"/>
      <path d="M5.7 13.8v-1q1.1-2.2 4.3-2.2t4.3 2.2v1" fill="currentColor" fillOpacity=".35"/>
      <path d="M7.5 6.5v1.4c0 3.6 5 3.6 5 0V6.5"/>
      <path d="M6.8 6.3c0-4.1 6.4-4.1 6.4 0H6.8Zm2-2.3-.3 2.2m2.7-2.2.3 2.2"/>
      <path d="m8.4 11.1 1.6 1.5 1.6-1.5M6 16h8m-8 1.4h4"/>
    </svg>
  </Link>;
}
