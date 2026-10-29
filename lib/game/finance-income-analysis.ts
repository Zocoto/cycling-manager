export const FINANCE_INCOME_CATEGORY_DEFINITIONS = [
  { key: "sponsors", label: "Sponsors", description: "Versements et primes des partenaires principaux et secondaires", color: "#176951" },
  { key: "races", label: "Courses", description: "Primes d’étapes, classements et compétitions", color: "#F2C94C" },
  { key: "junior_races", label: "Courses juniors", description: "Primes des compétitions du centre de formation", color: "#4D8794" },
  { key: "objectives", label: "Objectifs accomplis", description: "Récompenses des objectifs et du parcours du débutant", color: "#8C4D2E" },
  { key: "rivalries", label: "Rivalités", description: "Primes gagnées dans les duels entre équipes", color: "#C14B4B" },
  { key: "federation_aid", label: "Aides de la fédération", description: "Versements du fonds de solidarité national", color: "#7C8037" },
  { key: "team_aid", label: "Aides à l’équipe", description: "Coups de pouce pour les effectifs réduits", color: "#9580C2" },
  { key: "season_prizes", label: "Primes de fin de saison", description: "Primes de classement des nouveaux DS et de division", color: "#C4A255" },
  { key: "shop", label: "Boutique", description: "Ventes de produits et de maillots aux supporters", color: "#42B99A" },
  { key: "transfers", label: "Transferts", description: "Recettes des ventes de coureurs", color: "#2E6F9E" },
  { key: "asset_sales", label: "Reventes de matériel et véhicules", description: "Reprises d’équipement et ventes de véhicules du Fan Club", color: "#E58B3A" },
  { key: "financial_director", label: "Direction financière", description: "Revenus quotidiens, économies salariales et bonus du Directeur financier", color: "#7A68A6" },
  { key: "rewards", label: "Récompenses et parrainage", description: "Trophées, découvertes et autres récompenses hors courses", color: "#C76AA5" },
  { key: "refunds", label: "Remboursements", description: "Restitutions de dépenses, distinctes des revenus d’activité", color: "#72D4B7" },
  { key: "other", label: "Autres recettes", description: "Autres rentrées d’argent enregistrées dans la saison", color: "#789087" },
] as const;

export type FinanceIncomeCategoryKey = (typeof FINANCE_INCOME_CATEGORY_DEFINITIONS)[number]["key"];
export type FinanceIncomeSourceTransaction = {
  id: string;
  amount: number;
  category: string;
  status: "pending" | "posted" | "cancelled";
  sourceReference: string;
  description?: string;
};
export type FinanceIncomeDetail = {
  label: string;
  amount: number;
  postedAmount: number;
  pendingAmount: number;
  transactionCount: number;
};
export type FinanceIncomeBreakdownItem = {
  key: FinanceIncomeCategoryKey;
  label: string;
  description: string;
  color: string;
  amount: number;
  postedAmount: number;
  pendingAmount: number;
  percentage: number;
  transactionCount: number;
  details?: FinanceIncomeDetail[];
};
export type FinanceIncomeAnalysis = {
  totalAmount: number;
  postedAmount: number;
  pendingAmount: number;
  sponsorAmount: number;
  sponsorPercentage: number;
  breakdown: FinanceIncomeBreakdownItem[];
};

export function classifyFinanceIncome(
  transaction: Pick<FinanceIncomeSourceTransaction, "category" | "sourceReference">,
): FinanceIncomeCategoryKey {
  const source = transaction.sourceReference.trim().toLowerCase();
  // A reimbursement retains the original expense category in the ledger.
  if (/(?:^|[-:_])(?:refund|reimbursement)(?:[-:_]|$)/.test(source)) return "refunds";
  if (source.startsWith("financial-director:")) return "financial_director";
  if (source.startsWith("fan-club:sales:")) return "shop";
  if (source.startsWith("fan-club:car:sale:") || source.startsWith("equipment-resale:")) return "asset_sales";
  if (source.startsWith("sponsor:") || source.startsWith("sponsor-main-objective:") ||
    source.startsWith("secondary-sponsor-objective:") || source.startsWith("reward:sponsor-objective:")) return "sponsors";
  const rewardSource = source.startsWith("reward:") ? source.slice("reward:".length) : source;
  if (rewardSource.startsWith("objective:") || rewardSource.startsWith("newcomer-journey:")) return "objectives";
  if (rewardSource.startsWith("team-rivalry:")) return "rivalries";
  if (rewardSource.startsWith("federation-solidarity:")) return "federation_aid";
  if (rewardSource.startsWith("understaffed-roster-aid:")) return "team_aid";
  if (rewardSource.startsWith("rookie-season-reward:") || rewardSource.startsWith("division-bonus:")) return "season_prizes";
  if (rewardSource.startsWith("development-event-reward:")) return "junior_races";
  // Generic reward payments also use race_prize, even for non-sporting rewards.
  if (/^(?:hidden-switchback|longevity-trophy|medical-trophy|night-auction-trophy|trophy|referral|referral-reward|daily-reward):/.test(rewardSource)) return "rewards";
  if (transaction.category === "sponsor") return "sponsors";
  if (transaction.category === "race_prize") return "races";
  if (transaction.category === "transfer") return "transfers";
  if (transaction.category === "equipment") return "asset_sales";
  return "other";
}

export function buildFinanceIncomeAnalysis(
  transactions: readonly FinanceIncomeSourceTransaction[],
): FinanceIncomeAnalysis {
  const totals = new Map<FinanceIncomeCategoryKey, { posted: number; pending: number; count: number }>();
  const otherDetails = new Map<string, { posted: number; pending: number; count: number }>();
  for (const transaction of transactions) {
    if (transaction.status === "cancelled" || !Number.isFinite(transaction.amount) || transaction.amount <= 0) continue;
    // Ledger amounts have two decimal places; cents keep financial totals exact.
    const cents = Math.round(transaction.amount * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) continue;
    const key = classifyFinanceIncome(transaction);
    const total = totals.get(key) ?? { posted: 0, pending: 0, count: 0 };
    if (transaction.status === "posted") total.posted += cents;
    else total.pending += cents;
    total.count += 1;
    totals.set(key, total);
    if (key === "other") {
      const label = transaction.description?.replace(/\s+/g, " ").trim() || "Recette non précisée";
      const detail = otherDetails.get(label) ?? { posted: 0, pending: 0, count: 0 };
      if (transaction.status === "posted") detail.posted += cents;
      else detail.pending += cents;
      detail.count += 1;
      otherDetails.set(label, detail);
    }
  }
  let postedCents = 0, pendingCents = 0;
  for (const total of totals.values()) { postedCents += total.posted; pendingCents += total.pending; }
  const totalCents = postedCents + pendingCents;
  const sponsorCents = (totals.get("sponsors")?.posted ?? 0) + (totals.get("sponsors")?.pending ?? 0);
  const breakdown = FINANCE_INCOME_CATEGORY_DEFINITIONS.flatMap((definition): FinanceIncomeBreakdownItem[] => {
    const total = totals.get(definition.key);
    if (!total) return [];
    const cents = total.posted + total.pending;
    return [{ ...definition, amount: cents / 100, postedAmount: total.posted / 100,
      pendingAmount: total.pending / 100, transactionCount: total.count, percentage: cents / totalCents * 100,
      ...(definition.key === "other" ? { details: [...otherDetails].map(([label, detail]) => ({
        label, amount: (detail.posted + detail.pending) / 100, postedAmount: detail.posted / 100,
        pendingAmount: detail.pending / 100, transactionCount: detail.count,
      })).sort((left, right) => right.amount - left.amount) } : {}),
    }];
  }).sort((left, right) => right.amount - left.amount);
  return { totalAmount: totalCents / 100, postedAmount: postedCents / 100, pendingAmount: pendingCents / 100,
    sponsorAmount: sponsorCents / 100, sponsorPercentage: totalCents > 0 ? sponsorCents / totalCents * 100 : 0, breakdown };
}
