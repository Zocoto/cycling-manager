import {
  RIDER_RATING_AXES,
  type RiderRatings,
} from "@/lib/game/rider-profile";
import { getRiderRatingColorClasses } from "@/lib/game/rider-rating-colors";

export function TeamEquipmentRiderRatings({
  riderName,
  ratings,
}: {
  riderName: string;
  ratings: RiderRatings | null;
}) {
  return (
    <div className="mt-2" data-team-equipment-rider-ratings>
      <p className="mb-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#60756E]">
        Notes
      </p>
      {ratings ? (
        <dl
          aria-label={`Notes de ${riderName}`}
          className="grid grid-cols-7 gap-1"
        >
          {RIDER_RATING_AXES.map((axis) => {
            const value = Math.round(ratings[axis.key]);
            return (
              <div
                key={axis.key}
                title={`${axis.label} : ${value}`}
                className={`flex min-w-0 items-center justify-between gap-0.5 rounded-md border px-1 py-0.5 ${getRiderRatingColorClasses(
                  value,
                  axis.importance,
                )}`}
              >
                <dt className="truncate text-[7px] font-black uppercase tracking-[-0.02em]">
                  {axis.shortLabel}
                </dt>
                <dd className="text-[9px] font-black tabular-nums">{value}</dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="text-[9px] font-bold text-[#809189]">
          Notes indisponibles
        </p>
      )}
    </div>
  );
}
