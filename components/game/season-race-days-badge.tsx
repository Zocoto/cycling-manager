import { RACE_LOAD_FREE_DAYS } from "@/lib/game/rider-race-load";

type SeasonRaceDaysCounts = {
  seasonRaceDays?: number | null;
  projectedSeasonRaceDays?: number | null;
};

export const SEASON_RACE_DAYS_OVERLOAD_WARNING = `Au-delà de ${RACE_LOAD_FREE_DAYS} JDC, chaque jour de course supplémentaire coûte 1 point de moral.`;

export function isSeasonRaceDaysOverloaded({
  seasonRaceDays,
  projectedSeasonRaceDays,
}: SeasonRaceDaysCounts) {
  return (projectedSeasonRaceDays ?? seasonRaceDays ?? 0) > RACE_LOAD_FREE_DAYS;
}

export function SeasonRaceDaysBadge({
  seasonRaceDays,
  projectedSeasonRaceDays,
  tone = "light",
  warnOnOverload = true,
}: SeasonRaceDaysCounts & {
  tone?: "light" | "dark";
  warnOnOverload?: boolean;
}) {
  const displayedDays = projectedSeasonRaceDays ?? seasonRaceDays;
  if (displayedDays == null) return null;

  const overloaded = warnOnOverload && isSeasonRaceDaysOverloaded({
    seasonRaceDays,
    projectedSeasonRaceDays,
  });
  const compactLabel = projectedSeasonRaceDays == null
    ? `${displayedDays} JDC`
    : `${displayedDays} JDC prév.`;
  let detail = `Jours de course disputés cette saison · ${displayedDays}`;
  if (projectedSeasonRaceDays != null) {
    detail = `Jours de course projetés · ${displayedDays}`;
    if (seasonRaceDays != null) {
      const remainingDays = displayedDays - seasonRaceDays;
      detail = `Jours de course projetés · ${displayedDays} (${seasonRaceDays} disputés, ${remainingDays} à venir)`;
    }
  }

  return (
    <span
      title={detail}
      className={`inline-block whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
        overloaded
          ? "border-red-500/40 bg-red-100 text-red-900"
          : tone === "dark"
            ? "border-white/20 bg-white/10 text-[#D6DFD2]"
            : "border-[#60756E]/15 bg-[#F3F6F5] text-[#526A62]"
      }`}
    >
      {overloaded ? <span aria-hidden="true" className="mr-1">⚠</span> : null}
      <span aria-hidden="true">{compactLabel}</span>
      <span className="sr-only">{detail}</span>
      {overloaded ? (
        <span className="sr-only">
          {(seasonRaceDays ?? 0) > RACE_LOAD_FREE_DAYS ? "Calendrier surchargé" : "Surcharge prévue"}
        </span>
      ) : null}
    </span>
  );
}
