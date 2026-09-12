import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import type { SponsorBudgetHistoryPoint } from "@/lib/game/sponsor-budget-history";

const MINIMUM_WIDTH = 760;
const HEIGHT = 380;
const POINT_GAP = 140;
const PADDING = { top: 40, right: 140, bottom: 80, left: 140 };

export function SponsorBudgetHistoryChart({
  points,
}: {
  points: SponsorBudgetHistoryPoint[];
}) {
  if (points.length === 0) return null;

  const maximumBudget = Math.max(...points.map((point) => point.budgetPerSeason));
  const chartMaximum = maximumBudget > 0 ? getNiceMaximum(maximumBudget) : 1;
  const currencyCode =
    points.find((point) => point.budgetPerSeason > 0)?.currencyCode ??
    points.at(-1)?.currencyCode ??
    "EUR";
  const ticks = maximumBudget > 0
    ? Array.from({ length: 5 }, (_, index) => chartMaximum - (chartMaximum * index) / 4)
    : [0];
  const chartWidth = Math.max(
    MINIMUM_WIDTH,
    PADDING.left + PADDING.right + Math.max(0, points.length - 1) * POINT_GAP,
  );
  const chartPoints = points.map((point, index) => ({
    point,
    x: xPosition(index, points.length, chartWidth),
    y: yPosition(point.budgetPerSeason, chartMaximum),
  }));
  const linePath = chartPoints
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  return (
    <section className="mt-8 overflow-hidden rounded-[28px] border border-[#315B3E]/15 bg-[#071A17] shadow-[0_22px_55px_rgba(7,26,23,0.16)]">
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-2 pt-6 sm:px-8 sm:pt-8">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#7CCF9C]">
            Trajectoire financière
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">
            Évolution des budgets sponsors
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#BFD1C6]">
            Le montant annuel réellement associé à chaque saison. Une saison amateur apparaît à 0 €.
          </p>
        </div>
        <p className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold text-[#D6DFD2]">
          Survolez un logo pour voir le détail
        </p>
      </div>

      <div className="overflow-x-auto px-2 pb-3 sm:px-5 sm:pb-6">
        <div
          className="relative mx-auto"
          style={{ width: `${chartWidth}px`, height: `${HEIGHT}px` }}
        >
          <svg
            viewBox={`0 0 ${chartWidth} ${HEIGHT}`}
            role="img"
            aria-labelledby="sponsor-budget-chart-title sponsor-budget-chart-description"
            className="absolute inset-0 h-full w-full"
          >
            <title id="sponsor-budget-chart-title">
              Évolution annuelle du budget sponsor de l’équipe
            </title>
            <desc id="sponsor-budget-chart-description">
              La courbe présente le budget sponsor annuel de chaque saison, avec une valeur nulle pour les saisons amateures.
            </desc>

            <defs>
              <linearGradient id="sponsor-budget-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#7CCF9C" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#7CCF9C" stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticks.map((tick) => {
              const y = yPosition(tick, chartMaximum);

              return (
                <g key={tick}>
                  <line
                    x1={PADDING.left}
                    x2={chartWidth - PADDING.right}
                    y1={y}
                    y2={y}
                    stroke="rgba(214,223,210,0.14)"
                    strokeWidth="1"
                  />
                  <text
                    x={PADDING.left - 18}
                    y={y + 4}
                    textAnchor="end"
                    fill="#9FB5A8"
                    fontSize="12"
                    fontWeight="700"
                  >
                    {formatCompactMoney(tick, currencyCode)}
                  </text>
                </g>
              );
            })}

            {linePath ? (
              <>
                <path
                  d={`${linePath} L ${chartPoints.at(-1)?.x ?? PADDING.left} ${HEIGHT - PADDING.bottom} L ${chartPoints[0]?.x ?? PADDING.left} ${HEIGHT - PADDING.bottom} Z`}
                  fill="url(#sponsor-budget-area)"
                />
                <path
                  d={linePath}
                  fill="none"
                  stroke="#F2C94C"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="5"
                />
              </>
            ) : null}

            {chartPoints.map(({ point, x }) => (
              <text
                key={point.seasonId}
                x={x}
                y={HEIGHT - 28}
                textAnchor="middle"
                fill="#D6DFD2"
                fontSize="13"
                fontWeight="800"
              >
                {point.seasonName}
              </text>
            ))}
          </svg>

          {chartPoints.map(({ point, x, y }) => {
            const tooltipId = `sponsor-budget-${point.seasonId}`;
            const showTooltipBelow = y < 140;

            return (
              <div
                key={point.seasonId}
                className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 hover:z-30 focus-within:z-30"
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                }}
              >
                <button
                  type="button"
                  aria-describedby={tooltipId}
                  aria-label={`${point.seasonName}, ${point.teamName}, ${formatMoney(point.budgetPerSeason, point.currencyCode)}`}
                  className="rounded-xl outline-none ring-[#F2C94C] ring-offset-4 ring-offset-[#071A17] transition-transform hover:scale-105 focus-visible:ring-2"
                >
                  {point.logo ? (
                    <SponsorLogoMark
                      src={point.logo.logoPath}
                      alt={`Logo de ${point.teamName}`}
                      sponsorName={point.teamName}
                      primaryColor={point.logo.primaryColor}
                      backgroundColor={point.logo.backgroundColor}
                      textColor={point.logo.textColor}
                      className="h-12 w-[68px] rounded-xl bg-white p-1.5 sm:h-14 sm:w-20 sm:p-2"
                    />
                  ) : (
                    <AmateurTeamMark teamName={point.teamName} />
                  )}
                </button>

                <div
                  id={tooltipId}
                  role="tooltip"
                  className={`pointer-events-none absolute left-1/2 z-40 w-64 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#102C26] p-4 text-left opacity-0 shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
                    showTooltipBelow ? "top-[calc(100%+12px)]" : "bottom-[calc(100%+12px)]"
                  }`}
                >
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#7CCF9C]">
                    {point.seasonName}
                  </p>
                  <p className="mt-2 text-lg font-black text-white">
                    {formatMoney(point.budgetPerSeason, point.currencyCode)} / an
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-[#D6DFD2]">
                    {point.teamName}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AmateurTeamMark({ teamName }: { teamName: string }) {
  return (
    <span
      role="img"
      aria-label={`Identité amateur de ${teamName}`}
      className="relative flex h-12 w-[68px] items-center justify-center overflow-hidden rounded-xl border border-[#7CCF9C]/40 bg-[#E7F4EC] text-sm font-black text-[#0D4B3C] shadow-sm sm:h-14 sm:w-20 sm:text-base"
    >
      <span
        aria-hidden="true"
        className="absolute -bottom-7 -right-5 h-14 w-14 rotate-45 rounded-lg bg-[#7CCF9C]/30"
      />
      <span className="relative">{getInitials(teamName)}</span>
    </span>
  );
}

function xPosition(index: number, pointCount: number, chartWidth: number): number {
  const plotWidth = chartWidth - PADDING.left - PADDING.right;

  if (pointCount <= 1) return PADDING.left + plotWidth / 2;

  return PADDING.left + (index / (pointCount - 1)) * plotWidth;
}

function yPosition(value: number, maximum: number): number {
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  return PADDING.top + ((maximum - value) / maximum) * plotHeight;
}

function getNiceMaximum(value: number): number {
  const paddedValue = value * 1.12;
  const magnitude = 10 ** Math.floor(Math.log10(paddedValue));
  const normalizedValue = paddedValue / magnitude;
  const multiplier = normalizedValue <= 1 ? 1 : normalizedValue <= 2 ? 2 : normalizedValue <= 5 ? 5 : 10;

  return multiplier * magnitude;
}

function formatCompactMoney(value: number, currencyCode: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currencyCode,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMoney(value: number, currencyCode: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(teamName: string): string {
  return (
    teamName
      .trim()
      .split(/[\s-]+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "AM"
  );
}
