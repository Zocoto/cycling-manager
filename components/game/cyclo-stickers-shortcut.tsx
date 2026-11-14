"use client";

import Image from "next/image";
import { useLocale } from "@/components/i18n/locale-provider";
import Link from "@/components/ui/app-link";
import { useGameHeaderIndicators } from "./game-header-indicators-provider";

export function CycloStickersShortcut() {
  const { locale } = useLocale();
  const indicators = useGameHeaderIndicators();
  if (!indicators?.collectorAlbumAvailable) return null;
  const hasBoosters = indicators.collectorAlbumHasUnopenedBoosters;
  const pendingTrades = indicators.collectorAlbumPendingTradeCount;
  const receivedOffersLabel = locale === "en" ? "Received trade offers" : "Propositions d’échange reçues";

  return (
    <div className="relative flex min-w-[5.25rem] flex-1 sm:min-w-52 sm:flex-none">
      <Link
        href={hasBoosters ? "/jeu/album?onglet=boosters" : "/jeu/album"}
        data-cyclo-stickers-shortcut="true"
        className="group flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#41636C] bg-[#294650] px-2 py-2.5 text-[#FFF5DB] shadow-[0_12px_30px_rgba(41,70,80,0.18)] transition hover:-translate-y-0.5 hover:border-[#577F88] hover:bg-[#345862] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#577F88] sm:flex-row sm:gap-3 sm:p-3.5"
      >
        <CycloStickersStickerIcon className="w-[27px] -rotate-6 transition-transform group-hover:rotate-0 sm:w-9" />
        <span className="min-w-0 text-center sm:flex-1 sm:text-left">
          <span className="block whitespace-nowrap text-[11px] font-black sm:text-sm">Cyclo-Stickers</span>
          <span className="mt-0.5 block text-[10px] font-bold leading-tight text-[#D8E8E9] sm:mt-1 sm:text-xs">
            {hasBoosters ? <CycloStickersBoosterBadge isEnglish={locale === "en"} /> : locale === "en" ? "Sticker album" : "Album de vignettes"}
          </span>
        </span>
        <span aria-hidden="true" className="hidden text-[#F0CF8A] transition-transform group-hover:translate-x-0.5 sm:inline">→</span>
      </Link>
      {pendingTrades > 0 ? (
        <Link
          href="/jeu/album?onglet=echanges&vue=recues"
          data-cyclo-stickers-trade-badge="true"
          aria-label={`${receivedOffersLabel} (${pendingTrades})`}
          title={receivedOffersLabel}
          showPendingIndicator={false}
          className="absolute right-0.5 top-0.5 grid min-h-6 min-w-6 place-items-center rounded-full border border-[#FFB7AE] bg-[#B4232D] px-1 text-center text-[10px] font-black leading-none text-white shadow-sm hover:bg-[#921E27] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB7AE] sm:right-1 sm:top-1"
        >
          {pendingTrades}
        </Link>
      ) : null}
    </div>
  );
}

export function CycloStickersBoosterBadge({ isEnglish }: { isEnglish: boolean }) {
  return (
    <span
      data-cyclo-stickers-booster-badge="true"
      className="inline-block rounded-md bg-[#F4D48C] px-1.5 py-0.5 text-[10px] font-black leading-tight text-[#493414]"
    >
      {isEnglish ? "Packs to open" : "Boosters à ouvrir"}
    </span>
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
