import type { RaceStageSegment } from "@/lib/game/race-profiles";

type RaceStageProfileProps = {
  segments: RaceStageSegment[];
  activeSegmentNumber?: number;
  compact?: boolean;
  tone?: "light" | "dark";
  showLegend?: boolean;
  onSelectSegment?: (segmentNumber: number) => void;
};

export function RaceStageProfile({
  segments,
  activeSegmentNumber,
  compact = false,
  tone = "light",
  showLegend = false,
  onSelectSegment,
}: RaceStageProfileProps) {
  if (segments.length === 0) {
    return (
      <p className={tone === "dark" ? "text-xs font-semibold text-[#7E9B8F]" : "text-xs font-semibold text-[#688176]"}>
        Profil détaillé indisponible.
      </p>
    );
  }

  const chart = buildProfileChart(segments, compact);
  const foreground = tone === "dark" ? "#9BE0CA" : "#176951";
  const muted = tone === "dark" ? "#78968A" : "#8AA299";
  const grid = tone === "dark" ? "rgba(255,255,255,0.13)" : "rgba(11,48,43,0.14)";
  const fill = tone === "dark" ? "rgba(114,212,183,0.17)" : "rgba(23,105,81,0.14)";

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl">
        <svg
          viewBox={`0 0 1000 ${chart.viewHeight}`}
          role="img"
          aria-label={describeProfile(segments)}
          className={compact ? "h-16 w-full" : "h-28 w-full sm:h-32"}
          preserveAspectRatio="none"
        >
          <title>{describeProfile(segments)}</title>
          <defs>
            <linearGradient id={`profile-fill-${tone}-${segments.length}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={foreground} stopOpacity="0.34" />
              <stop offset="1" stopColor={foreground} stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {chart.segments.map((entry) => (
            <g key={`grid-${entry.segment.segmentNumber}`}>
              {entry.segment.segmentNumber === activeSegmentNumber ? (
                <rect
                  x={entry.startX}
                  y="0"
                  width={Math.max(2, entry.endX - entry.startX)}
                  height={chart.viewHeight}
                  fill="rgba(242,201,76,0.14)"
                />
              ) : null}
              <line
                x1={entry.endX}
                x2={entry.endX}
                y1={compact ? 7 : 18}
                y2={chart.baseline}
                stroke={grid}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              {entry.segment.surface === "cobbles" ? (
                <rect
                  x={entry.startX}
                  y={chart.baseline - 4}
                  width={Math.max(2, entry.endX - entry.startX)}
                  height="4"
                  fill="#9B8468"
                  opacity="0.85"
                />
              ) : null}
            </g>
          ))}

          <path d={chart.areaPath} fill={fill} />
          <path
            d={chart.linePath}
            fill="none"
            stroke={foreground}
            strokeWidth={compact ? 2.5 : 3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {chart.segments.map((entry) => {
            if (!entry.segment.prime) return null;
            const markerX =
              entry.endX === chart.finishX
                ? entry.endX - (compact ? 18 : 28)
                : entry.endX;

            return (
              <g key={`prime-${entry.segment.segmentNumber}`}>
                <line
                  x1={markerX}
                  x2={markerX}
                  y1={Math.max(4, entry.endY - (compact ? 16 : 25))}
                  y2={entry.endY}
                  stroke={entry.segment.prime.type === "mountain" ? "#EF5B65" : "#43C892"}
                  strokeWidth={compact ? 2 : 3}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={`M ${markerX} ${Math.max(4, entry.endY - (compact ? 16 : 25))} h ${compact ? 8 : 13} l -3 ${compact ? 4 : 6} l 3 ${compact ? 4 : 6} h -${compact ? 8 : 13} Z`}
                  fill={entry.segment.prime.type === "mountain" ? "#EF5B65" : "#43C892"}
                />
                {!compact ? (
                  <text
                    x={markerX + 17}
                    y={Math.max(11, entry.endY - 19)}
                    fill={entry.segment.prime.type === "mountain" ? "#EF5B65" : "#43C892"}
                    fontSize="11"
                    fontWeight="800"
                  >
                    {entry.segment.prime.type === "mountain"
                      ? `GPM ${entry.segment.prime.category ?? ""}`
                      : "SI"}
                  </text>
                ) : null}
              </g>
            );
          })}

          <g aria-hidden="true">
            <line
              x1={chart.finishX}
              x2={chart.finishX}
              y1={Math.max(4, chart.finishY - (compact ? 19 : 29))}
              y2={chart.finishY}
              stroke="#EF5B65"
              strokeWidth={compact ? 2 : 3}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={`M ${chart.finishX} ${Math.max(4, chart.finishY - (compact ? 19 : 29))} h ${compact ? 11 : 17} v ${compact ? 8 : 12} h -${compact ? 11 : 17} Z`}
              fill="#EF5B65"
            />
          </g>

          {!compact ? (
            <>
              <text x="10" y={chart.viewHeight - 5} fill={muted} fontSize="10" fontWeight="700">
                DÉPART
              </text>
              <text x="990" y={chart.viewHeight - 5} fill={muted} fontSize="10" fontWeight="700" textAnchor="end">
                {formatDistance(chart.totalDistance)} KM
              </text>
            </>
          ) : null}
        </svg>

        {onSelectSegment ? (
          <div className="absolute inset-0 flex" aria-label="Sélection d'un tronçon">
            {chart.segments.map((entry) => (
              <button
                key={`select-${entry.segment.segmentNumber}`}
                type="button"
                onClick={() => onSelectSegment(entry.segment.segmentNumber)}
                className="h-full min-w-0 outline-none transition hover:bg-white/5 focus-visible:bg-white/10"
                style={{ flexGrow: entry.segment.distanceKm, flexBasis: 0 }}
                aria-label={describeSegment(entry.segment)}
                aria-current={entry.segment.segmentNumber === activeSegmentNumber ? "step" : undefined}
              />
            ))}
          </div>
        ) : null}
      </div>

      {showLegend ? (
        <div className={`mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] font-bold uppercase tracking-wider ${tone === "dark" ? "text-[#78968A]" : "text-[#688176]"}`}>
          {segments.some((segment) => segment.prime) ? (
            <>
              <span><span className="text-[#EF5B65]">⚑</span> GPM</span>
              <span><span className="text-[#43C892]">⚑</span> Sprint intermédiaire</span>
            </>
          ) : (
            <span>Aucun GPM/SI programmé sur ce parcours</span>
          )}
          <span>Traits verticaux : tronçons de 10 km</span>
          {segments.some((segment) => segment.surface === "cobbles") ? <span className="text-[#9B8468]">▬ Secteur pavé</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function buildProfileChart(segments: RaceStageSegment[], compact: boolean) {
  const viewHeight = compact ? 72 : 132;
  const top = compact ? 8 : 20;
  const baseline = compact ? 62 : 113;
  const totalDistance = segments.reduce((total, segment) => total + segment.distanceKm, 0);
  let distance = 0;
  let elevation = 0;
  const points = [{ distance: 0, elevation: 0 }];

  for (const segment of segments) {
    distance += segment.distanceKm;
    elevation += segment.distanceKm * segment.averageGradientPct * 10;
    points.push({ distance, elevation });
  }

  const elevations = points.map((point) => point.elevation);
  const minimum = Math.min(...elevations);
  const maximum = Math.max(...elevations);
  const range = Math.max(120, maximum - minimum);
  const plotLeft = compact ? 20 : 28;
  const plotRight = compact ? 960 : 942;
  const x = (value: number) =>
    plotLeft + (value / totalDistance) * (plotRight - plotLeft);
  const y = (value: number) => baseline - ((value - minimum + range * 0.08) / (range * 1.16)) * (baseline - top);
  const chartPoints = points.map((point) => ({ x: x(point.distance), y: y(point.elevation) }));
  const linePath = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${plotRight} ${baseline} L ${plotLeft} ${baseline} Z`;
  let cumulativeDistance = 0;
  const chartSegments = segments.map((segment, index) => {
    const startDistance = cumulativeDistance;
    cumulativeDistance += segment.distanceKm;
    return {
      segment,
      startX: x(startDistance),
      endX: x(cumulativeDistance),
      endY: chartPoints[index + 1].y,
    };
  });

  return {
    viewHeight,
    baseline,
    totalDistance,
    finishX: chartPoints.at(-1)?.x ?? plotRight,
    finishY: chartPoints.at(-1)?.y ?? baseline,
    segments: chartSegments,
    linePath,
    areaPath,
  };
}

function describeProfile(segments: RaceStageSegment[]) {
  const distance = segments.reduce((total, segment) => total + segment.distanceKm, 0);
  const mountains = segments.filter((segment) => segment.prime?.type === "mountain").length;
  const sprints = segments.filter((segment) => segment.prime?.type === "intermediate_sprint").length;
  return `Profil de ${formatDistance(distance)} kilomètres, ${segments.length} tronçons, ${mountains} GPM et ${sprints} sprint intermédiaire`;
}

function describeSegment(segment: RaceStageSegment) {
  const terrain = segment.terrain === "climb" ? "montée" : segment.terrain === "descent" ? "descente" : "plat";
  const gradient = segment.averageGradientPct === 0 ? "" : ` à ${segment.averageGradientPct > 0 ? "+" : ""}${segment.averageGradientPct} %`;
  const prime = segment.prime?.type === "mountain" ? `, GPM ${segment.prime.category}` : segment.prime ? ", sprint intermédiaire" : "";
  return `Tronçon ${segment.segmentNumber}, ${formatDistance(segment.distanceKm)} kilomètres, ${terrain}${gradient}${prime}`;
}

function formatDistance(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
