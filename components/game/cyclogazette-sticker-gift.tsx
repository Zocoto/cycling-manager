"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { claimCyclogazetteBoosterGiftAction } from "@/app/jeu/gazette/actions";
import Link from "@/components/ui/app-link";
import { AlbumBoosterArtwork } from "./collector-album-artwork";

const actionClassName = "inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-[#294650] px-4 py-2 text-center text-sm font-black leading-snug text-[#FFF5DB] transition hover:bg-[#345862] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#345862] disabled:cursor-wait disabled:opacity-70 sm:w-auto";

export function CyclogazetteStickerGift({
  editionId,
  sourceSeason,
  initiallyClaimed,
}: {
  editionId: string;
  sourceSeason: number;
  initiallyClaimed: boolean;
}) {
  const [claimState, claimAction, pending] = useActionState(claimCyclogazetteBoosterGiftAction, "idle");
  const titleId = useId();
  const albumLink = useRef<HTMLAnchorElement>(null);
  const claimed = initiallyClaimed || claimState === "claimed";

  useEffect(() => {
    if (claimState === "claimed") albumLink.current?.focus({ preventScroll: true });
  }, [claimState]);

  return (
    <section
      aria-labelledby={titleId}
      data-cyclogazette-sticker-gift={claimed ? "claimed" : "available"}
      className="border-b border-[var(--gazette-rule)]/45 px-4 py-5 sm:px-8 sm:py-6"
    >
      <div className="relative mx-auto grid max-w-4xl grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border border-[#BFA36B] bg-[#FAEFD0] px-3 py-4 text-[#293F48] shadow-[2px_3px_0_#71562D24] sm:gap-x-7 sm:px-7 sm:py-5">
        <div aria-hidden="true" className="relative w-[4.25rem] justify-self-center sm:row-span-2 sm:w-[6.25rem]">
          <AlbumBoosterArtwork sourceSeason={sourceSeason} gamesEdition={sourceSeason === 4} compact />
          <span className="pointer-events-none absolute -top-1.5 left-1/2 h-4 w-11 -translate-x-1/2 rotate-6 border border-[#B9985D]/30 bg-[#E8D49E]/85 shadow-sm sm:w-14" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8C4336]">Numéro spécial · Cadeau lecteur</p>
          <h2 id={titleId} className="mt-1 text-pretty font-serif text-xl font-black leading-tight sm:text-3xl">
            Une pochette offerte avec ce numéro
          </h2>
          <p className="mt-1 text-sm leading-snug text-[#45565A]">
            Deux vignettes Cyclo-Stickers à découvrir dans ton album.
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1 sm:col-start-2">
          {claimed ? (
            <Link ref={albumLink} href="/jeu/album?onglet=boosters" prefetch={false} className={actionClassName}>
              Voir mes sachets <span aria-hidden="true" className="ml-2">→</span>
            </Link>
          ) : (
            <form action={claimAction}>
              <input type="hidden" name="editionId" value={editionId} />
              <button type="submit" disabled={pending} className={actionClassName}>
                {pending ? "Ajout à ton album…" : "Récupérer ma pochette"}
              </button>
            </form>
          )}
          <p role="status" className="mt-2 text-sm font-semibold text-[#43574C] empty:hidden">
            {claimed ? "Pochette récupérée." : null}
          </p>
          {claimState === "error" && !claimed ? (
            <p role="alert" className="mt-2 text-sm font-semibold text-[#8C4336]">
              La pochette n’a pas pu être récupérée. Réessaie dans un instant.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
