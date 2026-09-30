import {
  isReputationFeatureEnabled,
  REPUTATION_FEATURE_THRESHOLDS,
  SPONSOR_REPUTATION_INVESTMENTS,
} from "@/lib/game/reputation";

export function SponsorReputationInvestmentOptions({
  gameYear,
  reputationPoints,
}: {
  gameYear: number;
  reputationPoints: number;
}) {
  if (!isReputationFeatureEnabled(gameYear)) return null;

  return (
    <fieldset className="mb-4 rounded-xl border border-[#315B3E]/15 bg-[#F4F8F6] p-3 text-left">
      <legend className="px-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#176951]">
        Investir sa réputation
      </legend>
      <p className="mt-1 text-[10px] font-semibold leading-4 text-[#60756E]">
        Dépense définitive à la signature pour augmenter le budget annuel du contrat.
      </p>
      <div className="mt-3 grid gap-2">
        {SPONSOR_REPUTATION_INVESTMENTS.map((option) => {
          const locked = option.cost > 0 && (
            reputationPoints < REPUTATION_FEATURE_THRESHOLDS.sponsorInvestment ||
            reputationPoints < option.cost
          );
          return (
            <label
              key={option.cost}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${locked ? "cursor-not-allowed border-[#315B3E]/10 opacity-55" : "cursor-pointer border-[#315B3E]/15 bg-white"}`}
            >
              <input
                type="radio"
                name="reputationInvestmentCost"
                value={option.cost}
                defaultChecked={option.cost === 0}
                disabled={locked}
                className="mt-0.5 accent-[#176951]"
              />
              <span>
                <span className="block text-xs font-black text-[#183F37]">{option.label}</span>
                <span className="mt-0.5 block text-[10px] font-semibold leading-4 text-[#60756E]">
                  {option.cost === 0
                    ? "Aucune dépense, budget proposé inchangé."
                    : `${option.cost} points dépensés · +${option.budgetBonusPercent} % de budget par saison.`}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {reputationPoints < REPUTATION_FEATURE_THRESHOLDS.sponsorInvestment ? (
        <p className="mt-2 text-[10px] font-bold text-[#936A21]">
          Investissement disponible à {REPUTATION_FEATURE_THRESHOLDS.sponsorInvestment} points de réputation.
        </p>
      ) : null}
    </fieldset>
  );
}
