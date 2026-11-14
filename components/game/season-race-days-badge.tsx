import {
  ETAPOVORE_RACE_LOAD_BONUS_LABEL,
  RACE_LOAD_FREE_DAYS,
  RACE_LOAD_WARNING_DAYS,
} from "@/lib/game/rider-race-load";

type SeasonRaceDaysCounts = {
  seasonRaceDays?: number | null;
  projectedSeasonRaceDays?: number | null;
  hasEtapovore?: boolean;
};

export const SEASON_RACE_DAYS_OVERLOAD_WARNING = `Au-delà de ${RACE_LOAD_FREE_DAYS} JDC, le malus est de 1 point de moral par jour supplémentaire pour les coureurs sans le talent Étapovore.`;

export function isSeasonRaceDaysOverloaded({
  seasonRaceDays,
  projectedSeasonRaceDays,
  hasEtapovore,
}: SeasonRaceDaysCounts) {
  return !hasEtapovore && (projectedSeasonRaceDays ?? seasonRaceDays ?? 0) > RACE_LOAD_FREE_DAYS;
}

export function SeasonRaceDaysBadge({
  seasonRaceDays,
  projectedSeasonRaceDays,
  hasEtapovore,
  tone = "light",
  warnOnOverload = true,
  showThreshold = false,
}: SeasonRaceDaysCounts & {
  tone?: "light" | "dark";
  warnOnOverload?: boolean;
  showThreshold?: boolean;
}) {
  const displayedDays = projectedSeasonRaceDays ?? seasonRaceDays;
  if (displayedDays == null) return null;

  const overloaded = warnOnOverload && isSeasonRaceDaysOverloaded({
    seasonRaceDays,
    projectedSeasonRaceDays,
    hasEtapovore,
  });
  const earnsBonus = hasEtapovore && displayedDays > RACE_LOAD_FREE_DAYS;
  const approaching =
    showThreshold && warnOnOverload && !hasEtapovore &&
    displayedDays >= RACE_LOAD_WARNING_DAYS && displayedDays <= RACE_LOAD_FREE_DAYS;
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
  const moraleDetail = hasEtapovore
    ? ETAPOVORE_RACE_LOAD_BONUS_LABEL
    : showThreshold && warnOnOverload
      ? SEASON_RACE_DAYS_OVERLOAD_WARNING
      : null;
  const color = overloaded
    ? "border-red-500/40 bg-red-100 text-red-900"
    : earnsBonus
      ? "border-emerald-400/40 bg-emerald-100 text-emerald-900"
      : approaching
        ? "border-amber-500/40 bg-amber-100 text-amber-950"
        : tone === "dark"
          ? "border-white/20 bg-white/10 text-[#D6DFD2]"
          : "border-[#60756E]/15 bg-[#F3F6F5] text-[#526A62]";

  return (
    <span
      title={moraleDetail ? `${detail} · ${moraleDetail}` : detail}
      className={`inline-block whitespace-nowrap rounded-full border font-black tabular-nums ${color} ${
        showThreshold ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]"
      }`}
    >
      {overloaded ? <span aria-hidden="true" className="mr-1">⚠</span> : null}
      {showThreshold ? (
        <span aria-hidden="true" className="inline-flex items-center gap-1.5">
          <span>JDC saison</span>
          <span>{displayedDays}{warnOnOverload ? ` / ${RACE_LOAD_FREE_DAYS}` : null}</span>
        </span>
      ) : (
        <span aria-hidden="true">{compactLabel}</span>
      )}
      <span className="sr-only">{detail}</span>
      {moraleDetail ? <span className="sr-only">{moraleDetail}</span> : null}
      {overloaded ? (
        <span className="sr-only">
          {(seasonRaceDays ?? 0) > RACE_LOAD_FREE_DAYS ? "Calendrier surchargé" : "Surcharge prévue"}
        </span>
      ) : null}
    </span>
  );
}
