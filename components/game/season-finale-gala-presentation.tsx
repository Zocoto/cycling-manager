import Image from "next/image";

import { RaceStageProfile } from "@/components/game/race-stage-profile";
import { SEASON_FINALE_GALA_NAME, SEASON_FINALE_GALA_PRIZES, SEASON_FINALE_GALA_RACE } from "@/lib/game/season-finale-gala";

export function SeasonFinaleGalaPresentation() {
  return (
      <header className="mt-4 border-b border-[#D2B46B]/30 pb-6 sm:pb-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#D2B46B]">Fin de saison · Édition spéciale PCM26</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#F0E3C2] sm:text-4xl">{SEASON_FINALE_GALA_NAME}</h1>
            <p className="mt-3 text-lg font-bold text-[#D2B46B]">Les résultats sont tombés.</p>
            <p className="mt-2 text-sm leading-6 text-[#C1C4CC]">Revivez les deux poules, retrouvez leurs classements et découvrez les lots remportés par chaque équipe récompensée.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <a href="#resultats-gala" className="rounded-lg bg-[#D2B46B] px-4 py-2.5 font-bold text-[#101114] hover:bg-[#E2C784]">Films et classements</a>
            <a href="#gains-gala" className="rounded-lg border border-[#8F7C50] px-4 py-2.5 font-semibold text-[#F0E3C2] hover:bg-[#1B1D22]">Les récompenses</a>
          </div>
        </div>
        <div className="mt-5 space-y-1.5 text-xs leading-5 text-[#A5A9B3]">
          <p>Gala hors-circuit · Identités de la saison prochaine · Aucun effet sur la forme, le moral, les blessures ou le matériel. Ni argent, ni points de classement.</p>
        </div>
      </header>
  );
}

export function SeasonFinaleGalaPrizes() {
  return (
    <details className="mt-6 rounded-xl border border-[#393C44] bg-[#111215] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#E5E7ED]">Le parcours et les lots du gala</summary>
      <div className="mt-4 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <section aria-labelledby="gala-route">
        <h2 id="gala-route" className="text-sm font-semibold text-[#E5E7ED]">205 km vallonnés · Arrivée en côte</h2>
        <div className="mt-3 overflow-hidden rounded-lg bg-[#1B1D22] px-2 py-3"><RaceStageProfile segments={SEASON_FINALE_GALA_RACE.segments} tone="gala" compact /></div>
      </section>
      <section id="lots-gala" aria-labelledby="gala-prizes" className="scroll-mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="gala-prizes" className="text-sm font-semibold text-[#E5E7ED]">Les lots du top 5 de chaque groupe</h2>
          <p className="text-[11px] text-[#A5A9B3]">Même dotation dans chaque groupe</p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {SEASON_FINALE_GALA_PRIZES.map((prize) => (
            <article key={prize.key} className={`flex items-center gap-3 rounded-xl border bg-[#111215] p-2.5 ${prize.rank === 1 ? "border-[#D2B46B]/50" : "border-[#393C44]"}`}>
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[#1B1D22]">
                <Image src={prize.image} alt="" fill sizes="36px" className="object-contain p-1" />
              </div>
              <div className="min-w-0">
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${prize.rank <= 2 ? "text-[#D2B46B]" : "text-[#BFC3CE]"}`}>{prize.rank}{prize.rank === 1 ? "er" : "e"} · {prize.rarity}</p>
                <h3 className="mt-1 text-xs font-semibold leading-5 text-[#E5E7ED]">{prize.name}</h3>
                <p className="mt-1 text-[11px] font-medium text-[#D2B46B]">{prize.summary}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-[#A5A9B3]">Chaque place récompense l’équipe du coureur. Bonus actifs une fois l’objet équipé, sans modifier les notes natives.</p>
      </section>
      </div>
    </details>
  );
}
