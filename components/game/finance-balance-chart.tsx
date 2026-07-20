import type { FinanceChartPoint } from "@/lib/game/economy";

const WIDTH = 920;
const HEIGHT = 330;
const PADDING = { top: 28, right: 30, bottom: 42, left: 82 };

export function FinanceBalanceChart({
  points,
  currentDayNumber,
  currency,
}: {
  points: FinanceChartPoint[];
  currentDayNumber: number;
  currency: string;
}) {
  const values = points.flatMap((point) => [
    point.projectedBalance,
    point.actualBalance ?? point.projectedBalance,
  ]);
  const rawMinimum = Math.min(0, ...values);
  const rawMaximum = Math.max(0, ...values);
  const range = Math.max(1, rawMaximum - rawMinimum);
  const minimum = rawMinimum - range * 0.12;
  const maximum = rawMaximum + range * 0.12;
  const actualPoints = points.filter(
    (point): point is FinanceChartPoint & { actualBalance: number } =>
      point.actualBalance !== null
  );
  const forecastPoints = points.filter(
    (point) => point.dayNumber >= currentDayNumber
  );
  const yTicks = Array.from({ length: 5 }, (_, index) =>
    maximum - ((maximum - minimum) * index) / 4
  );

  const actualPath = createPath(actualPoints, (point) => point.actualBalance, minimum, maximum);
  const forecastPath = createPath(
    forecastPoints,
    (point) => point.projectedBalance,
    minimum,
    maximum
  );
  const zeroY = yPosition(0, minimum, maximum);
  const currentX = xPosition(currentDayNumber);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#071A17] p-4 shadow-[0_18px_45px_rgba(7,26,23,0.18)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7CCF9C]">
            Trajectoire de trésorerie
          </p>
          <p className="mt-1 text-sm font-semibold text-[#BFD1C6]">
            Solde réel jusqu’à J{currentDayNumber}, puis projection hors résultats et investissements.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-bold text-[#D6DFD2]">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-7 bg-[#F2C94C]" aria-hidden="true" /> Réel
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-7 border-t-2 border-dashed border-[#7CCF9C]" aria-hidden="true" /> Prévision
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby="finance-chart-title finance-chart-description"
        className="h-auto w-full"
      >
        <title id="finance-chart-title">Évolution du budget de la saison</title>
        <desc id="finance-chart-description">
          Courbe du solde réel jusqu’au jour {currentDayNumber}, prolongée par le solde prévisionnel jusqu’au jour 28.
        </desc>

        {yTicks.map((tick) => {
          const y = yPosition(tick, minimum, maximum);
          return (
            <g key={tick}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y}
                y2={y}
                stroke="rgba(214,223,210,0.13)"
                strokeWidth="1"
              />
              <text
                x={PADDING.left - 14}
                y={y + 4}
                textAnchor="end"
                fill="#9FB5A8"
                fontSize="12"
                fontWeight="700"
              >
                {formatCompactCurrency(tick, currency)}
              </text>
            </g>
          );
        })}

        {[1, 7, 14, 21, 28].map((day) => (
          <text
            key={day}
            x={xPosition(day)}
            y={HEIGHT - 14}
            textAnchor="middle"
            fill="#9FB5A8"
            fontSize="12"
            fontWeight="700"
          >
            J{day}
          </text>
        ))}

        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={zeroY}
          y2={zeroY}
          stroke="#D6DFD2"
          strokeOpacity="0.36"
          strokeWidth="1.5"
        />
        <line
          x1={currentX}
          x2={currentX}
          y1={PADDING.top}
          y2={HEIGHT - PADDING.bottom}
          stroke="#F2C94C"
          strokeOpacity="0.35"
          strokeWidth="1"
        />
        <text
          x={currentX}
          y={18}
          textAnchor="middle"
          fill="#F2C94C"
          fontSize="11"
          fontWeight="800"
        >
          Aujourd’hui
        </text>

        {forecastPath ? (
          <path
            d={forecastPath}
            fill="none"
            stroke="#7CCF9C"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="10 9"
          />
        ) : null}
        {actualPath ? (
          <path
            d={actualPath}
            fill="none"
            stroke="#F2C94C"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
    </div>
  );
}

function createPath<T extends FinanceChartPoint>(
  points: T[],
  getValue: (point: T) => number,
  minimum: number,
  maximum: number
): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${xPosition(point.dayNumber).toFixed(2)} ${yPosition(
        getValue(point),
        minimum,
        maximum
      ).toFixed(2)}`;
    })
    .join(" ");
}

function xPosition(dayNumber: number): number {
  return (
    PADDING.left
    + ((dayNumber - 1) / 27) * (WIDTH - PADDING.left - PADDING.right)
  );
}

function yPosition(value: number, minimum: number, maximum: number): number {
  return (
    PADDING.top
    + ((maximum - value) / (maximum - minimum))
      * (HEIGHT - PADDING.top - PADDING.bottom)
  );
}

function formatCompactCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
