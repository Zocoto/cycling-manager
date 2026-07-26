import { formatPotential, normalizePotentialSteps } from "@/lib/game/training";

type PotentialStarsProps = {
  potentialSteps: number;
  dark?: boolean;
  compact?: boolean;
  showLabel?: boolean;
};

export function PotentialStars({
  potentialSteps,
  dark = false,
  compact = false,
  showLabel = true,
}: PotentialStarsProps) {
  const normalized = normalizePotentialSteps(potentialSteps);

  return (
    <span
      className="inline-flex items-center gap-2"
      aria-label={`Potentiel : ${formatPotential(normalized)}`}
      title={`Potentiel : ${formatPotential(normalized)}`}
    >
      <span className={`flex ${compact ? "gap-0" : "gap-0.5"}`} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => {
          const fillSteps = Math.min(2, Math.max(0, normalized - index * 2));
          return (
            <span
              key={index}
              className={`relative inline-block ${compact ? "text-sm" : "text-lg"} leading-none`}
            >
              <span className={dark ? "text-white/20" : "text-[#D6DFD2]"}>★</span>
              <span
                className="absolute inset-y-0 left-0 overflow-hidden text-[#F2C94C]"
                style={{ width: `${fillSteps * 50}%` }}
              >
                ★
              </span>
            </span>
          );
        })}
      </span>
      {showLabel ? (
        <span
          className={`${compact ? "text-[10px]" : "text-xs"} font-black ${
            dark ? "text-[#FFF4C5]" : "text-[#6E5715]"
          }`}
        >
          {formatPotential(normalized)}
        </span>
      ) : null}
    </span>
  );
}
