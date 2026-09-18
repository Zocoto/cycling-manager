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

export function RiderFavoriteRacesCard({
  races,
}: {
  races: RiderFavoriteRace[];
}) {
  return (
    <section
      aria-labelledby="rider-favorite-races-title"
      className="min-w-0 rounded-2xl border border-[#315B3E]/12 bg-white p-4 shadow-[0_12px_34px_rgba(19,60,46,0.07)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="rider-favorite-races-title"
          className="text-lg font-black text-[#183F37]"
        >
          Courses préférées
        </h2>
        <span
          className="rounded-full border border-[#42B99A]/30 bg-[#E5F4ED] px-2.5 py-1 text-[11px] font-black text-[#176951]"
          title="Bonus de 2 points sur chaque statistique, à chaque étape d’un tour."
        >
          +2 toutes stats
        </span>
      </div>

      {races.length > 0 ? (
        <ol className="mt-3 grid gap-2">
          {races.slice(0, 3).map((race, index) => (
            <li
              key={race.raceId}
              className="min-w-0 rounded-xl border border-[#315B3E]/10 bg-[#F6FAF8] p-2.5"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-[#183F37] text-[10px] font-black text-white"
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
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 rounded-xl bg-[#F6FAF8] px-3 py-3 text-xs font-semibold text-[#60756E]">
          Aucune course préférée pour le moment.
        </p>
      )}
    </section>
  );
}
