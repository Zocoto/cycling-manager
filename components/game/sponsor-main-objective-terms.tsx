import type { SponsorMainObjectiveTerms } from "@/lib/game/sponsor-main-objective";

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function SponsorMainObjectiveTermsCard({
  terms,
  compact = false,
}: {
  terms: SponsorMainObjectiveTerms | null;
  compact?: boolean;
}) {
  if (!terms) return null;

  return (
    <aside
      className={[
        "rounded-lg border border-amber-300 bg-amber-50 text-amber-950",
        compact ? "mt-2 px-3 py-2" : "mt-3 px-4 py-3",
      ].join(" ")}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-amber-800">
        Objectif principal
      </p>
      <p className="mt-1 text-xs font-black leading-5">
        Réussite : +{moneyFormatter.format(terms.cashReward)} immédiatement
      </p>
      <p className="text-xs font-black leading-5 text-red-700">
        Échec : −{terms.reputationPenalty} points de réputation
      </p>
    </aside>
  );
}
