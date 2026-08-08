"use client";

import { useMemo, useState } from "react";

import Link from "@/components/ui/app-link";

import {
  DEFAULT_RIDER_PROGRESSION_STATS,
  getProgressionChartBounds,
  RIDER_PROGRESSION_SERIES,
  type RiderProgressionHistory,
  type RiderProgressionSeason,
  type RiderProgressionStatKey,
} from "@/lib/game/rider-progression";

type ProgressionChartProps = {
  seasons: readonly RiderProgressionSeason[];
  selectedStats: readonly RiderProgressionStatKey[];
  compact?: boolean;
};

export function RiderProgressionChart({
  seasons,
  selectedStats,
  compact = false,
}: ProgressionChartProps) {
  const width = compact ? 640 : 900;
  const height = compact ? 240 : 430;
  const padding = compact
    ? { top: 20, right: 14, bottom: 36, left: 42 }
    : { top: 34, right: 24, bottom: 52, left: 58 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const bounds = getProgressionChartBounds(seasons, selectedStats);
  const yRange = Math.max(1, bounds.maximum - bounds.minimum);
  const yTicks = createTicks(bounds.minimum, bounds.maximum, 5);
  const xTicks = [0, 7, 14, 21, 28];
  const seriesByKey = new Map(
    RIDER_PROGRESSION_SERIES.map((series) => [series.key, series]),
  );

  if (seasons.length === 0) {
    return (
      <div className="grid min-h-40 min-w-0 max-w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-[#315B3E]/20 bg-[#F7FAF8] px-6 text-center text-sm font-semibold text-[#60756E] sm:min-h-56">
        La courbe apparaîtra après la première journée d’entraînement.
      </div>
    );
  }

  const x = (dayNumber: number) =>
    padding.left + (Math.max(0, Math.min(28, dayNumber)) / 28) * chartWidth;
  const y = (value: number) =>
    padding.top +
    ((bounds.maximum -
      Math.max(bounds.minimum, Math.min(bounds.maximum, value))) /
      yRange) *
      chartHeight;

  return (
    <div className="min-w-0 max-w-full overflow-x-clip">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {selectedStats.map((statKey) => {
          const series = seriesByKey.get(statKey);
          if (!series) return null;
          return (
            <span
              key={series.key}
              className="inline-flex items-center gap-2 text-[11px] font-black text-[#48665F]"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: series.color }}
                aria-hidden="true"
              />
              {series.shortLabel}
            </span>
          );
        })}
        {seasons.length > 1 ? (
          <span className="ml-auto inline-flex items-center gap-3 text-[10px] font-bold text-[#60756E]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-6 bg-[#48665F]" aria-hidden="true" />
              Saison actuelle
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg aria-hidden="true" viewBox="0 0 24 2" className="h-1 w-6">
                <path
                  d="M0 1h24"
                  stroke="#48665F"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              </svg>
              Saison précédente
            </span>
          </span>
        ) : null}
      </div>

      <div className="max-w-full overflow-hidden rounded-2xl border border-[#315B3E]/12 bg-[linear-gradient(180deg,#FBFDFB,#F3F8F5)]">
        <svg
          role="img"
          aria-label={buildChartLabel(seasons, selectedStats)}
          viewBox={`0 0 ${width} ${height}`}
          className={`block h-auto w-full max-w-full touch-pan-y ${
            compact ? "max-h-[240px]" : ""
          }`}
          style={{ touchAction: "pan-y" }}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width={width} height={height} fill="transparent" />

          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#CFE0D9"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y(tick) + 4}
                textAnchor="end"
                fill="#60756E"
                fontSize={compact ? 11 : 12}
                fontWeight="700"
              >
                {tick}
              </text>
            </g>
          ))}

          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={x(tick)}
                x2={x(tick)}
                y1={padding.top}
                y2={height - padding.bottom}
                stroke="#E2ECE8"
                strokeWidth="1"
              />
              <text
                x={x(tick)}
                y={height - 16}
                textAnchor="middle"
                fill="#60756E"
                fontSize={compact ? 11 : 12}
                fontWeight="700"
              >
                {tick === 0 ? "Départ" : `J${tick}`}
              </text>
            </g>
          ))}

          {seasons.flatMap((season) =>
            selectedStats.flatMap((statKey) => {
              const series = seriesByKey.get(statKey);
              if (!series || season.points.length === 0) return [];
              const points = season.points
                .map(
                  (point) =>
                    `${x(point.dayNumber)},${y(point.values[statKey])}`,
                )
                .join(" ");
              const isCurrent = season.isCurrent;

              return [
                <g key={`${season.seasonId}-${statKey}`}>
                  <polyline
                    points={points}
                    fill="none"
                    stroke={series.color}
                    strokeWidth={isCurrent ? (compact ? 3 : 3.5) : 2.25}
                    strokeDasharray={isCurrent ? undefined : "8 6"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isCurrent ? 1 : 0.62}
                  />
                  {season.points.map((point, index) => {
                    const previousPoint = season.points[index - 1];
                    const value = point.values[statKey];
                    const shouldShowPoint =
                      index === season.points.length - 1 ||
                      !previousPoint ||
                      previousPoint.values[statKey] !== value;
                    if (!shouldShowPoint) return null;

                    return (
                      <circle
                        key={`${point.dayNumber}-${index}`}
                        cx={x(point.dayNumber)}
                        cy={y(value)}
                        r={isCurrent ? 4 : 3}
                        fill="#FFFFFF"
                        stroke={series.color}
                        strokeWidth="2"
                        opacity={isCurrent ? 1 : 0.7}
                      >
                        <title>{`${season.seasonName} \u00b7 J${point.dayNumber} \u00b7 ${series.label} : ${formatRating(value)}`}</title>
                      </circle>
                    );
                  })}
                </g>,
              ];
            }),
          )}
        </svg>
      </div>
    </div>
  );
}

export function ProgressionStatFilters({
  selectedStats,
  onChange,
  compact = false,
}: {
  selectedStats: readonly RiderProgressionStatKey[];
  onChange: (stats: RiderProgressionStatKey[]) => void;
  compact?: boolean;
}) {
  const primarySeries = RIDER_PROGRESSION_SERIES.filter(
    (series) => series.importance === "primary",
  );
  const optionalSeries = RIDER_PROGRESSION_SERIES.filter(
    (series) => series.importance !== "primary",
  );
  const optionalSelectedCount = optionalSeries.filter((series) =>
    selectedStats.includes(series.key),
  ).length;

  return (
    <div className="min-w-0 space-y-3">
      <fieldset className="min-w-0">
        <legend className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#60756E]">
          Statistiques primaires
        </legend>
        <ProgressionStatOptions
          series={primarySeries}
          selectedStats={selectedStats}
          onChange={onChange}
          compact={compact}
        />
      </fieldset>

      <details className="group min-w-0 rounded-xl border border-[#315B3E]/12 bg-white/70">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#48665F] outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[#278B70]/45 [&::-webkit-details-marker]:hidden">
          <span>Moyenne &amp; stats secondaires</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[#278B70]">
            {optionalSelectedCount}/{optionalSeries.length}
            <span
              aria-hidden="true"
              className="transition-transform group-open:rotate-180"
            >
              ⌄
            </span>
          </span>
        </summary>
        <div className="border-t border-[#315B3E]/10 p-2">
          <ProgressionStatOptions
            series={optionalSeries}
            selectedStats={selectedStats}
            onChange={onChange}
            compact={compact}
          />
        </div>
      </details>
    </div>
  );
}

function ProgressionStatOptions({
  series,
  selectedStats,
  onChange,
  compact,
}: {
  series: ReadonlyArray<(typeof RIDER_PROGRESSION_SERIES)[number]>;
  selectedStats: readonly RiderProgressionStatKey[];
  onChange: (stats: RiderProgressionStatKey[]) => void;
  compact: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2"
          : "space-y-1.5"
      }
    >
      {series.map((item) => {
        const isSelected = selectedStats.includes(item.key);
        return (
          <button
            key={item.key}
            type="button"
            title={item.label}
            aria-label={`${isSelected ? "Masquer" : "Afficher"} ${item.label}`}
            aria-pressed={isSelected}
            onClick={() =>
              onChange(toggleProgressionStat(selectedStats, item.key))
            }
            className={`flex min-w-0 w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
              isSelected
                ? "border-[#315B3E]/18 bg-white shadow-sm"
                : "border-transparent bg-transparent opacity-60 hover:bg-white/70 hover:opacity-100"
            }`}
          >
            <span
              aria-hidden="true"
              className="grid h-4 w-4 shrink-0 place-items-center rounded border-2 text-[10px] font-black text-white"
              style={{
                borderColor: item.color,
                backgroundColor: isSelected ? item.color : "transparent",
              }}
            >
              {isSelected ? "✓" : ""}
            </span>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-wider text-[#183F37]">
              {item.shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ProgressionSeasonFilters({
  seasons,
  selectedSeasonIds,
  onChange,
}: {
  seasons: readonly RiderProgressionSeason[];
  selectedSeasonIds: readonly string[];
  onChange: (seasonIds: string[]) => void;
}) {
  const previousSeasons = seasons.filter((season) => !season.isCurrent);
  if (previousSeasons.length === 0) return null;

  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="mr-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">
        Saisons précédentes
      </legend>
      {previousSeasons.map((season) => {
        const isSelected = selectedSeasonIds.includes(season.seasonId);
        return (
          <button
            key={season.seasonId}
            type="button"
            aria-pressed={isSelected}
            onClick={() =>
              onChange(
                isSelected
                  ? selectedSeasonIds.filter(
                      (seasonId) => seasonId !== season.seasonId,
                    )
                  : [...selectedSeasonIds, season.seasonId],
              )
            }
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition ${
              isSelected
                ? "border-[#176951]/30 bg-[#D7EEE8] text-[#176951]"
                : "border-[#315B3E]/15 bg-white text-[#60756E] hover:border-[#176951]/30"
            }`}
          >
            <span
              className={`grid h-4 w-4 place-items-center rounded border ${
                isSelected
                  ? "border-[#176951] bg-[#176951] text-white"
                  : "border-[#8EA29B] bg-white"
              }`}
              aria-hidden="true"
            >
              {isSelected ? "✓" : ""}
            </span>
            {season.seasonName}
          </button>
        );
      })}
    </fieldset>
  );
}

export function CompactRiderProgression({
  history,
  detailHref,
  onCollapse,
}: {
  history: RiderProgressionHistory;
  detailHref: string;
  onCollapse?: () => void;
}) {
  const [selectedStats, setSelectedStats] = useState<RiderProgressionStatKey[]>(
    [...DEFAULT_RIDER_PROGRESSION_STATS],
  );
  const currentSeason =
    history.seasons.find((season) => season.isCurrent) ?? history.seasons[0];

  return (
    <section className="mt-7 min-w-0 max-w-full overflow-x-clip border-t border-[#315B3E]/12 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
            Évolution
          </p>
          <h3 className="mt-1 text-xl font-black text-[#183F37]">
            Progression cette saison
          </h3>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {onCollapse ? (
            <button
              type="button"
              onClick={onCollapse}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#315B3E]/15 bg-white px-4 py-2.5 text-xs font-black text-[#176951] transition hover:bg-[#F3F8F5] sm:flex-none"
            >
              Masquer
              <span className="ml-2" aria-hidden="true">
                ↖
              </span>
            </button>
          ) : null}
          <Link
            href={detailHref}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#176951] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#0F5743] sm:flex-none"
          >
            Détail
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)] xl:items-start">
        <div className="rounded-2xl bg-[#F3F8F5] p-3">
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#60756E]">
            Statistiques
          </p>
          <ProgressionStatFilters
            selectedStats={selectedStats}
            onChange={setSelectedStats}
            compact
          />
        </div>
        <RiderProgressionChart
          seasons={currentSeason ? [currentSeason] : []}
          selectedStats={selectedStats}
          compact
        />
      </div>
    </section>
  );
}

export function useProgressionSelection() {
  const [selectedStats, setSelectedStats] = useState<RiderProgressionStatKey[]>(
    [...DEFAULT_RIDER_PROGRESSION_STATS],
  );
  const stableSelectedStats = useMemo(() => selectedStats, [selectedStats]);
  return { selectedStats: stableSelectedStats, setSelectedStats };
}

export function toggleProgressionStat(
  selectedStats: readonly RiderProgressionStatKey[],
  stat: RiderProgressionStatKey,
): RiderProgressionStatKey[] {
  if (selectedStats.includes(stat)) {
    return selectedStats.length === 1
      ? [...selectedStats]
      : selectedStats.filter((selectedStat) => selectedStat !== stat);
  }
  return [...selectedStats, stat];
}

function buildChartLabel(
  seasons: readonly RiderProgressionSeason[],
  stats: readonly RiderProgressionStatKey[],
): string {
  const seriesByKey = new Map(
    RIDER_PROGRESSION_SERIES.map((series) => [series.key, series.label]),
  );
  return `Évolution de ${stats
    .map((stat) => seriesByKey.get(stat) ?? stat)
    .join(", ")} sur ${seasons.map((season) => season.seasonName).join(", ")}`;
}

function createTicks(
  minimum: number,
  maximum: number,
  count: number,
): number[] {
  const interval = (maximum - minimum) / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, index) =>
    Math.round(minimum + interval * index),
  );
}

function formatRating(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
