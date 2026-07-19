import {
  createRadarPoints,
  RIDER_RATING_AXES,
  serializeRadarPoints,
  type RiderRatings,
} from "@/lib/game/rider-profile";

type RiderStatsRadarProps = {
  ratings: RiderRatings;
};

const CENTER = 150;
const RADIUS = 92;

export function RiderStatsRadar({ ratings }: RiderStatsRadarProps) {
  const values = RIDER_RATING_AXES.map((axis) => ratings[axis.key]);
  const dataPoints = createRadarPoints({ values, center: CENTER, radius: RADIUS });
  const outerPoints = createRadarPoints({
    values: RIDER_RATING_AXES.map(() => 100),
    center: CENTER,
    radius: RADIUS,
  });

  return (
    <div>
      <svg
        viewBox="0 0 300 300"
        role="img"
        aria-label="Graphique radar des caractéristiques sportives"
        className="mx-auto w-full max-w-[32rem] overflow-visible"
      >
        <defs>
          <linearGradient id="rider-radar-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2FA982" stopOpacity="0.72" />
            <stop offset="1" stopColor="#176951" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {[25, 50, 75, 100].map((level) => (
          <polygon
            key={level}
            points={serializeRadarPoints(
              createRadarPoints({
                values: RIDER_RATING_AXES.map(() => level),
                center: CENTER,
                radius: RADIUS,
              })
            )}
            fill={level === 100 ? "#F3F8F5" : "none"}
            stroke="#315B3E"
            strokeOpacity={level === 100 ? 0.3 : 0.12}
            strokeWidth={level === 100 ? 1.4 : 1}
          />
        ))}

        {outerPoints.map((point, index) => (
          <line
            key={RIDER_RATING_AXES[index].key}
            x1={CENTER}
            y1={CENTER}
            x2={point.x}
            y2={point.y}
            stroke="#315B3E"
            strokeOpacity="0.14"
          />
        ))}

        <polygon
          points={serializeRadarPoints(dataPoints)}
          fill="url(#rider-radar-fill)"
          stroke="#176951"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {dataPoints.map((point, index) => (
          <circle
            key={RIDER_RATING_AXES[index].key}
            cx={point.x}
            cy={point.y}
            r="2.8"
            fill="#FFFDF4"
            stroke="#176951"
            strokeWidth="1.8"
          />
        ))}

        {RIDER_RATING_AXES.map((axis, index) => {
          const angle = -Math.PI / 2 + (index * Math.PI * 2) / RIDER_RATING_AXES.length;
          const x = CENTER + Math.cos(angle) * 119;
          const y = CENTER + Math.sin(angle) * 119;

          return (
            <text
              key={axis.key}
              x={x}
              y={y}
              textAnchor={x < CENTER - 10 ? "end" : x > CENTER + 10 ? "start" : "middle"}
              dominantBaseline="middle"
              fill="#183F37"
              fontSize="10"
              fontWeight="900"
            >
              {axis.shortLabel}
            </text>
          );
        })}
      </svg>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {RIDER_RATING_AXES.map((axis) => (
          <div
            key={axis.key}
            title={axis.label}
            className="flex items-center justify-between gap-2 rounded-lg border border-[#315B3E]/10 bg-[#F6FAF7] px-3 py-2"
          >
            <span className="text-[11px] font-extrabold text-[#60756E]">
              {axis.shortLabel}
            </span>
            <span className="text-sm font-black text-[#183F37]">
              {ratings[axis.key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
