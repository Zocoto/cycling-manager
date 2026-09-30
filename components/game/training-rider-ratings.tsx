import {
  RIDER_RATING_AXES,
  type RiderRatings,
} from "@/lib/game/rider-profile";
import { getRiderRatingColorClasses } from "@/lib/game/rider-rating-colors";

export function TrainingRiderRatings({
  riderName,
  ratings,
}: {
  riderName: string;
  ratings: RiderRatings;
}) {
  const ratingItems = RIDER_RATING_AXES.map((axis) => ({
    ...axis,
    value: ratings[axis.key],
  }));
  const rankedRatings = [...ratingItems].sort(
    (left, right) => right.value - left.value,
  );
  const strengths = rankedRatings.slice(0, 2);
  const weakness = rankedRatings.at(-1)!;

  return (
    <details className="group mt-3 rounded-xl border border-[#315B3E]/12 bg-[#F7FAF9]">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-[#EEF6F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70] [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
          Notes
        </span>
        <span className="min-w-0 flex-1 truncate text-[10px] font-black tabular-nums text-[#176951]">
          {strengths.map((rating) => `${rating.shortLabel} ${formatRating(rating.value)}`).join(" · ")}
          <span className="ml-2 text-[#9B6659]">
            ↓ {weakness.shortLabel} {formatRating(weakness.value)}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-xs font-black text-[#278B70] transition-transform group-open:rotate-180"
        >
          ⌄
        </span>
      </summary>

      <div className="border-t border-[#315B3E]/10 px-2.5 pb-2.5 pt-2.5">
        <dl
          aria-label={`Statistiques de ${riderName}`}
          className="grid grid-cols-4 gap-1.5 sm:grid-cols-7 xl:grid-cols-4"
        >
          {ratingItems.map((rating) => (
            <div key={rating.key} className="min-w-0 text-center">
              <dt
                title={rating.label}
                className={`truncate text-[8px] uppercase tracking-wide ${
                  rating.importance === "primary"
                    ? "font-black text-[#48665F]"
                    : "font-bold text-[#91A098]"
                }`}
              >
                {rating.shortLabel}
              </dt>
              <dd
                title={`${rating.label} : ${formatRating(rating.value)}`}
                className={`mt-1 rounded-md border px-1 py-1 text-[11px] font-black tabular-nums ${getRiderRatingColorClasses(
                  rating.value,
                  rating.importance,
                )}`}
              >
                {formatRating(rating.value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}

function formatRating(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
