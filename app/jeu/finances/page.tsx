import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { FinanceBalanceChart } from "@/components/game/finance-balance-chart";
import { GameHeader } from "@/components/game/game-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamFinanceOverview,
  type FinanceCategory,
  type TeamFinanceTransaction,
} from "@/services/team-finances";

export const metadata: Metadata = {
  title: "Finances de l’équipe",
  description: "Suivez la trésorerie réelle et prévisionnelle de votre équipe.",
};

const CATEGORY_LABELS: Record<FinanceCategory, string> = {
  sponsor: "Sponsor",
  race_prize: "Prime de course",
  rider_salary: "Salaire coureur",
  staff_salary: "Salaire staff",
  equipment: "Équipement",
  building: "Infrastructure",
  transfer: "Transfert",
  training: "Entraînement",
  other: "Autre",
};

export default async function TeamFinancesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, overview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentTeamFinanceOverview(supabase, user.id),
  ]);

  if (!overview) {
    redirect("/jeu");
  }

  const gains = overview.transactions.filter(
    (transaction) => transaction.amount > 0 && transaction.status !== "cancelled"
  );
  const expenses = overview.transactions.filter(
    (transaction) => transaction.amount < 0 && transaction.status !== "cancelled"
  );
  const raceSettlements = buildRacePrizeSettlements(gains);
  const settledTransactionIds = new Set(
    raceSettlements.flatMap((settlement) =>
      settlement.transactions.map((transaction) => transaction.id)
    )
  );
  const otherGains = gains.filter(
    (transaction) => !settledTransactionIds.has(transaction.id)
  );
  const latestAlert = overview.alerts[0] ?? null;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <BackToOfficeLink />

        <header className="mt-5 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-[#FFFDF4] shadow-[0_24px_70px_rgba(19,60,46,0.18)] sm:px-10 sm:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                Direction financière · {overview.seasonName}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Trésorerie de {overview.teamName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#D6DFD2]">
                Les contrats récurrents construisent la prévision. Les primes de course et les futurs investissements ne sont ajoutés qu’une fois connus.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-6 py-5 lg:text-right">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#9BE0BC]">
                Solde disponible · J{overview.currentDayNumber}
              </p>
              <p
                className={`mt-2 text-4xl font-black ${
                  overview.balance < 0 ? "text-[#FF9D8F]" : "text-[#F2C94C]"
                }`}
              >
                {formatCurrency(overview.balance, overview.currency)}
              </p>
            </div>
          </div>
        </header>

        {latestAlert ? (
          <DebtAlert
            balance={overview.balance}
            currency={overview.currency}
            message={latestAlert.message}
            penalty={latestAlert.reputationPenalty}
          />
        ) : !overview.canSpend ? (
          <div className="mt-6 rounded-2xl border border-[#D29F32]/35 bg-[#FFF5D8] px-5 py-4 text-sm font-bold text-[#76530D]">
            Votre solde est nul : les dépenses volontaires sont bloquées jusqu’au premier versement ou gain.
          </div>
        ) : null}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FinanceMetric
            label="Solde actuel"
            value={formatCurrency(overview.balance, overview.currency)}
            detail={`Situation constatée à J${overview.currentDayNumber}`}
            negative={overview.balance < 0}
          />
          <FinanceMetric
            label="Fin de saison prévue"
            value={formatCurrency(overview.projectedBalance, overview.currency)}
            detail="Hors résultats et nouvelles dépenses"
            negative={overview.projectedBalance < 0}
          />
          <FinanceMetric
            label="Gains prévus"
            value={formatCurrency(overview.totalIncome, overview.currency)}
            detail="Sponsor et primes déjà enregistrées"
          />
          <FinanceMetric
            label="Charges prévues"
            value={formatCurrency(overview.totalExpenses, overview.currency)}
            detail="Coureurs, staff et dépenses connues"
          />
        </section>

        <section className="mt-7">
          <FinanceBalanceChart
            points={overview.chart}
            currentDayNumber={overview.currentDayNumber}
            currency={overview.currency}
          />
        </section>

        {raceSettlements.length > 0 ? (
          <RacePrizeSettlements
            settlements={raceSettlements}
            currency={overview.currency}
          />
        ) : null}

        <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
          <div className="border-b border-[#315B3E]/10 px-6 py-6 sm:px-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
              Registre de la saison
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#183F37]">
              Gains et pertes
            </h2>
          </div>

          <div className="grid lg:grid-cols-2">
            <TransactionColumn
              title="Gains"
              transactions={otherGains}
              currency={overview.currency}
              positive
            />
            <TransactionColumn
              title="Pertes"
              transactions={expenses}
              currency={overview.currency}
            />
          </div>
        </section>
      </section>
    </main>
  );
}

function FinanceMetric({
  label,
  value,
  detail,
  negative = false,
}: {
  label: string;
  value: string;
  detail: string;
  negative?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/15 bg-[#0B302B] p-5 text-[#FFFDF4] shadow-[0_12px_30px_rgba(7,26,23,0.12)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#9BE0BC]">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-black ${negative ? "text-[#FF9D8F]" : "text-[#F2C94C]"}`}>
        {value}
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#BFD1C6]">{detail}</p>
    </article>
  );
}

type RacePrizeSettlement = {
  editionId: string;
  raceName: string;
  dayNumber: number;
  postedAt: string | null;
  total: number;
  transactions: TeamFinanceTransaction[];
};

function RacePrizeSettlements({
  settlements,
  currency,
}: {
  settlements: RacePrizeSettlement[];
  currency: string;
}) {
  return (
    <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#F2C94C]/35 bg-[#0B302B] text-[#FFFDF4] shadow-[0_20px_55px_rgba(7,26,23,0.16)]">
      <div className="border-b border-white/10 px-6 py-6 sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#9BE0BC]">
          Règlements de fin de tour
        </p>
        <h2 className="mt-2 text-2xl font-black">
          Toutes les primes versées à l’arrivée
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#BFD1C6]">
          Les gains des étapes, du classement général et des classements annexes
          sont crédités ensemble après la dernière étape. Ouvrez un règlement pour
          consulter chaque ligne.
        </p>
      </div>

      <div className="space-y-3 p-5 sm:p-7">
        {settlements.map((settlement) => (
          <details
            key={settlement.editionId}
            className="group rounded-2xl border border-white/10 bg-white/[0.055] open:bg-white/[0.08]"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72D4B7]">
              <span>
                <span className="block text-lg font-black">{settlement.raceName}</span>
                <span className="mt-1 block text-xs font-bold uppercase tracking-wider text-[#9BE0BC]">
                  J{settlement.dayNumber} · {settlement.transactions.length} ligne{settlement.transactions.length > 1 ? "s" : ""} · versé en une fois
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-xl font-black text-[#F2C94C]">
                  +{formatCurrency(settlement.total, currency)}
                </span>
                <span aria-hidden="true" className="text-[#9BE0BC] transition group-open:rotate-180">⌄</span>
              </span>
            </summary>

            <div className="border-t border-white/10 px-5 py-4">
              {settlement.transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start justify-between gap-4 border-b border-white/10 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-6 text-[#E8F2ED]">
                      {transaction.description}
                    </p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-[#89AA9D]">
                      Prime de course · {formatStatus(transaction.status)}
                    </p>
                  </div>
                  <p className="shrink-0 font-black text-[#72D4B7]">
                    +{formatCurrency(transaction.amount, currency)}
                  </p>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function TransactionColumn({
  title,
  transactions,
  currency,
  positive = false,
}: {
  title: string;
  transactions: TeamFinanceTransaction[];
  currency: string;
  positive?: boolean;
}) {
  return (
    <div className="border-[#315B3E]/10 p-6 first:border-b lg:first:border-b-0 lg:first:border-r sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-black text-[#183F37]">{title}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${
            positive
              ? "bg-[#DDF3E7] text-[#176951]"
              : "bg-[#FCE5DF] text-[#A44736]"
          }`}
        >
          {transactions.length} ligne{transactions.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-start justify-between gap-4 border-b border-[#315B3E]/10 pb-3 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="font-bold text-[#183F37]">{transaction.description}</p>
                <p className="mt-1 text-xs font-semibold text-[#60756E]">
                  J{transaction.dayNumber} · {CATEGORY_LABELS[transaction.category]} · {formatStatus(transaction.status)}
                </p>
              </div>
              <p className={`shrink-0 font-black ${positive ? "text-[#176951]" : "text-[#A44736]"}`}>
                {positive ? "+" : "−"}
                {formatCurrency(Math.abs(transaction.amount), currency)}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-[#315B3E]/20 bg-[#EAF5F3]/45 px-4 py-6 text-sm font-semibold text-[#60756E]">
            Aucun mouvement dans cette colonne.
          </p>
        )}
      </div>
    </div>
  );
}

function buildRacePrizeSettlements(
  transactions: TeamFinanceTransaction[]
): RacePrizeSettlement[] {
  const settlements = new Map<
    string,
    RacePrizeSettlement & { hasStagePrize: boolean }
  >();

  for (const transaction of transactions) {
    if (transaction.category !== "race_prize") continue;
    const match = transaction.sourceReference.match(
      /^reward:official-(race|stage-prize):([^:]+)/
    );
    if (!match) continue;

    const [, rewardType, editionId] = match;
    const raceName = transaction.description.split(" — ")[0]?.trim() || "Tour";
    const current = settlements.get(editionId) ?? {
      editionId,
      raceName,
      dayNumber: transaction.dayNumber,
      postedAt: transaction.postedAt,
      total: 0,
      transactions: [],
      hasStagePrize: false,
    };
    current.total += transaction.amount;
    current.transactions.push(transaction);
    current.dayNumber = Math.max(current.dayNumber, transaction.dayNumber);
    current.postedAt = [current.postedAt, transaction.postedAt]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    current.hasStagePrize ||= rewardType === "stage-prize";
    settlements.set(editionId, current);
  }

  return [...settlements.values()]
    .filter((settlement) => settlement.hasStagePrize)
    .map((settlement) => ({
      editionId: settlement.editionId,
      raceName: settlement.raceName,
      dayNumber: settlement.dayNumber,
      postedAt: settlement.postedAt,
      total: settlement.total,
      transactions: [...settlement.transactions].sort(
        (left, right) =>
          left.description.localeCompare(right.description, "fr") ||
          left.id.localeCompare(right.id)
      ),
    }))
    .sort((left, right) =>
      (right.postedAt ?? "").localeCompare(left.postedAt ?? "") ||
      right.dayNumber - left.dayNumber
    );
}

function DebtAlert({
  balance,
  currency,
  message,
  penalty,
}: {
  balance: number;
  currency: string;
  message: string;
  penalty: number;
}) {
  const gauge = Math.min(100, Math.max(8, (Math.abs(Math.min(0, balance)) / 100_000) * 100));

  return (
    <aside className="mt-6 rounded-2xl border border-[#C75E4A]/35 bg-[#FFF0EC] p-5 text-[#713329]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#A44736]">
            Alerte dette
          </p>
          <p className="mt-2 font-bold leading-6">{message}</p>
          {penalty > 0 ? (
            <p className="mt-1 text-sm font-black">Pénalité appliquée : −{penalty} réputation.</p>
          ) : null}
        </div>
        <p className="shrink-0 text-2xl font-black text-[#A44736]">
          {formatCurrency(balance, currency)}
        </p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E9C7BF]" aria-label="Niveau d’endettement">
        <div className="h-full rounded-full bg-[#C75E4A]" style={{ width: `${gauge}%` }} />
      </div>
    </aside>
  );
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatStatus(status: TeamFinanceTransaction["status"]): string {
  if (status === "posted") return "comptabilisé";
  if (status === "pending") return "prévu";
  return "annulé";
}
