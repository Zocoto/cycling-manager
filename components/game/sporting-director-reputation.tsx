import type { SportingDirectorReputationBreakdown } from "@/lib/game/reputation-breakdown";
import { getNextReputationTier, getReputationTier } from "@/lib/game/reputation";

import { ReputationBreakdownPopover } from "./reputation-breakdown-popover";

type SportingDirectorReputationProps = {
  reputationPoints: number;
  compact?: boolean;
  breakdown?: SportingDirectorReputationBreakdown | null;
};

export function SportingDirectorReputation({
  reputationPoints,
  compact = false,
  breakdown = null,
}: SportingDirectorReputationProps) {
  const safeReputationPoints = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(Math.max(0, reputationPoints));
  const tier = getReputationTier(reputationPoints);
  const nextTier = getNextReputationTier(reputationPoints);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9FB5A8]">
            Réputation
          </p>

          <ReputationBreakdownPopover
            formattedReputationPoints={safeReputationPoints}
            breakdown={breakdown}
          />
        </div>

        <span className="rounded-full border border-[#7CCF9C]/25 bg-[#7CCF9C]/10 px-3 py-1.5 text-xs font-bold text-[#9BE0BC]">
          {tier.label}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#315B3E]/20 bg-white/90 p-5 shadow-[0_14px_34px_rgba(19,60,46,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
            Réputation
          </p>

          <p className="mt-2 text-2xl font-black text-[#183F37]">
            {safeReputationPoints} points
          </p>
        </div>

        <ReputationIcon />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ReputationMetric label="Rang" value={tier.label} />
        <ReputationMetric
          label="Disponible"
          value={`${formatPoints(breakdown?.availablePoints ?? reputationPoints)} pts`}
        />
        <ReputationMetric
          label="Record"
          value={`${formatPoints(breakdown?.peakPoints ?? reputationPoints)} pts`}
        />
      </div>

      <p className="mt-4 text-sm leading-6 text-[#60756E]">
        La réputation n’est plus plafonnée. Les engagements en cours réduisent
        seulement la part disponible ; les dépenses et pénalités diminuent la
        valeur actuelle.
        {nextTier ? ` Prochain rang : ${nextTier.label} à ${formatPoints(nextTier.minimum)} points.` : " Vous avez atteint le rang maximal actuel."}
      </p>
    </div>
  );
}

function ReputationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#315B3E]/12 bg-[#F4F8F5] px-3 py-2.5">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#6A817A]">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-[#183F37]">{value}</p>
    </div>
  );
}

function formatPoints(points: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
    Math.max(0, points),
  );
}

function ReputationIcon() {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D7EEE8] text-[#176951]">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-6 w-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
      </svg>
    </span>
  );
}
