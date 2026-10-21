export type FinancialDirectorEffectKind =
  | "daily_income"
  | "staff_salary"
  | "rider_salary"
  | "main_sponsor"
  | "secondary_sponsor"
  | "race_prize";

export type FinancialDirectorEffect = {
  id: string;
  sourceTransactionId: string | null;
  dayNumber: number;
  amount: number;
  effect: FinancialDirectorEffectKind;
  baseAmount: number | null;
  bonusPercentage: number | null;
  status: "pending" | "posted";
  description: string;
};

export type FinancialDirectorProjectionRow = {
  source_reference: string;
  source_transaction_id: string | null;
  day_number: number;
  amount: number | string;
  effect: FinancialDirectorEffectKind;
  base_amount: number | string | null;
  bonus_percentage: number | string | null;
  description: string;
};

type LedgerTransaction = {
  id: string;
  sourceReference: string;
  dayNumber: number;
  amount: number;
  category: string;
  status: "pending" | "posted" | "cancelled";
  description: string;
};

export type ProjectedFinancialDirectorTransaction = LedgerTransaction & {
  category: "other";
  status: "pending";
  postedAt: null;
};

const EFFECTS = new Set<FinancialDirectorEffectKind>([
  "daily_income", "staff_salary", "rider_salary", "main_sponsor",
  "secondary_sponsor", "race_prize",
]);

/** Read-only estimates: never persist these entries or use them as available cash. */
export function buildFinancialDirectorProjection(
  ledger: readonly LedgerTransaction[],
  rows: readonly FinancialDirectorProjectionRow[],
): {
  transactions: ProjectedFinancialDirectorTransaction[];
  effects: FinancialDirectorEffect[];
} {
  // A real receipt always wins, including cancelled receipts. This also handles
  // settlement between the projection RPC and the subsequent ledger read.
  const seen = new Set(ledger.map((entry) => entry.sourceReference));
  const byId = new Map(ledger.map((entry) => [entry.id, entry]));
  const effects: FinancialDirectorEffect[] = [];
  const transactions: ProjectedFinancialDirectorTransaction[] = [];

  for (const receipt of ledger) {
    if (receipt.status === "cancelled" || receipt.amount <= 0) continue;
    const sourceId = receipt.sourceReference.match(
      /^financial-director:(?:salary-savings|bonus):(.+)$/,
    )?.[1] ?? null;
    const source = sourceId ? byId.get(sourceId) : undefined;
    const daily = receipt.sourceReference.startsWith("financial-director:daily:");
    const effect = daily ? "daily_income" : source ? classifySource(source) : null;
    if (!effect) continue;
    const baseAmount = source ? Math.abs(source.amount) : null;
    effects.push({
      id: receipt.id,
      sourceTransactionId: sourceId,
      dayNumber: receipt.dayNumber,
      amount: receipt.amount,
      effect,
      baseAmount,
      // Historical receipts use the actual credited rate, not today's DF level.
      bonusPercentage: baseAmount ? receipt.amount / baseAmount * 100 : null,
      status: receipt.status,
      description: receipt.description,
    });
  }

  for (const row of rows) {
    if (seen.has(row.source_reference)) continue;
    const amount = Number(row.amount);
    const baseAmount = row.base_amount === null ? null : Number(row.base_amount);
    const bonusPercentage = row.bonus_percentage === null ? null : Number(row.bonus_percentage);
    if (!row.source_reference.startsWith("financial-director:")
      || !EFFECTS.has(row.effect)
      || !Number.isInteger(row.day_number) || row.day_number < 1 || row.day_number > 28
      || !Number.isFinite(amount) || amount <= 0
      || (baseAmount !== null && (!Number.isFinite(baseAmount) || baseAmount < 0))
      || (bonusPercentage !== null && (!Number.isFinite(bonusPercentage) || bonusPercentage < 0))) {
      throw new Error("Projection du directeur financier invalide.");
    }
    seen.add(row.source_reference);
    const id = `df-projection:${row.source_reference}`;
    transactions.push({
      id,
      sourceReference: row.source_reference,
      dayNumber: row.day_number,
      amount,
      category: "other",
      status: "pending",
      description: row.description,
      postedAt: null,
    });
    effects.push({
      id,
      sourceTransactionId: row.source_transaction_id,
      dayNumber: row.day_number,
      amount,
      effect: row.effect,
      baseAmount,
      bonusPercentage,
      status: "pending",
      description: row.description,
    });
  }
  return { transactions, effects };
}

function classifySource(source: LedgerTransaction): FinancialDirectorEffectKind | null {
  if (source.category === "staff_salary" && source.amount < 0) return "staff_salary";
  if (source.category === "rider_salary" && source.amount < 0) return "rider_salary";
  if (source.category === "race_prize" && source.amount > 0) return "race_prize";
  if (source.category !== "sponsor" || source.amount <= 0) return null;
  if (source.sourceReference.startsWith("secondary-sponsor-objective:")) return "secondary_sponsor";
  if (source.sourceReference.startsWith("sponsor:")) return "main_sponsor";
  return null;
}
