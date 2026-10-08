"use client";

import { useState } from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import Link from "@/components/ui/app-link";

export type CyclogazetteGalaReplay = {
  id: string;
  groupNumber: number;
  youtubeVideoId: string;
  winnerRiderId: string;
  winnerTeamId: string;
  winnerRiderName: string;
  winnerTeamName: string;
};

export function CyclogazetteGalaReplays({
  replays,
  sourceGameYear,
}: {
  replays: CyclogazetteGalaReplay[];
  sourceGameYear: number;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const [loadedVideoIds, setLoadedVideoIds] = useState<Set<string>>(
    () => new Set(),
  );

  if (replays.length === 0) return null;

  function loadVideo(videoId: string) {
    setLoadedVideoIds((current) => new Set(current).add(videoId));
  }

  return (
    <section
      data-gazette-gala-replays="true"
      className="relative overflow-hidden border-b-4 border-double border-[#D5B45B] bg-[#101117] px-5 py-7 text-[#F8F1DC] sm:px-8 sm:py-9"
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#E4CB83,transparent)]" />
      <header className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#D5B45B]">
            {isEnglish ? "Official films · End-of-season gala" : "Films officiels · Gala de fin de saison"}
          </p>
          <h2 className="mt-1 font-serif text-3xl font-black tracking-[-0.035em] sm:text-5xl">
            {isEnglish ? "The winners on film" : "Les vainqueurs en images"}
          </h2>
          <p className="mt-2 max-w-3xl font-serif text-sm italic leading-5 text-[#C9C4B8]">
            {isEnglish
              ? "Every group, its real winner and the complete official race video."
              : "Chaque groupe, son vrai vainqueur et la vidéo officielle intégrale de sa course."}
          </p>
        </div>
        <span className="border border-[#D5B45B]/55 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#E8CF87]">
          {isEnglish ? "Season" : "Saison"} {sourceGameYear}
        </span>
      </header>

      <div className="relative mt-6 grid gap-5 lg:grid-cols-2">
        {replays.map((replay) => {
          const isLoaded = loadedVideoIds.has(replay.youtubeVideoId);
          return (
            <article key={replay.id} className="overflow-hidden border border-[#D5B45B]/35 bg-[#171922] shadow-[0_18px_45px_rgba(0,0,0,.28)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#D5B45B]/25 px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#D5B45B]">
                  {isEnglish ? "Gala group" : "Groupe du gala"} {replay.groupNumber}
                </p>
                <span aria-hidden="true" className="text-lg text-[#E8CF87]">✦</span>
              </div>
              <div className="aspect-video bg-[#08090D]">
                {isLoaded ? (
                  <iframe
                    className="h-full w-full"
                    title={`${isEnglish ? "Gala replay, group" : "Replay du gala, groupe"} ${replay.groupNumber}`}
                    src={`https://www.youtube-nocookie.com/embed/${replay.youtubeVideoId}?autoplay=1`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => loadVideo(replay.youtubeVideoId)}
                    className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center transition hover:bg-[#20232D]"
                  >
                    <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-full border border-[#D5B45B] text-xl text-[#E8CF87]">▶</span>
                    <span className="text-xs font-black uppercase tracking-[0.12em]">
                      {isEnglish ? "Watch the official race film" : "Voir le film officiel de la course"}
                    </span>
                    <span className="max-w-md text-[10px] leading-4 text-[#A9A7A1]">
                      {isEnglish ? "YouTube loads only after your click." : "YouTube ne se charge qu’après votre clic."}
                    </span>
                  </button>
                )}
              </div>
              <div className="px-4 py-4">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#9F9B90]">
                  {isEnglish ? "Winner" : "Vainqueur"}
                </p>
                <Link href={`/jeu/coureurs/${replay.winnerRiderId}`} className="mt-1 block font-serif text-2xl font-black text-[#FFF8E8] hover:underline">
                  {replay.winnerRiderName}
                </Link>
                <Link href={`/jeu/equipes/${replay.winnerTeamId}`} className="mt-1 inline-flex text-[10px] font-bold uppercase tracking-[0.12em] text-[#D5B45B] hover:underline">
                  {replay.winnerTeamName}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
