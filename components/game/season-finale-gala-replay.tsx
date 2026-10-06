"use client";

import { useState } from "react";
import styles from "./season-finale-gala.module.css";

export function SeasonFinaleGalaReplay({ videoId }: { videoId: string | null }) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <section aria-labelledby="gala-replay" className={styles.replay}>
      <h2 id="gala-replay" className="text-lg font-semibold text-[#E5E7ED]">Le replay de la course</h2>
      {videoId ? (
        <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-[#08090B]">
          {isLoaded ? (
            <iframe className="h-full w-full" title="Replay du Grand Gala de fin de saison" src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          ) : (
            <button type="button" onClick={() => setIsLoaded(true)} className="flex h-full w-full flex-col items-center justify-center gap-3 px-5 text-center text-[#E5E7ED] hover:bg-[#1B1D22]">
              <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-full border border-[#D2B46B] text-xl text-[#D2B46B]">▶</span>
              <span className="font-semibold">Charger et regarder le replay</span>
              <span className="max-w-lg text-xs leading-5 text-[#A5A9B3]">Le lecteur YouTube externe ne se charge qu’à votre demande.</span>
            </button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-[#A5A9B3]">Vidéo à venir après le gala, avec des commentaires ajoutés après la simulation PCM.</p>
      )}
    </section>
  );
}
