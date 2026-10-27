import {
  FinancialDirectorSourceImpact,
  getFinancialDirectorTransactionLabel,
} from "@/components/game/financial-director-impact";
import type {
  FinanceCategory,
  FinancialDirectorEffect,
  TeamFinanceTransaction,
} from "@/services/team-finances";

const CATEGORY_LABELS: Record<FinanceCategory, string> = {
  sponsor: "Sponsor",
  race_prize: "Prime de course",
  rider_salary: "Salaire coureur",
  staff_salary: "Salaire staff",
  equipment: "Équipement",
  building: "Infrastructure",
  transfer: "Transfert",
  training: "Entraînement",
  medical_care: "Soins médicaux",
  other: "Autre",
};

type RacePrizeGroup = {
  key: string;
  name: string;
  status: "pending" | "posted";
  dayNumber: number;
  totalCents: number;
  transactions: TeamFinanceTransaction[];
};

type TransactionEntry =
  | { kind: "transaction"; transaction: TeamFinanceTransaction }
  | { kind: "race"; group: RacePrizeGroup };

/** A presentation of existing ledger rows; grouping never creates a receipt. */
export function FinanceTransactionColumn({
  title,
  transactions,
  currency,
  positive = false,
  financialDirectorEffects,
}: {
  title: string;
  transactions: readonly TeamFinanceTransaction[];
  currency: string;
  positive?: boolean;
  financialDirectorEffects: readonly FinancialDirectorEffect[];
}) {
  const visibleTransactions = transactions.filter((transaction) => transaction.status !== "cancelled");
  const entries = buildEntries(visibleTransactions, positive);
  const effectsBySource = new Map<string, FinancialDirectorEffect[]>();
  const creditEffects = new Map<string, FinancialDirectorEffect>();
  for (const effect of financialDirectorEffects) {
    creditEffects.set(effect.id, effect);
    if (!effect.sourceTransactionId) continue;
    const sourceEffects = effectsBySource.get(effect.sourceTransactionId) ?? [];
    sourceEffects.push(effect);
    effectsBySource.set(effect.sourceTransactionId, sourceEffects);
  }

  function renderTransaction(transaction: TeamFinanceTransaction) {
    return (
      <TransactionRow
        key={transaction.id}
        transaction={transaction}
        currency={currency}
        positive={positive}
        sourceEffects={effectsBySource.get(transaction.id) ?? []}
        creditEffect={creditEffects.get(transaction.id)}
      />
    );
  }

  return (
    <div className="border-[#315B3E]/10 p-6 first:border-b lg:first:border-b-0 lg:first:border-r sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-black text-[#183F37]">{title}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${positive ? "bg-[#DDF3E7] text-[#176951]" : "bg-[#FCE5DF] text-[#A44736]"}`}>
          {visibleTransactions.length} ligne{visibleTransactions.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {entries.length > 0 ? entries.map((entry) => {
          if (entry.kind === "transaction") return renderTransaction(entry.transaction);
          const { group } = entry;
          const pending = group.status === "pending";
          return (
            <details key={group.key} className={`group overflow-hidden rounded-xl border ${pending ? "border-[#A7B0AC]/25 bg-[#EEF1EF]" : "border-[#315B3E]/12 bg-[#F3F8F5]"}`}>
              <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]">
                <span className="min-w-0">
                  <span className={`block font-black ${pending ? "text-[#7B8581]" : "text-[#183F37]"}`}>{group.name}</span>
                  <span className={`mt-1 block text-xs font-semibold ${pending ? "text-[#8D9692]" : "text-[#60756E]"}`}>
                    J{group.dayNumber} · {group.transactions.length} primes · {pending ? "À recevoir · non encaissé" : "Déjà encaissé · inclus dans le solde"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`shrink-0 font-black ${pending ? "text-[#8D9692]" : "text-[#176951]"}`}>+{formatCurrency(group.totalCents / 100, currency)}</span>
                  <span aria-hidden="true" className="text-[#60756E] transition group-open:rotate-180">⌄</span>
                </span>
              </summary>
              <div className="space-y-3 border-t border-[#315B3E]/10 px-4 py-4">
                {group.transactions.map(renderTransaction)}
              </div>
            </details>
          );
        }) : (
          <p className="rounded-xl border border-dashed border-[#315B3E]/20 bg-[#EAF5F3]/45 px-4 py-6 text-sm font-semibold text-[#60756E]">
            Aucun mouvement dans cette colonne.
          </p>
        )}
      </div>
    </div>
  );
}

function TransactionRow({
  transaction,
  currency,
  positive,
  sourceEffects,
  creditEffect,
}: {
  transaction: TeamFinanceTransaction;
  currency: string;
  positive: boolean;
  sourceEffects: readonly FinancialDirectorEffect[];
  creditEffect?: FinancialDirectorEffect;
}) {
  const pending = transaction.status === "pending";
  return (
    <div className={`border-b pb-3 last:border-b-0 last:pb-0 ${pending ? "rounded-xl border-[#A7B0AC]/25 bg-[#EEF1EF] px-3 py-3 last:pb-3" : "border-[#315B3E]/10"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`font-bold ${pending ? "text-[#7B8581]" : "text-[#183F37]"}`}>{transaction.description}</p>
          <p className={`mt-1 text-xs font-semibold ${pending ? "text-[#8D9692]" : "text-[#60756E]"}`}>
            J{transaction.dayNumber} · {creditEffect ? getFinancialDirectorTransactionLabel(creditEffect) : CATEGORY_LABELS[transaction.category]} · {pending
              ? positive ? "À recevoir · non encaissé" : "À payer · non débité"
              : positive ? "Encaissé" : "Payé"}
          </p>
        </div>
        <p className={`shrink-0 font-black ${pending ? "text-[#8D9692]" : positive ? "text-[#176951]" : "text-[#A44736]"}`}>
          {!positive && sourceEffects.length > 0 ? <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#60756E]">Dépense brute</span> : null}
          {positive ? "+" : "−"}{formatCurrency(Math.abs(transaction.amount), currency)}
        </p>
      </div>
      <FinancialDirectorSourceImpact effects={sourceEffects} baseAmount={transaction.amount} currency={currency} expense={!positive} />
    </div>
  );
}

function buildEntries(transactions: readonly TeamFinanceTransaction[], positive: boolean): TransactionEntry[] {
  if (!positive) return transactions.map((transaction) => ({ kind: "transaction", transaction }));
  const groups = new Map<string, RacePrizeGroup>();
  const groupKeys = new Map<string, string>();
  for (const transaction of transactions) {
    const editionId = getOfficialRaceEditionId(transaction);
    if (editionId === null || transaction.status === "cancelled") continue;
    const key = `${editionId}:${transaction.status}`;
    const group = groups.get(key) ?? {
      key,
      name: transaction.description.split(" — ")[0]?.trim() || "Course",
      status: transaction.status,
      dayNumber: transaction.dayNumber,
      totalCents: 0,
      transactions: [],
    };
    group.totalCents += Math.round(transaction.amount * 100);
    group.dayNumber = Math.max(group.dayNumber, transaction.dayNumber);
    group.transactions.push(transaction);
    groups.set(key, group);
    groupKeys.set(transaction.id, key);
  }
  const emitted = new Set<string>();
  return transactions.flatMap((transaction): TransactionEntry[] => {
    const key = groupKeys.get(transaction.id);
    const group = key ? groups.get(key) : undefined;
    if (!group || group.transactions.length < 2) return [{ kind: "transaction", transaction }];
    if (emitted.has(group.key)) return [];
    emitted.add(group.key);
    return [{ kind: "race", group }];
  });
}

function getOfficialRaceEditionId(transaction: TeamFinanceTransaction): string | null {
  if (transaction.category !== "race_prize" || transaction.amount <= 0
    || !Number.isSafeInteger(Math.round(transaction.amount * 100))) return null;
  // Only group the exact references emitted by the official reward services.
  // Unknown or older formats stay visible as individual ledger entries.
  return transaction.sourceReference.match(
    /^reward:official-(?:race:([^:]+):rider:[^:]+|stage-prize:([^:]+):stage:[^:]+:rider:[^:]+|ttt-stage:([^:]+):stage:[^:]+:team-season:[^:]+|combativity:([^:]+):(?:stage:[^:]+|overall):rider:[^:]+):v\d+$/,
  )?.slice(1).find((editionId) => editionId !== undefined) ?? null;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}
