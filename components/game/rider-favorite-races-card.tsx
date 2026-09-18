import type { ReactNode } from "react";

import Link from "@/components/ui/app-link";
import type { RiderFavoriteRace } from "@/services/rider-favorite-races";

const PROFILE_LABELS: Record<string, string> = {
  flat: "Plat",
  sprint: "Sprint",
  hilly: "Vallons",
  mountain: "Montagne",
  cobbles: "Pavés",
  time_trial: "Contre-la-montre",
  mixed: "Mixte",
};

const CATEGORY_LABELS: Record<string, string> = {
  elite: "Élite",
  world: "Mondiale",
  continental: "Continentale",
  national: "Nationale",
};

const GEOGRAPHY_LABELS: Record<
  RiderFavoriteRace["geographyCode"],
  string | null
> = {
  home: "Son pays",
  neighbor: "Pays voisin",
  continent: "Même continent",
  elsewhere: null,
};

export function RiderFavoriteRacesCard({
  races,
}: {
  races: RiderFavoriteRace[];
}) {
  return (
    <section
      aria-labelledby="rider-favorite-races-title"
      className="min-w-0 rounded-2xl border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_34px_rgba(19,60,46,0.07)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
            Affinités de course
          </p>
          <h2
            id="rider-favorite-races-title"
            className="mt-2 text-xl font-black text-[#183F37]"
          >
            Courses préférées
          </h2>
        </div>
        <span className="rounded-full border border-[#42B99A]/30 bg-[#E5F4ED] px-3 py-1.5 text-xs font-black text-[#176951]">
          +2 toutes stats
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
        Bonus actif sur ces courses uniquement, à chaque étape d’un tour.
      </p>

      {races.length > 0 ? (
        <ol className="mt-4 grid gap-2.5">
          {races.slice(0, 3).map((race, index) => {
            const geography = GEOGRAPHY_LABELS[race.geographyCode];
            return (
              <li
                key={race.raceId}
                className="min-w-0 rounded-xl border border-[#315B3E]/10 bg-[#F6FAF8] p-3"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-[#183F37] text-[11px] font-black text-white"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/jeu/courses/${race.slug}`}
                      className="break-words text-sm font-black text-[#183F37] underline-offset-2 hover:text-[#176951] hover:underline"
                    >
                      {race.name}
                    </Link>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#60756E]">
                      {race.countryName} ·{" "}
                      {CATEGORY_LABELS[race.categoryCode] ?? race.categoryCode} ·{" "}
                      {PROFILE_LABELS[race.dominantProfile] ?? race.dominantProfile}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5 pl-9">
                  {geography ? <ReasonPill>{geography}</ReasonPill> : null}
                  {race.historySeasons >= 2 ? (
                    <ReasonPill>{race.historySeasons} saisons disputées</ReasonPill>
                  ) : null}
                  {race.historyVictories > 0 ? (
                    <ReasonPill>
                      {race.historyVictories} victoire
                      {race.historyVictories > 1 ? "s" : ""}
                    </ReasonPill>
                  ) : race.historyPodiums > 0 ? (
                    <ReasonPill>
                      {race.historyPodiums} podium
                      {race.historyPodiums > 1 ? "s" : ""}
                    </ReasonPill>
                  ) : null}
                  {!geography &&
                  race.historySeasons < 2 &&
                  race.historyPodiums === 0 ? (
                    <ReasonPill>Profil adapté</ReasonPill>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 rounded-xl bg-[#F6FAF8] px-3 py-4 text-xs font-semibold leading-5 text-[#60756E]">
          Ses affinités seront établies lors de la prochaine actualisation du calendrier.
        </p>
      )}
    </section>
  );
}

function ReasonPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[#E5F4ED] px-2 py-1 text-[10px] font-extrabold text-[#176951]">
      {children}
    </span>
  );
}
