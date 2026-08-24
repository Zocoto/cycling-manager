"use client";

import { useEffect } from "react";

export default function GameError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("game_route_error", {
      digest: error.digest ?? null,
      message: error.message,
    });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[65vh] w-full max-w-3xl items-center px-4 py-12 sm:px-6">
      <section className="w-full rounded-[2rem] border border-[#d8e3dd] bg-white p-6 text-[#0b3029] shadow-[0_24px_70px_rgba(11,48,41,0.12)] sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2d806c]">
          Incident temporaire
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
          Cet écran n’a pas pu se charger
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-[#5e746d]">
          Votre partie est conservée. Vous pouvez relancer uniquement cet écran
          ou revenir au bureau pendant que le service se rétablit.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={unstable_retry}
            className="min-h-12 rounded-2xl bg-[#0b3029] px-6 py-3 font-black text-white transition hover:bg-[#174b40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b3029]"
          >
            Réessayer
          </button>
          <a
            href="/jeu"
            className="flex min-h-12 items-center justify-center rounded-2xl border border-[#c8d7d0] px-6 py-3 font-black text-[#174b40] transition hover:bg-[#f1f6f3]"
          >
            Retour au bureau
          </a>
        </div>
      </section>
    </main>
  );
}
