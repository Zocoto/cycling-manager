import {
  TRAINING_DOMAIN_LABELS,
  getTrainingDomainWeightGroups,
  type TrainingDomain,
  type TrainingDomainWeightTier,
} from "@/lib/game/training";

const GROUP_STYLES: Record<TrainingDomainWeightTier, string> = {
  primary: "text-[#176951]",
  secondary: "text-[#806114]",
  support: "text-[#60756E]",
};

function formatWeight(weight: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(weight * 100);
}

export function TrainingDomainGainBreakdown({
  domain,
  className = "",
}: {
  domain: TrainingDomain;
  className?: string;
}) {
  const groups = getTrainingDomainWeightGroups(domain);
  const primaryGroup = groups.find((group) => group.tier === "primary");

  return (
    <details
      className={`group min-w-0 ${className}`}
    >
      <summary
        aria-label={`Répartition du gain pour le profil ${TRAINING_DOMAIN_LABELS[domain]}`}
        className="flex min-h-7 cursor-pointer list-none items-center gap-2 rounded-lg px-1 py-1 text-[9px] font-bold text-[#60756E] transition hover:bg-[#F2F7F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]/30 [&::-webkit-details-marker]:hidden"
      >
        <span className="shrink-0 font-black uppercase tracking-[0.1em] text-[#48665F]">
          ⓘ Répartition du gain
        </span>
        <span className="min-w-0 flex-1 truncate tabular-nums">
          {primaryGroup?.stats.map((stat) => stat.shortLabel).join(" / ")} · {formatWeight(primaryGroup?.weight ?? 1)} %
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-xs font-black text-[#278B70] transition-transform group-open:rotate-180"
        >
          ⌄
        </span>
      </summary>

      <div className="mt-1 space-y-1 rounded-lg border border-[#315B3E]/10 bg-[#F7FAF8] p-2">
        {groups.map((group) => (
          <div
            key={group.tier}
            className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 ${GROUP_STYLES[group.tier]}`}
          >
            <span className="min-w-0 text-[9px] font-bold leading-4">
              <span className="font-black uppercase tracking-[0.06em]">
                {group.label}
              </span>
              {" · "}
              {group.stats.map((stat) => stat.shortLabel).join(" / ")}
            </span>
            <strong className="shrink-0 whitespace-nowrap text-[10px] font-black tabular-nums">
              {formatWeight(group.weight)} %
            </strong>
          </div>
        ))}
      </div>
    </details>
  );
}
