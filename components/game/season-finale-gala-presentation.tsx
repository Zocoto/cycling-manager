import Image from "next/image";

import { SEASON_FINALE_GALA_NAME, SEASON_FINALE_GALA_PRIZES, SEASON_FINALE_GALA_TEAMS_PER_GROUP, SEASON_FINALE_GALA_DEADLINE, SEASON_FINALE_GALA_DEADLINE_LABEL } from "@/lib/game/season-finale-gala";

export function SeasonFinaleGalaPresentation() {
  return (
    <>
      <header className="mt-4 border-b border-[#D2B46B]/30 pb-6 sm:pb-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#D2B46B]">Fin de saison · Édition spéciale PCM26</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#F0E3C2] sm:text-4xl">{SEASON_FINALE_GALA_NAME}</h1>
            <p className="mt-3 text-sm leading-6 text-[#C1C4CC]">Une course hors-circuit pour fêter la saison, sans impact sportif, avec des lots à la clé.</p>
            <p className="mt-2 text-xs font-medium text-[#A5A9B3]">205 km vallonnés · 6 à 8 coureurs par équipe · Inscriptions sans limite d’équipes</p>
            <p className="mt-3 text-sm font-semibold text-[#D2B46B]">Clôture des inscriptions : <time dateTime={SEASON_FINALE_GALA_DEADLINE}>{SEASON_FINALE_GALA_DEADLINE_LABEL}</time>.</p>
          </div>
          <a href="#inscriptions-gala" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#D2B46B] px-5 py-3 text-sm font-semibold text-[#101114] transition hover:bg-[#E2C784] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E2C784] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090B]">Inscrire mon équipe <span aria-hidden="true" className="ml-3">↗</span></a>
        </div>
        <div className="mt-5 space-y-1.5 text-xs leading-5 text-[#A5A9B3]">
          <p>Aucun effet sur la forme, le moral, la fatigue, les blessures, la préparation ou l’usure du matériel. Ni argent, ni points de classement.</p>
          <p>Au-delà de {SEASON_FINALE_GALA_TEAMS_PER_GROUP} équipes : groupes de taille comparable, une simulation et un top 5 récompensé par groupe, sans finale commune. Une équipe spectateur accompagne chaque groupe.</p>
          <p>En avant-première : les équipes participent sous leur identité de la saison prochaine, avec leurs sponsors déjà confirmés. L’identité actuelle dans le jeu reste inchangée.</p>
          <p>Enregistrement envisagé vendredi 9 octobre après-midi. Vidéo publiée ensuite en différé pour cette édition test. Pas de live ; des améliorations suivront.</p>
        </div>
      </header>

      <section id="lots-gala" aria-labelledby="gala-prizes" className="mt-6 scroll-mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="gala-prizes" className="text-lg font-semibold text-[#E5E7ED]">Les lots du top 5 de chaque groupe</h2>
          <p className="text-[11px] text-[#A5A9B3]">Même dotation dans chaque groupe</p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {SEASON_FINALE_GALA_PRIZES.map((prize) => (
            <article key={prize.key} className={`flex items-center gap-3 rounded-xl border bg-[#111215] p-3 xl:flex-col xl:items-start ${prize.rank === 1 ? "border-[#D2B46B]/50" : "border-[#393C44]"}`}>
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#1B1D22] xl:h-16 xl:w-full">
                <Image src={prize.image} alt="" fill sizes="(min-width: 1280px) 190px, 56px" className="object-contain p-1.5" />
              </div>
              <div className="min-w-0">
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${prize.rank <= 2 ? "text-[#D2B46B]" : "text-[#BFC3CE]"}`}>{prize.rank}{prize.rank === 1 ? "er" : "e"} · {prize.rarity}</p>
                <h3 className="mt-1 text-xs font-semibold leading-5 text-[#E5E7ED]">{prize.name}</h3>
                <p className="mt-1 text-[11px] font-medium text-[#D2B46B]">{prize.summary}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-[#A5A9B3]">Lots remis à l’équipe du coureur classé après validation des résultats. Bonus actifs une fois équipés, sans modifier les notes natives. Visuels de présentation issus du matériel existant.</p>
        <p className="text-[10px] leading-5 text-[#9297A3]">VAL : vallons · DES : descente · RES : résistance · ACC : accélération · END : endurance · SPR : sprint.</p>
      </section>
    </>
  );
}
