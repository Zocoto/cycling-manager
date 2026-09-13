"use client";

import { useMemo, useState } from "react";

import { RiderAvatar } from "@/components/game/rider-avatar";
import Link from "@/components/ui/app-link";
import {
  NATION_RIDER_PRIMARY_RATING_KEYS,
  rankNationRidersByMetric,
  type NationRiderRankingMetric,
  type NationRiderRatings,
} from "@/lib/game/nation-rider-ranking";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";

const RIDERS_PER_PAGE = 5;

const PRIMARY_RANKING_OPTION_BY_KEY = {
  mountain: { label: "Montagne", shortLabel: "MON" },
  hills: { label: "Vallons", shortLabel: "VAL" },
  flat: { label: "Plaine", shortLabel: "PLA" },
  timeTrial: { label: "Contre-la-montre", shortLabel: "CLM" },
  cobbles: { label: "Pavés", shortLabel: "PAV" },
  sprint: { label: "Sprint", shortLabel: "SPR" },
} as const satisfies Record<
  (typeof NATION_RIDER_PRIMARY_RATING_KEYS)[number],
  { label: string; shortLabel: string }
>;

const RANKING_OPTIONS = [
  { value: "overall", label: "Moyenne générale", shortLabel: "MOY" },
  ...NATION_RIDER_PRIMARY_RATING_KEYS.map((value) => ({
    value,
    ...PRIMARY_RANKING_OPTION_BY_KEY[value],
  })),
] as const satisfies ReadonlyArray<{
  value: NationRiderRankingMetric;
  label: string;
  shortLabel: string;
}>;

export type NationRiderRankingItem = {
  id: string;
  firstName: string;
  lastName: string;
  avatarProfileKey: string | null;
  avatarSeed: number | string | null;
  age: number;
  overall: number;
  ratings: NationRiderRatings;
  teamName: string | null;
  jersey: RiderJerseyAppearance;
};

export function NationRiderRanking({
  riders,
}: {
  riders: NationRiderRankingItem[];
}) {
  const [metric, setMetric] =
    useState<NationRiderRankingMetric>("overall");
  const [visibleCount, setVisibleCount] = useState(RIDERS_PER_PAGE);
  const selectedOption =
    RANKING_OPTIONS.find((option) => option.value === metric) ??
    RANKING_OPTIONS[0];
  const rankedRiders = useMemo(
    () => rankNationRidersByMetric(riders, metric),
    [metric, riders],
  );
  const visibleRiders = rankedRiders.slice(0, visibleCount);
  const hasMoreRiders = visibleCount < rankedRiders.length;

  function updateMetric(value: string) {
    const nextMetric = RANKING_OPTIONS.find(
      (option) => option.value === value,
    )?.value;
    if (!nextMetric) return;

    setMetric(nextMetric);
    setVisibleCount(RIDERS_PER_PAGE);
  }

  return (
    <section className="border-t border-[#315B3E]/12 px-6 py-8 sm:px-10 sm:py-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
        Coureurs
      </p>
      <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-[#183F37]">
            Les meilleurs coureurs
          </h2>
          <p className="mt-1 text-xs font-bold text-[#60756E]">
            {selectedOption.label} · saison active · avec ou sans équipe
          </p>
        </div>

        {riders.length > 0 ? (
          <label className="block sm:min-w-60">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#60756E]">
              Classer par statistique
            </span>
            <select
              value={metric}
              onChange={(event) => updateMetric(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-black text-[#183F37] outline-none transition focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/20"
            >
              {RANKING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {visibleRiders.length > 0 ? (
        <>
          <ol id="nation-rider-ranking" className="mt-5 grid gap-3 lg:grid-cols-2">
            {visibleRiders.map((rider, index) => {
              const riderName = `${rider.firstName} ${rider.lastName}`.trim();
              const ratingValue =
                metric === "overall"
                  ? rider.overall
                  : rider.ratings[metric];

              return (
                <li key={rider.id}>
                  <Link
                    href={`/jeu/coureurs/${rider.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-4 transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:shadow-[0_12px_26px_rgba(19,60,46,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
                    aria-label={`Consulter la fiche de ${riderName}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#176951] text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <RiderAvatar
                      profileKey={rider.avatarProfileKey}
                      seed={rider.avatarSeed}
                      riderId={rider.id}
                      age={rider.age}
                      jersey={rider.jersey}
                      label={`Portrait de ${riderName}`}
                      className="h-14 w-14"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-[#183F37]">
                        {riderName}
                      </span>
                      <span className="mt-1 block truncate text-xs font-semibold text-[#60756E]">
                        {rider.age} ans · {rider.teamName ?? "Sans équipe"}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-xl bg-[#DDF3E7] px-3 py-2 text-xs font-black text-[#176951]">
                      {selectedOption.shortLabel} {Math.round(ratingValue)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 flex flex-col items-center gap-2">
            {hasMoreRiders ? (
              <button
                type="button"
                aria-controls="nation-rider-ranking"
                onClick={() =>
                  setVisibleCount((count) => count + RIDERS_PER_PAGE)
                }
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#176951]/20 bg-[#EAF5F3] px-5 text-xs font-black uppercase tracking-[0.1em] text-[#176951] transition hover:border-[#176951]/40 hover:bg-[#DDF3E7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
              >
                Afficher les 5 suivants
              </button>
            ) : null}
            <p className="text-xs font-bold text-[#60756E]" aria-live="polite">
              {visibleRiders.length} sur {rankedRiders.length} coureurs affichés
            </p>
          </div>
        </>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-[#315B3E]/20 px-4 py-8 text-center text-sm text-[#60756E]">
          Aucun coureur actif enregistré pour cette nation.
        </p>
      )}
    </section>
  );
}
