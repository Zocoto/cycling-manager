"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import Link from "@/components/ui/app-link";
import { useGameHeaderIndicators } from "./game-header-indicators-provider";

export function CycloStickersShortcut() {
  const { locale } = useLocale();
  const indicators = useGameHeaderIndicators();
  if (!indicators?.collectorAlbumAvailable) return null;

  return (
    <Link
      href="/jeu/album"
      data-cyclo-stickers-shortcut="true"
      className="group flex min-w-[5.25rem] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#AD8052]/55 bg-[#F5E9D2] px-2 py-2.5 text-[#283943] shadow-[0_12px_30px_rgba(84,57,29,0.12)] transition hover:-translate-y-0.5 hover:border-[#8C5A35] hover:bg-[#FFF4DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C5A35] sm:min-w-52 sm:flex-none sm:flex-row sm:gap-3 sm:p-3.5"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#283943] text-[#F3D49A] sm:h-10 sm:w-10 sm:rounded-xl">
        <CycloStickersAlbumIcon />
      </span>
      <span className="min-w-0 text-center sm:flex-1 sm:text-left">
        <span className="block whitespace-nowrap text-[11px] font-black sm:text-sm">Cyclo-Stickers</span>
        <span className="mt-0.5 block text-[10px] font-bold leading-tight text-[#695643] sm:mt-1 sm:text-xs">
          {locale === "en" ? "Sticker album" : "Album de vignettes"}
        </span>
      </span>
      <span aria-hidden="true" className="hidden text-[#8C5A35] transition-transform group-hover:translate-x-0.5 sm:inline">→</span>
    </Link>
  );
}

export function CycloStickersAlbumIcon() {
  return (
    <svg
      aria-hidden="true"
      data-cyclo-stickers-icon="album"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19.5 17.5V3.5H6.75A2.75 2.75 0 0 0 4 6.25v12A2.75 2.75 0 0 0 6.75 21H20m-13-3.5h12.5M7 3.5v14" />
      <rect x="9.5" y="6" width="7.5" height="9" rx=".75" />
      <circle cx="13.25" cy="9.4" r="1.2" />
      <path d="M10.7 14c.2-1.4 1.25-2 2.55-2s2.35.6 2.55 2" />
    </svg>
  );
}
