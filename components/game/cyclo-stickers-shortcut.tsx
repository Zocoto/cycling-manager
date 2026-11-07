"use client";

import Image from "next/image";
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
      className="group flex min-w-[5.25rem] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#41636C] bg-[#294650] px-2 py-2.5 text-[#FFF5DB] shadow-[0_12px_30px_rgba(41,70,80,0.18)] transition hover:-translate-y-0.5 hover:border-[#577F88] hover:bg-[#345862] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#577F88] sm:min-w-52 sm:flex-none sm:flex-row sm:gap-3 sm:p-3.5"
    >
      <CycloStickersStickerIcon className="w-[27px] -rotate-6 transition-transform group-hover:rotate-0 sm:w-9" />
      <span className="min-w-0 text-center sm:flex-1 sm:text-left">
        <span className="block whitespace-nowrap text-[11px] font-black sm:text-sm">Cyclo-Stickers</span>
        <span className="mt-0.5 block text-[10px] font-bold leading-tight text-[#D8E8E9] sm:mt-1 sm:text-xs">
          {locale === "en" ? "Sticker album" : "Album de vignettes"}
        </span>
      </span>
      <span aria-hidden="true" className="hidden text-[#F0CF8A] transition-transform group-hover:translate-x-0.5 sm:inline">→</span>
    </Link>
  );
}

export function CycloStickersStickerIcon({ className = "w-[25px]" }: { className?: string }) {
  return (
    <Image
      src="/images/collector-albums/vashadze-sticker.webp"
      width={120}
      height={160}
      alt=""
      unoptimized
      data-cyclo-stickers-icon="vashadze-sticker"
      className={`h-auto shrink-0 drop-shadow-sm ${className}`}
    />
  );
}
