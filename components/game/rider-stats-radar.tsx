"use client";

import {
  createRadarPoints,
  RIDER_RATING_AXES,
  serializeRadarPoints,
  type RiderRatingKey,
  type RiderRatings,
} from "@/lib/game/rider-profile";
import { EquipmentRatingBonus } from "@/components/game/equipment-rating-bonus";
import { getRiderRatingColorClasses } from "@/lib/game/rider-rating-colors";
import { useLocale } from "@/components/i18n/locale-provider";

type RiderStatsRadarProps = {
  ratings: RiderRatings;
  equipmentBonuses?: Partial<Record<RiderRatingKey, number>>;
};

const CENTER = 150;
const RADIUS = 92;

export function RiderStatsRadar({
  ratings,
  equipmentBonuses = {},
}: RiderStatsRadarProps) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const values = RIDER_RATING_AXES.map((axis) => ratings[axis.key]);
  const dataPoints = createRadarPoints({ values, center: CENTER, radius: RADIUS });
  const normalizedEquipmentBonuses = RIDER_RATING_AXES.map((axis) =>
    Math.max(0, Number(equipmentBonuses[axis.key] ?? 0)),
  );
  const hasEquipmentBonuses = normalizedEquipmentBonuses.some(
    (bonus) => bonus > 0,
  );
  const equippedDataPoints = createRadarPoints({
    values: values.map(
      (value, index) => value + normalizedEquipmentBonuses[index],
    ),
    center: CENTER,
    radius: RADIUS,
  });
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
        aria-label={
          hasEquipmentBonuses
            ? isEnglish
              ? "Rider attributes radar chart, with equipment bonuses in blue"
              : "Graphique radar des caractéristiques sportives, avec les bonus d’équipement en bleu"
            : isEnglish
              ? "Rider attributes radar chart"
              : "Graphique radar des caractéristiques sportives"
        }
        className="mx-auto w-full max-w-[32rem] overflow-visible"
      >
        <defs>
          <linearGradient id="rider-radar-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2FA982" stopOpacity="0.72" />
            <stop offset="1" stopColor="#176951" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient
            id="rider-radar-equipment-fill"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0" stopColor="#62B5FF" stopOpacity="0.58" />
            <stop offset="1" stopColor="#2468B2" stopOpacity="0.34" />
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
            strokeOpacity={RIDER_RATING_AXES[index].importance === "primary" ? 0.18 : 0.08}
          />
        ))}

        {hasEquipmentBonuses ? (
          <polygon
            data-radar-layer="equipment"
            points={serializeRadarPoints(equippedDataPoints)}
            fill="url(#rider-radar-equipment-fill)"
            stroke="#367FD3"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        ) : null}

        <polygon
          data-radar-layer="base"
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
            r={RIDER_RATING_AXES[index].importance === "primary" ? 3.2 : 2.2}
            fill="#FFFDF4"
            stroke={RIDER_RATING_AXES[index].importance === "primary" ? "#176951" : "#91A69F"}
            strokeWidth={RIDER_RATING_AXES[index].importance === "primary" ? 1.9 : 1.2}
          />
        ))}

        {hasEquipmentBonuses
          ? equippedDataPoints.map((point, index) => {
              const bonus = normalizedEquipmentBonuses[index];

              if (bonus <= 0) {
                return null;
              }

              const axis = RIDER_RATING_AXES[index];

              return (
                <circle
                  key={axis.key}
                  data-equipment-boost={axis.key}
                  data-equipment-bonus={bonus}
                  cx={point.x}
                  cy={point.y}
                  r={axis.importance === "primary" ? 3.4 : 2.7}
                  fill="#EAF5FF"
                  stroke="#367FD3"
                  strokeWidth="2"
                />
              );
            })
          : null}

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
              fill={axis.importance === "primary" ? "#183F37" : "#82958F"}
              fontSize="10"
              fontWeight={axis.importance === "primary" ? "900" : "700"}
            >
              {isEnglish ? axis.shortLabelEn : axis.shortLabel}
            </text>
          );
        })}
      </svg>

      {hasEquipmentBonuses ? (
        <div
          className="-mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[10px] font-bold text-[#5D716B]"
          aria-label={isEnglish ? "Chart legend" : "Légende du graphique"}
        >
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full border border-[#176951] bg-[#3B9A78]"
            />
            {isEnglish ? "Natural stats" : "Stats naturelles"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full border border-[#367FD3] bg-[#62B5FF]"
            />
            {isEnglish ? "With equipment" : "Avec équipement"}
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {RIDER_RATING_AXES.map((axis) => (
          <div
            key={axis.key}
            title={isEnglish ? axis.labelEn : axis.label}
            data-rating-importance={axis.importance}
            aria-label={`${isEnglish ? axis.labelEn : axis.label} : ${ratings[axis.key]}${
              Number(equipmentBonuses[axis.key] ?? 0) > 0
                ? isEnglish
                  ? `, equipment bonus +${equipmentBonuses[axis.key]}`
                  : `, bonus équipement +${equipmentBonuses[axis.key]}`
                : ""
            }`}
            className={[
              "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
              getRiderRatingColorClasses(ratings[axis.key], axis.importance),
            ].join(" ")}
          >
            <span className={axis.importance === "primary" ? "text-[11px] font-black" : "text-[11px] font-bold opacity-65"}>
              {isEnglish ? axis.shortLabelEn : axis.shortLabel}
            </span>
            <span className="flex items-baseline text-sm font-black">
              {ratings[axis.key]}
              <EquipmentRatingBonus
                bonus={equipmentBonuses[axis.key]}
                className="text-[9px]"
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
