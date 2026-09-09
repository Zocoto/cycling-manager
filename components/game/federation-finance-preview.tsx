"use client";

import { useActionState, useMemo, useState } from "react";

import {
  donateToFederationAction,
  executeFederationSolidarityAction,
} from "@/app/jeu/federations/finance-actions";

import { initialFederationFinanceActionState } from "@/lib/game/federation-action-states";
import {
  calculateFederationFinancePreview,
  getFederationObjectiveBonusPercentage,
  getFederationObjectiveLevel,
} from "@/lib/game/federation-finance-preview";
import type { FederationFinanceBaseline } from "@/services/federation-finances";
import type { FederationTreasuryState } from "@/services/federation-treasury";

type Props = {
  initialNationRank: number;
  initialDivision: 1 | 2 | 3 | 4;
  baseline: FederationFinanceBaseline;
  countryCode: string;
  gameYear: number;
  treasuryState: FederationTreasuryState | null;
  completedObjectiveCount: number;
};

const money = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const compactMoney = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function FederationFinancePreview({
  initialNationRank,
  initialDivision,
  baseline,
  countryCode,
  gameYear,
  treasuryState,
  completedObjectiveCount,
}: Props) {
  const projectedRaceDays = Math.min(
    40,
    baseline.completedRaceDays === 0
      ? 0
      : Math.max(
          baseline.completedRaceDays,
          Math.round(
            (baseline.completedRaceDays * 28) /
              Math.max(1, baseline.observedThroughDay),
          ),
        ),
  );
  const objectiveLevel =
    treasuryState?.account?.objectiveLevel ??
    getFederationObjectiveLevel(completedObjectiveCount);
  const objectiveCount =
    treasuryState?.account?.objectiveCompletedCount ?? completedObjectiveCount;
  const objectiveBonusPercentage =
    getFederationObjectiveBonusPercentage(objectiveLevel);
  const projection = useMemo(
    () =>
      calculateFederationFinancePreview({
        nationRank: initialNationRank,
        division: initialDivision,
        raceDays: projectedRaceDays,
        averageStarters: baseline.averageStarters,
        donations: 0,
        objectiveLevel,
      }),
    [
      baseline.averageStarters,
      initialDivision,
      initialNationRank,
      objectiveLevel,
      projectedRaceDays,
    ],
  );
  const [reputationThreshold, setReputationThreshold] = useState(100);
  const [solidarityAmount, setSolidarityAmount] = useState(25_000);
  const [donationAmount, setDonationAmount] = useState(25_000);
  const [donationState, donationAction, donationPending] = useActionState(
    donateToFederationAction,
    initialFederationFinanceActionState,
  );
  const [solidarityState, solidarityAction, solidarityPending] = useActionState(
    executeFederationSolidarityAction,
    initialFederationFinanceActionState,
  );
  const eligibleTeams = baseline.teamProfiles.filter(
    (team) => team.reputationPoints <= reputationThreshold,
  );
  const solidarityCommitment = eligibleTeams.length * solidarityAmount;
  const hasTreasuryAccount = Boolean(treasuryState?.account);
  const settledOpening = treasuryState?.account?.openingBreakdown ?? null;
  const availableBalance =
    treasuryState?.account?.balance ?? projection.solidarityEnvelope;
  const solidarityLimit = hasTreasuryAccount
    ? (treasuryState?.solidarityLimit ?? 0)
    : projection.solidarityEnvelope;
  const solidarityDistributed = hasTreasuryAccount
    ? (treasuryState?.solidarityDistributed ?? 0)
    : 0;
  const solidarityRemaining = hasTreasuryAccount
    ? (treasuryState?.solidarityRemaining ?? 0)
    : solidarityLimit;
  const availableSolidarity = Math.min(availableBalance, solidarityRemaining);
  const overBudget = solidarityCommitment > availableSolidarity;
  const isActive = gameYear >= 3;
  const solidarityCapReached = isActive && solidarityRemaining <= 0;
  const sourceGameYear =
    treasuryState?.account?.sourceGameYear ?? baseline.gameYear;
  const targetGameYear = sourceGameYear + 1;
  const objectiveBonus =
    treasuryState?.account?.objectiveBonus ?? projection.objectiveBonus;
  const openingCommonGrant = settledOpening?.commonGrant ?? projection.commonGrant;
  const openingUciGrant = settledOpening?.uciGrant ?? projection.uciGrant;
  const openingNationsCupGrant =
    settledOpening?.nationsCupGrant ?? projection.nationsCupGrant;
  const openingRaceRevenue =
    settledOpening?.raceRevenue ?? projection.raceRevenue;
  const openingRaceDays =
    settledOpening?.completedRaceDays ?? projectedRaceDays;
  const openingAverageStarters =
    settledOpening?.averageStarters ?? baseline.averageStarters;
  const openingFillRate = Math.min(1, openingAverageStarters / 160);
  const openingNationRank =
    treasuryState?.account?.uciRank ?? initialNationRank;
  const openingDivision =
    treasuryState?.account?.nationsCupDivision ?? initialDivision;
  const envelopeBase =
    treasuryState?.account?.openingBalance ?? projection.totalRevenue;

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
        <div className="grid gap-6 bg-[var(--federation-primary)] p-6 text-white sm:p-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-accent)]">
                {isActive
                  ? "Trésorerie fédérale"
                  : `Projection officielle Saison ${targetGameYear}`}
              </p>
              <span className="rounded-full border border-[#F2C94C]/35 bg-[#F2C94C]/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#FFE790]">
                {hasTreasuryAccount
                  ? `Ouverture issue de la Saison ${sourceGameYear}`
                  : `${baseline.seasonName} · situation J${baseline.observedThroughDay}`}
              </span>
            </div>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              {money.format(treasuryState?.account?.balance ?? projection.totalRevenue)}
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
              {isActive
                ? "Solde disponible après les dons, investissements et versements déjà enregistrés."
                : `Budget d’ouverture calculé depuis le classement UCI, les courses et les objectifs réellement terminés en S${sourceGameYear}. Aucun don ni objectif futur n’est ajouté artificiellement.`}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Envelope label="Réserve" value={roundEnvelope(envelopeBase, 0.5)} ratio="50 %" />
            <Envelope label="Bâtiments" value={roundEnvelope(envelopeBase, 0.4)} ratio="40 %" />
            <Envelope label="Solidarité" value={solidarityLimit} ratio="10 % max." />
          </div>
        </div>

        <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--federation-secondary)]">
              Retour réel de la Saison {sourceGameYear}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Metric label="Classement UCI" value={`#${openingNationRank}`} />
              <Metric label="Nations Cup" value={`Division ${openingDivision}`} />
              <Metric label="Jours rémunérés" value={`${openingRaceDays}`} />
              <Metric label="Partants moyens" value={`${openingAverageStarters}`} />
              <Metric label="Objectifs validés" value={`${objectiveCount}/5`} />
              <Metric label="Palier objectifs" value={formatObjectiveLevel(objectiveLevel)} />
            </div>
            {hasTreasuryAccount ? (
              <p className="mt-4 rounded-xl border border-[#315B3E]/10 bg-[#F8FBF9] px-4 py-3 text-xs font-semibold leading-5 text-[#60756E]">
                Ces valeurs ont été figées à J1 de la Saison {targetGameYear} à partir du bilan définitif de la Saison {sourceGameYear}.
              </p>
            ) : (
              <p className="mt-4 rounded-xl border border-[#315B3E]/10 bg-[#F8FBF9] px-4 py-3 text-xs font-semibold leading-5 text-[#60756E]">
                Le rythme constaté projette <strong className="text-[#183F37]">{projectedRaceDays} journées rémunératrices</strong> sur une saison complète.
              </p>
            )}
            {baseline.source === "unavailable" ? (
              <p className="mt-3 rounded-xl border border-[#C75348]/25 bg-[#FFF2F0] px-4 py-3 text-xs font-bold text-[#9D3E37]">
                Les données de course sont momentanément indisponibles : seules
                les dotations garanties sont comptées.
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--federation-secondary)]">
              Composition de l’ouverture S{targetGameYear}
            </p>
            <dl className="mt-5 divide-y divide-[#315B3E]/10 overflow-hidden rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9]">
              <FinanceLine label="Socle commun" detail="Base de chaque fédération active" value={openingCommonGrant} />
              <FinanceLine label="Dotation UCI" detail={`Rang #${openingNationRank} en S${sourceGameYear}`} value={openingUciGrant} />
              <FinanceLine label="Nations Cup" detail={`Division ${openingDivision} issue de la S${sourceGameYear}`} value={openingNationsCupGrant} />
              <FinanceLine label="Courses du pays" detail={`${openingRaceDays} jours · ${Math.round(openingFillRate * 100)} % de remplissage`} value={openingRaceRevenue} />
              <FinanceLine
                label={`Objectifs fédéraux S${sourceGameYear}`}
                detail={`${objectiveCount}/5 validés · palier ${formatObjectiveLevel(objectiveLevel)} à +${objectiveBonusPercentage} %`}
                value={objectiveBonus}
              />
              <FinanceLine label="Dons des équipes" detail="Aucun don présumé" value={0} />
            </dl>
            <p className="mt-4 rounded-2xl border border-[#D5AC18]/25 bg-[#FFF9DE] p-4 text-xs font-bold leading-5 text-[#75631C]">
              {hasTreasuryAccount
                ? `La composition de l’ouverture S${targetGameYear} est définitive et reste séparée des mouvements enregistrés ensuite.`
                : `Cette projection évolue avec les résultats de la Saison ${sourceGameYear}. Le budget sera calculé et crédité automatiquement à J1 de la Saison ${targetGameYear}.`}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <article className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-secondary)]">Fonds de solidarité · Réglage S3</p>
          <h3 className="mt-2 text-2xl font-black text-[#183F37]">Deux jauges, une dépense toujours couverte</h3>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">
            Les équipes affiliées sous le seuil de réputation reçoivent le même
            montant. Sur la saison, les versements cumulés sont plafonnés à 10 %
            du budget d’ouverture de la fédération.
          </p>
          <div className="mt-6 space-y-6">
            <RangeControl label="Réputation maximale éligible" value={reputationThreshold} display={`${reputationThreshold} points`} min={0} max={500} step={10} onChange={setReputationThreshold} />
            <RangeControl label="Montant par bénéficiaire" value={solidarityAmount} display={money.format(solidarityAmount)} min={25_000} max={500_000} step={25_000} onChange={setSolidarityAmount} />
          </div>
          <div className={`mt-6 rounded-2xl border p-5 ${overBudget ? "border-[#C75348]/30 bg-[#FFF2F0]" : "border-[var(--federation-secondary)]/25 bg-[#E8F7F1]"}`}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Metric label="Bénéficiaires" value={`${eligibleTeams.length}`} small />
              <Metric label="Engagement" value={compactMoney.format(solidarityCommitment)} small />
              <Metric label="Plafond restant" value={compactMoney.format(solidarityRemaining)} small />
            </div>
            <p className={`mt-4 text-xs font-black leading-5 ${overBudget ? "text-[#9D3E37]" : "text-[var(--federation-secondary)]"}`}>
              {overBudget
                ? `Validation impossible : il manque ${money.format(solidarityCommitment - availableSolidarity)} sur l’enveloppe autorisée.`
                : `${money.format(solidarityDistributed)} déjà versés sur un plafond saisonnier de ${money.format(solidarityLimit)}.`}
            </p>
            {isActive && treasuryState?.canManageSolidarity ? (
              <form action={solidarityAction}>
                <input type="hidden" name="countryCode" value={countryCode} />
                <input type="hidden" name="reputationThreshold" value={reputationThreshold} />
                <input type="hidden" name="amountPerTeam" value={solidarityAmount} />
                <button type="submit" disabled={overBudget || solidarityPending || solidarityCapReached} className="mt-4 min-h-11 w-full rounded-xl bg-[var(--federation-primary)] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#9AA9A3]">
                  {solidarityCapReached
                    ? "Plafond saisonnier atteint"
                    : solidarityPending
                      ? "Versement…"
                      : overBudget
                        ? "Budget insuffisant"
                        : "Valider et verser le fonds"}
                </button>
              </form>
            ) : (
              <button type="button" disabled className="mt-4 min-h-11 w-full cursor-not-allowed rounded-xl bg-[#9AA9A3] px-4 text-sm font-black text-white">
                {isActive ? "Réservé au président" : overBudget ? "Budget insuffisant" : "Validation disponible en S3"}
              </button>
            )}
            <FinanceFeedback state={solidarityState} />
          </div>
        </article>

        <article className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-secondary)]">Contribution des équipes</p>
          <h3 className="mt-2 text-2xl font-black text-[#183F37]">Préparer un don à la fédération</h3>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">
            Le don sera volontaire, irréversible et inscrit au journal public.
            Aucun débit n’est possible avant la S3.
          </p>
          <label className="mt-6 block">
            <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#60756E]">Montant envisagé</span>
            <input
              type="number"
              min={25_000}
              max={5_000_000}
              step={25_000}
              value={donationAmount}
              onChange={(event) => setDonationAmount(Math.max(0, Math.min(5_000_000, Number(event.target.value))))}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/18 bg-[#F8FBF9] px-4 text-sm font-black text-[#183F37] outline-none focus:border-[var(--federation-secondary)]"
            />
          </label>
          <p className="mt-4 rounded-xl bg-[#F2F8F5] px-4 py-4 text-2xl font-black text-[#183F37]">{money.format(donationAmount)}</p>
          {isActive && treasuryState?.canDonate ? (
            <form action={donationAction}>
              <input type="hidden" name="countryCode" value={countryCode} />
              <input type="hidden" name="amount" value={donationAmount} />
              <button type="submit" disabled={donationPending} className="mt-5 min-h-11 w-full rounded-xl bg-[var(--federation-primary)] px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60">
                {donationPending ? "Versement…" : "Confirmer le don irréversible"}
              </button>
            </form>
          ) : (
            <button type="button" disabled className="mt-5 min-h-11 w-full cursor-not-allowed rounded-xl bg-[#9AA9A3] px-4 text-sm font-black text-white">Donner à partir de la Saison 3</button>
          )}
          <FinanceFeedback state={donationState} />
        </article>
      </section>

      <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-secondary)]">Journal financier</p>
            <h3 className="mt-2 text-2xl font-black text-[#183F37]">Historique des gains et dépenses</h3>
          </div>
          <span className="rounded-full bg-[#EEF3F1] px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#60756E]">{isActive ? "Journal officiel" : "Ouverture S3"}</span>
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#315B3E]/12">
          <div className="hidden grid-cols-[100px_1fr_150px_130px] gap-4 bg-[#F2F8F5] px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#60756E] sm:grid">
            <span>Jour</span><span>Opération</span><span>Type</span><span className="text-right">Montant</span>
          </div>
          {treasuryState?.transactions.length ? (
            <div className="divide-y divide-[#315B3E]/10">
              {treasuryState.transactions.map((transaction) => (
                <div key={transaction.id} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[100px_1fr_150px_130px] sm:items-center sm:gap-4">
                  <span className="text-xs font-black text-[#60756E]">J{transaction.dayNumber}</span>
                  <span className="font-bold text-[#183F37]">{transaction.description}</span>
                  <span className="text-xs font-black uppercase text-[#60756E]">{formatCategory(transaction.category)}</span>
                  <span className={`font-black sm:text-right ${transaction.amount >= 0 ? "text-[var(--federation-secondary)]" : "text-[#9D3E37]"}`}>{transaction.amount >= 0 ? "+" : ""}{money.format(transaction.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 py-9 text-center text-sm font-semibold text-[#60756E]">
              Aucun mouvement : le premier solde sera créé au passage en S3.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function FinanceFeedback({
  state,
}: {
  state: typeof initialFederationFinanceActionState;
}) {
  if (!state.message) return null;
  return (
    <p role="status" className={`mt-3 rounded-xl px-4 py-3 text-xs font-black ${state.status === "error" ? "bg-[#FBE3DE] text-[#9D3E37]" : "bg-[#DDF3E7] text-[var(--federation-secondary)]"}`}>
      {state.message}
    </p>
  );
}

function formatCategory(category: string) {
  const labels: Record<string, string> = {
    opening_grant: "Dotation",
    race_revenue: "Course",
    objective_bonus: "Objectif",
    donation: "Don",
    solidarity: "Solidarité",
    infrastructure: "Infrastructure",
    refund: "Remboursement",
    hosting: "Organisation",
  };
  return labels[category] ?? category;
}

function formatObjectiveLevel(level: "none" | "bronze" | "silver" | "gold") {
  if (level === "gold") return "or";
  if (level === "silver") return "argent";
  if (level === "bronze") return "bronze";
  return "non atteint";
}

function roundEnvelope(value: number, ratio: number): number {
  return Math.round((value * ratio) / 5_000) * 5_000;
}

function Metric({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return <div className="rounded-xl border border-[#315B3E]/10 bg-[#EEF6F2] px-3 py-3"><p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#60756E]">{label}</p><p className={`mt-1 font-black text-[#183F37] ${small ? "text-sm sm:text-lg" : "text-xl"}`}>{value}</p></div>;
}

function FinanceLine({ label, detail, value }: { label: string; detail: string; value: number }) {
  return <div className="flex items-center justify-between gap-4 px-4 py-4"><div><dt className="font-black text-[#183F37]">{label}</dt><dd className="mt-1 text-xs font-semibold text-[#60756E]">{detail}</dd></div><dd className="shrink-0 text-sm font-black text-[var(--federation-secondary)]">{money.format(value)}</dd></div>;
}

function Envelope({ label, value, ratio }: { label: string; value: number; ratio: string }) {
  return <div className="min-w-0 rounded-xl border border-white/15 bg-white/10 p-3"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#BFD1C6]">{label}</p><p className="mt-1 truncate text-xs font-black text-white"><span className="sm:hidden">{compactMoney.format(value)}</span><span className="hidden sm:inline">{money.format(value)}</span></p><p className="mt-1 text-[9px] font-bold text-[var(--federation-accent)]">{ratio}</p></div>;
}

function RangeControl({ label, value, display, min, max, step, onChange }: { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="block"><span className="flex items-center justify-between gap-4 text-sm font-black text-[#183F37]"><span>{label}</span><span className="shrink-0 rounded-full bg-[#DDF3E7] px-3 py-1 text-xs text-[var(--federation-secondary)]">{display}</span></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#DDE8E2] accent-[var(--federation-secondary)]" /></label>;
}
