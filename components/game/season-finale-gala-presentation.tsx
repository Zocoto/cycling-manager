import Image from "next/image";

import {
  SEASON_FINALE_GALA_NAME,
  SEASON_FINALE_GALA_PRIZES,
  SEASON_FINALE_GALA_PRIZES_CONFIRMED,
} from "@/lib/game/season-finale-gala";

export function SeasonFinaleGalaPresentation() {
  return (
    <>
      <header className="relative mt-6 overflow-hidden rounded-[28px] border border-[#D6B767] bg-[#102F29] px-5 py-8 text-white shadow-xl sm:px-9 sm:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full bg-[#E9C36A]/10" />
        <p className="relative text-xs font-black uppercase tracking-[0.2em] text-[#F1CC78]">Événement spécial · Simulation PCM26</p>
        <h1 className="relative mt-3 max-w-3xl text-3xl font-black tracking-[-0.04em] sm:text-5xl">{SEASON_FINALE_GALA_NAME}</h1>
        <p className="relative mt-4 max-w-3xl text-base font-medium leading-7 text-[#D5E3DD]">
          Un dernier rendez-vous pour les équipes : sept coureurs, un parcours vallonné de 205 km et une course simulée dans Pro Cycling Manager.
        </p>
        <div className="relative mt-5 flex flex-wrap gap-2">
          {["Un seul profil · Vallons", "7 coureurs par équipe", "Vidéo en différé · Pas de live"].map((label) => (
            <span key={label} className="rounded-full border border-[#E9C36A]/35 bg-[#E9C36A]/10 px-3 py-2 text-xs font-bold text-[#F8E3B2]">{label}</span>
          ))}
        </div>
        <p className="relative mt-5 max-w-3xl text-sm leading-6 text-[#BBD1C7]">
          Ce premier gala sert à tester la diffusion des courses en vidéo. Le replay sera ajouté ici après la simulation ; des améliorations sont prévues pour les prochains rendez-vous. La date et la clôture des inscriptions seront annoncées ultérieurement.
        </p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <a href="#inscriptions-gala" className="inline-flex min-h-12 items-center rounded-xl bg-[#F1CC78] px-5 py-3 text-sm font-black text-[#193C31] hover:bg-[#FFE0A1]">Inscrire mon équipe</a>
          <a href="#lots-gala" className="inline-flex min-h-12 items-center rounded-xl border border-[#BDD0C5]/40 px-5 py-3 text-sm font-black text-white hover:bg-white/10">Découvrir les lots</a>
        </div>
      </header>

      <section aria-labelledby="gala-rules" className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#BFD9CE] bg-white p-5">
          <h2 id="gala-rules" className="text-lg font-black text-[#123D34]">Un gala hors compétition</h2>
          <p className="mt-2 text-sm leading-6 text-[#557068]">Aucun effet sur la forme, le moral, la fatigue, les blessures ou la préparation des coureurs. Aucun matériel usé. La simulation PCM est indépendante des courses du jeu et utilise les notes natives des coureurs.</p>
        </div>
        <div className="rounded-2xl border border-[#E0CEA1] bg-[#FFF8E7] p-5">
          <h2 className="text-lg font-black text-[#725523]">Les gains, en toute transparence</h2>
          <p className="mt-2 text-sm leading-6 text-[#725F3B]">Ni argent, ni points de classement, ni gains habituels de course. Seuls les lots spéciaux du top 5 sont prévus, remis à l’équipe du coureur classé. Leurs bonus de matériel ne seront actifs qu’une fois l’objet équipé, sans changer les notes natives.</p>
        </div>
      </section>

      <section id="lots-gala" aria-labelledby="gala-prizes" className="mt-8 scroll-mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#94702A]">Une récompense par place</p>
            <h2 id="gala-prizes" className="mt-1 text-2xl font-black">Les lots du top 5 des coureurs</h2>
          </div>
          {!SEASON_FINALE_GALA_PRIZES_CONFIRMED ? <span className="rounded-full bg-[#FFF0CC] px-3 py-2 text-xs font-black text-[#876019]">Dotation proposée · À confirmer</span> : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {SEASON_FINALE_GALA_PRIZES.map((prize) => (
            <article key={prize.key} className="flex flex-col overflow-hidden rounded-2xl border border-[#D8D2BC] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#173D32] text-sm font-black text-[#F1CC78]">{prize.rank}{prize.rank === 1 ? "er" : "e"}</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#94702A]">{prize.rarity}</span>
              </div>
              <div className="relative my-3 h-28 rounded-xl bg-[#F5F7F4]">
                <Image src={prize.image} alt="" fill sizes="(min-width: 1280px) 200px, (min-width: 640px) 45vw, 90vw" className="object-contain p-2" />
              </div>
              <h3 className="text-base font-black text-[#163B32]">{prize.name}</h3>
              <p className="mt-auto pt-3 text-sm font-black text-[#197456]">{prize.summary}</p>
            </article>
          ))}
        </div>
        <p className="mt-3 text-xs font-medium leading-5 text-[#657C73]">VAL : vallons · DES : descente · RES : résistance · ACC : accélération · END : endurance · SPR : sprint. Visuels de présentation issus du matériel existant. Aucune distribution de lots avant validation de la dotation et du classement final.</p>
      </section>
    </>
  );
}
