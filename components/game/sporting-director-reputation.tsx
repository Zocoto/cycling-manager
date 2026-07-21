type SportingDirectorReputationProps = {
  reputationPoints: number;
  compact?: boolean;
};

export function SportingDirectorReputation({
  reputationPoints,
  compact = false,
}: SportingDirectorReputationProps) {
  const safeReputationPoints = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(Math.max(0, reputationPoints));

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9FB5A8]">
            Réputation
          </p>

          <p className="mt-1 text-lg font-black text-[#FFFDF4]">
            {safeReputationPoints} points
          </p>
        </div>

        <span className="rounded-full border border-[#7CCF9C]/25 bg-[#7CCF9C]/10 px-3 py-1.5 text-xs font-bold text-[#9BE0BC]">
          Crédibilité sponsor
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

      <p className="mt-4 text-sm leading-6 text-[#60756E]">
        La réputation mesure votre crédibilité auprès
        des sponsors et du monde du cyclisme. Certains
        partenaires prestigieux imposent un minimum de
        réputation.
      </p>
    </div>
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
