"use client";

import { useState } from "react";
import styles from "./season-finale-gala.module.css";

export function SeasonFinaleGalaReplay({ videoId, groupNumber = 1 }: { videoId: string | null; groupNumber?: number }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const headingId = `gala-replay-${groupNumber}`;

  return (
    <section aria-labelledby={headingId} className={styles.replay}>
      <h3 id={headingId} className="text-sm font-semibold text-[#E5E7ED]">Le film de la poule {groupNumber}</h3>
      {videoId ? (
        <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-[#08090B]">
          {isLoaded ? (
            <iframe className="h-full w-full" title={`Grand Gala de fin de saison · Poule ${groupNumber}`} src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          ) : (
            <button type="button" onClick={() => setIsLoaded(true)} className="flex h-full w-full flex-col items-center justify-center gap-3 px-5 text-center text-[#E5E7ED] hover:bg-[#1B1D22]">
              <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-full border border-[#D2B46B] text-xl text-[#D2B46B]">▶</span>
              <span className="font-semibold">Regarder la poule {groupNumber}</span>
              <span className="max-w-lg text-xs leading-5 text-[#A5A9B3]">Le lecteur YouTube externe ne se charge qu’à votre demande.</span>
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 grid aspect-video place-items-center rounded-xl border border-[#393C44] bg-[#08090B] px-5 text-center">
          <p className="max-w-sm text-sm leading-6 text-[#A5A9B3]">Le film de cette poule sera visible ici dès sa mise en ligne. Le classement est déjà disponible.</p>
        </div>
      )}
    </section>
  );
}
