import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { FinanceBalanceChart } from "@/components/game/finance-balance-chart";
import { FinanceExpenseAnalysisPanel } from "@/components/game/finance-expense-analysis";
import { FinanceIncomeAnalysisPanel } from "@/components/game/finance-income-analysis";
import { FinanceTransactionColumn } from "@/components/game/finance-transaction-column";
import { FinancialDirectorImpact } from "@/components/game/financial-director-impact";
import { GameHeader } from "@/components/game/game-header";
import {
  GameSectionTabLink,
  GameSectionTabs,
} from "@/components/game/game-section-tabs";
import { buildFinanceExpenseAnalysis } from "@/lib/game/finance-expense-analysis";
import { buildFinanceIncomeAnalysis } from "@/lib/game/finance-income-analysis";
import {
  getDebtAmount,
  getNextFinancialCheckpointDay,
} from "@/lib/game/team-finance-alerts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamFinanceOverview,
  type FinancialDirectorEffect,
  type TeamFinanceTransaction,
} from "@/services/team-finances";

export const metadata: Metadata = {
  title: "Finances de l’équipe",
  description: "Suivez la trésorerie réelle et prévisionnelle de votre équipe.",
};

type TeamFinancesPageProps = {
  searchParams: Promise<{ onglet?: string | string[] }>;
};

export default async function TeamFinancesPage({
  searchParams,
}: TeamFinancesPageProps) {
  const query = await searchParams;
  const activeTab =
    readSearchValue(query.onglet) === "analyse-depenses"
      ? "expenses"
      : readSearchValue(query.onglet) === "analyse-recettes"
      ? "income"
      : "treasury";
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

  const incomeAnalysis = buildFinanceIncomeAnalysis(overview.transactions);
  const expenseAnalysis = buildFinanceExpenseAnalysis(overview.transactions);
  const pendingTransactions = overview.transactions.filter(
    (transaction) => transaction.status === "pending"
  );
  const postedTransactions = overview.transactions.filter(
    (transaction) => transaction.status === "posted"
  );
  const latestAlert = overview.alerts[0] ?? null;
  const financialDirectorEffects = overview.financialDirectorEffects ?? [];

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorVisual}
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
                Le solde disponible comprend les opérations déjà comptabilisées.
                La prévision ajoute uniquement les recettes et dépenses encore à venir.
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
            debtAmount={getDebtAmount(latestAlert.balance)}
            currency={overview.currency}
            message={latestAlert.message}
            penalty={latestAlert.reputationPenalty}
            nextCheckpointDay={getNextFinancialCheckpointDay(
              latestAlert.checkpointDayNumber
            )}
          />
        ) : !overview.canSpend ? (
          <div className="mt-6 rounded-2xl border border-[#D29F32]/35 bg-[#FFF5D8] px-5 py-4 text-sm font-bold text-[#76530D]">
            Votre solde est nul : les dépenses volontaires sont bloquées jusqu’au premier versement ou gain.
          </div>
        ) : null}

        <FinanceTabs activeTab={activeTab} />

        {activeTab === "expenses" ? (
          <>
            <FinanceExpenseAnalysisPanel
              analysis={expenseAnalysis}
              currency={overview.currency}
              seasonName={overview.seasonName}
            />
            <FinancialDirectorImpact effects={financialDirectorEffects} currency={overview.currency} />
          </>
        ) : activeTab === "income" ? (
          <>
            <FinanceIncomeAnalysisPanel
              analysis={incomeAnalysis}
              currency={overview.currency}
              seasonName={overview.seasonName}
            />
            <FinancialDirectorImpact effects={financialDirectorEffects} currency={overview.currency} />
          </>
        ) : (
          <>
            <section className="mt-7 grid gap-4 sm:grid-cols-3" aria-label="Prévision des opérations restantes">
              <FinanceMetric
                label="Encore à recevoir"
                value={formatCurrency(incomeAnalysis.pendingAmount, overview.currency)}
                detail="Recettes non encaissées, apports prévisibles du DF inclus"
              />
              <FinanceMetric
                label="Encore à payer"
                value={formatCurrency(expenseAnalysis.pendingAmount, overview.currency)}
                detail="Charges non débitées, avant crédits d’économie du DF"
              />
              <FinanceMetric
                label="Solde de fin de saison estimé"
                value={formatCurrency(overview.projectedBalance, overview.currency)}
                detail="Solde actuel + recettes à recevoir − dépenses à payer"
                negative={overview.projectedBalance < 0}
              />
            </section>

            <p className="mt-3 px-1 text-xs font-semibold leading-5 text-[#60756E]">
              La prévision repose sur les engagements connus et les contrats actuels.
              Les résultats futurs, les ventes et les nouveaux achats restent à ajouter lorsqu’ils sont connus.
            </p>

            <FinancialDirectorImpact effects={financialDirectorEffects} currency={overview.currency} />

            <section className="mt-7">
              <FinanceBalanceChart
                points={overview.chart}
                currentDayNumber={overview.currentDayNumber}
                currency={overview.currency}
              />
            </section>

            <FinanceLedgerSection
              status="pending"
              transactions={pendingTransactions}
              currency={overview.currency}
              financialDirectorEffects={financialDirectorEffects}
              income={incomeAnalysis.pendingAmount}
              expenses={expenseAnalysis.pendingAmount}
            />
            <FinanceLedgerSection
              status="posted"
              transactions={postedTransactions}
              currency={overview.currency}
              financialDirectorEffects={financialDirectorEffects}
              income={incomeAnalysis.postedAmount}
              expenses={expenseAnalysis.postedAmount}
            />

            <details className="mt-7 rounded-2xl border border-[#315B3E]/15 bg-white px-5 py-5 sm:px-8">
              <summary className="cursor-pointer text-sm font-black text-[#183F37]">
                Bilan complet de la saison · encaissé et à venir
              </summary>
              <p className="mt-3 text-xs font-semibold leading-5 text-[#60756E]">
                Ces totaux couvrent toute la saison. L’historique est conservé pour suivre les versements déjà inclus dans le solde.
              </p>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                <div><dt className="font-bold text-[#60756E]">Allocation de départ</dt><dd className="mt-1 font-black">{formatCurrency(overview.openingBalance, overview.currency)}</dd></div>
                <div><dt className="font-bold text-[#60756E]">Recettes · encaissé + à recevoir</dt><dd className="mt-1 font-black text-[#176951]">{formatCurrency(incomeAnalysis.totalAmount, overview.currency)}</dd></div>
                <div><dt className="font-bold text-[#60756E]">Dépenses brutes · payé + à payer</dt><dd className="mt-1 font-black text-[#A44736]">{formatCurrency(expenseAnalysis.totalAmount, overview.currency)}</dd></div>
              </dl>
            </details>
          </>
        )}
      </section>
    </main>
  );
}

function FinanceTabs({
  activeTab,
}: {
  activeTab: "treasury" | "expenses" | "income";
}) {
  const tabs = [
    {
      key: "treasury" as const,
      href: "/jeu/finances",
      label: "Trésorerie",
      detail: "Solde, projection et registre",
    },
    {
      key: "expenses" as const,
      href: "/jeu/finances?onglet=analyse-depenses",
      label: "Analyse des dépenses",
      detail: "Répartition complète des charges",
    },
    {
      key: "income" as const,
      href: "/jeu/finances?onglet=analyse-recettes",
      label: "Analyse des recettes",
      detail: "Origine des revenus de l’équipe",
    },
  ];

  return (
    <GameSectionTabs
      ariaLabel="Rubriques financières"
      columns={3}
      className="mt-7"
    >
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <GameSectionTabLink
            key={tab.key}
            href={tab.href}
            active={active}
            label={tab.label}
            description={tab.detail}
          />
        );
      })}
    </GameSectionTabs>
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

function FinanceLedgerSection({
  status,
  transactions,
  currency,
  financialDirectorEffects,
  income,
  expenses,
}: {
  status: "pending" | "posted";
  transactions: TeamFinanceTransaction[];
  currency: string;
  financialDirectorEffects: readonly FinancialDirectorEffect[];
  income: number;
  expenses: number;
}) {
  const pending = status === "pending";
  return (
    <details
      id={pending ? "operations-a-venir" : "historique-financier"}
      open={pending}
      className="group/ledger mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-6 py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] sm:px-8">
        <span>
          <span className="block text-xl font-black text-[#183F37]">
            {pending ? "À venir · non comptabilisé" : "Historique · déjà comptabilisé"}
          </span>
          <span className="mt-2 block max-w-3xl text-xs font-semibold leading-5 text-[#60756E]">
            {pending
              ? "Ces montants restent à recevoir ou à payer. Ils sont inclus uniquement dans la projection."
              : "Ces opérations sont déjà incluses dans le solde actuel. Retrouvez ici les primes des courses d’un jour et des tours terminés."}
          </span>
        </span>
        <span className="flex items-center gap-4">
          <span className="text-right text-xs font-bold leading-6">
            <span className="block text-[#176951]">{pending ? "À recevoir" : "Encaissé"} · +{formatCurrency(income, currency)}</span>
            <span className="block text-[#A44736]">{pending ? "À payer" : "Payé"} · −{formatCurrency(expenses, currency)}</span>
          </span>
          <span aria-hidden="true" className="text-[#278B70] transition group-open/ledger:rotate-180">⌄</span>
        </span>
      </summary>
      <div className="border-t border-[#315B3E]/10 px-6 py-4 text-xs font-semibold leading-5 text-[#60756E] sm:px-8">
        {pending
          ? "Les primes d’un tour en cours seront enregistrées après sa dernière étape homologuée. Les résultats encore inconnus ne sont pas estimés."
          : "Les primes d’un tour sont versées après sa dernière étape homologuée. Elles restent consultables ici une fois encaissées."}
        {" "}Les dépenses sont affichées avant DF ; ses économies apparaissent en crédits dans les recettes.
      </div>
      <div className="grid border-t border-[#315B3E]/10 lg:grid-cols-2">
        <FinanceTransactionColumn
          title="Recettes"
          transactions={transactions.filter((transaction) => transaction.amount > 0)}
          currency={currency}
          positive
          financialDirectorEffects={financialDirectorEffects}
        />
        <FinanceTransactionColumn
          title="Dépenses brutes"
          transactions={transactions.filter((transaction) => transaction.amount < 0)}
          currency={currency}
          financialDirectorEffects={financialDirectorEffects}
        />
      </div>
    </details>
  );
}

function DebtAlert({
  debtAmount,
  currency,
  message,
  penalty,
  nextCheckpointDay,
}: {
  debtAmount: number;
  currency: string;
  message: string;
  penalty: number;
  nextCheckpointDay: number | null;
}) {
  const gauge = Math.min(100, Math.max(8, (debtAmount / 100_000) * 100));

  return (
    <aside className="mt-6 rounded-2xl border border-[#C75E4A]/35 bg-[#FFF0EC] p-5 text-[#713329]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#A44736]">
            Alerte dette
          </p>
          <p className="mt-2 font-bold leading-6">{message}</p>
          {nextCheckpointDay ? (
            <p className="mt-1 text-sm font-bold">
              À rembourser avant le prochain contrôle financier à J{nextCheckpointDay}.
            </p>
          ) : null}
          {penalty > 0 ? (
            <p className="mt-1 text-sm font-black">Pénalité appliquée : −{penalty} réputation.</p>
          ) : null}
        </div>
        <p className="shrink-0 text-2xl font-black text-[#A44736]">
          {formatCurrency(debtAmount, currency)}
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function readSearchValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
