import {
  TRAINING_DOMAIN_LABELS,
  getTrainingDomainWeightGroups,
  type TrainingDomain,
  type TrainingDomainWeightTier,
} from "@/lib/game/training";

const GROUP_STYLES: Record<TrainingDomainWeightTier, string> = {
  primary: "border-[#278B70]/25 bg-[#DCEFE9] text-[#176951]",
  secondary: "border-[#D6A82B]/30 bg-[#FFF5D6] text-[#806114]",
  support: "border-[#315B3E]/12 bg-white text-[#60756E]",
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

  return (
    <section
      aria-label={`Répartition du gain pour le profil ${TRAINING_DOMAIN_LABELS[domain]}`}
      className={`rounded-xl border border-[#315B3E]/10 bg-[#F7FAF8] p-3 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#315B3E]">
          Répartition du gain · {TRAINING_DOMAIN_LABELS[domain]}
        </p>
        <p className="text-[9px] font-semibold text-[#60756E]">
          Poids appliqué au gain de base
        </p>
      </div>
      <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-2">
        {groups.map((group) => (
          <div
            key={group.tier}
            className={`min-w-0 rounded-lg border px-2.5 py-2 ${GROUP_STYLES[group.tier]}`}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <span className="min-w-0 break-words text-[9px] font-black uppercase leading-4 tracking-[0.06em]">
                {group.label}
              </span>
              <strong className="shrink-0 whitespace-nowrap text-[11px] font-black tabular-nums">
                {formatWeight(group.weight)} %
              </strong>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {group.stats.map((stat) => (
                <span
                  key={stat.key}
                  title={stat.label}
                  className="rounded-md bg-white/75 px-1.5 py-0.5 text-[9px] font-black"
                >
                  {stat.shortLabel}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9px] font-semibold leading-4 text-[#60756E]">
        Le gain réel varie ensuite selon l’intensité, l’âge, le potentiel, le
        niveau actuel et les bonus d’encadrement.
      </p>
    </section>
  );
}
