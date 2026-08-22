import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";
import type { DevelopmentPodiumProgression } from "@/services/development-team";

export function DevelopmentPodiumProgressionBadge({
  progression,
}: {
  progression: DevelopmentPodiumProgression;
}) {
  const gains = RIDER_RATING_AXES.flatMap((axis) => {
    const gain = progression.ratingChanges[axis.key];
    return gain && gain > 0 ? [{ ...axis, gain }] : [];
  }).sort((left, right) => {
    if (left.key === progression.primaryRatingKey) return -1;
    if (right.key === progression.primaryRatingKey) return 1;
    return right.gain - left.gain;
  });

  if (gains.length === 0) return null;

  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-black text-[#8A6714]">
      <span className="uppercase tracking-[0.1em]">Progression podium</span>
      {gains.map((gain) => (
        <span
          key={gain.key}
          className="rounded-full bg-[#FFF1B8] px-2 py-1 tabular-nums"
          title={gain.label}
        >
          +{formatGain(gain.gain)} {gain.shortLabel}
        </span>
      ))}
    </span>
  );
}

function formatGain(value: number) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 3,
  });
}
