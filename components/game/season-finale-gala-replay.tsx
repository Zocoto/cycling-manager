"use client";

import { useState } from "react";

export function SeasonFinaleGalaReplay({ videoId }: { videoId: string | null }) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <section aria-labelledby="gala-replay" className="mt-8 overflow-hidden rounded-[26px] border border-[#BFD3CC] bg-white p-5 sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">Diffusion vidéo · Édition pilote</p>
      <h2 id="gala-replay" className="mt-1 text-2xl font-black">Le replay de la course</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#557068]">La course sera enregistrée dans PCM, puis publiée ici en vidéo, avec des commentaires ajoutés après la simulation. Cette première édition n’est pas diffusée en direct.</p>
      {videoId ? (
        <div className="mt-5 aspect-video overflow-hidden rounded-2xl bg-[#102F29]">
          {isLoaded ? (
            <iframe className="h-full w-full" title="Replay du Grand Gala de fin de saison" src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          ) : (
            <button type="button" onClick={() => setIsLoaded(true)} className="flex h-full w-full flex-col items-center justify-center gap-3 px-5 text-center text-white hover:bg-[#194737]">
              <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-full border border-[#F1CC78] text-2xl text-[#F1CC78]">▶</span>
              <span className="font-black">Charger et regarder le replay</span>
              <span className="max-w-lg text-xs leading-5 text-[#BCD1C7]">Le lecteur YouTube externe ne se charge qu’à votre demande.</span>
            </button>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-[#B8CFC4] bg-[#F3F8F5] px-5 py-8 text-center">
          <p className="font-black text-[#254D3F]">Vidéo à venir après le gala</p>
          <p className="mt-2 text-sm text-[#688075]">Inscriptions → export de la startlist → simulation PCM → publication du replay.</p>
        </div>
      )}
    </section>
  );
}
