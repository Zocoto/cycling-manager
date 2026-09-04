"use client";

import { useActionState } from "react";

import {
  initialFederationGovernanceActionState,
  submitFederationHostingCandidacyAction,
} from "@/app/jeu/federations/governance-actions";
import { FederationRaceCreationPanel } from "@/components/game/federation-race-creation-panel";
import Link from "@/components/ui/app-link";
import { getFederationHostingEvent } from "@/lib/game/federation-hosting";
import type { FederationCoursesState } from "@/services/federation-courses";
import type { FederationRaceCreationState } from "@/services/federation-race-creation";

const numberFormatter = new Intl.NumberFormat("fr-FR");
const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function FederationCoursesPanel({
  countryCode,
  gameYear,
  state,
  raceCreationState,
}: {
  countryCode: string;
  gameYear: number;
  state: FederationCoursesState;
  raceCreationState: FederationRaceCreationState | null;
}) {
  const [actionState, action, pending] = useActionState(
    submitFederationHostingCandidacyAction,
    initialFederationGovernanceActionState,
  );

  return (
    <div className="space-y-7">
      <RenownPanel state={state} />
      <CountryRacePortfolio state={state} />

      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
        <div className="grid gap-5 bg-[#123F36] p-6 text-white sm:p-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
              Accueil international · Saison {state.hosting.targetGameYear}
            </p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">
              Six candidatures : CM, CC et Nations Cup pros et juniors
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6E9E2]">
              Dépôt jusqu’à J{state.hosting.applicationCloseDay}, attribution
              automatique à J{state.hosting.decisionDay}. L’ancienneté depuis
              le dernier accueil pèse 60 %, le classement UCI 25 % et la
              renommée historique 15 %.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#B8DDCF]">
              Trésorerie / garanties
            </p>
            <p className="mt-1 text-xl font-black">
              {state.hosting.balance == null
                ? "Non active"
                : moneyFormatter.format(state.hosting.balance)}
            </p>
            <p className="mt-1 text-xs font-bold text-[#B8DDCF]">
              {moneyFormatter.format(state.hosting.reservedAmount)} garantis
            </p>
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <div className="rounded-2xl border border-[#D5AC18]/30 bg-[#FFF9DE] px-5 py-4 text-sm font-bold leading-6 text-[#66520D]">
            Le coût affiché est garanti au dépôt mais débité uniquement si le
            pays est retenu. Après la compétition, les recettes dépendent de
            l’affluence réelle, elle-même liée au taux de participation et à la
            renommée du pays hôte.
          </div>

          {actionState.message ? (
            <p
              role="status"
              className={`rounded-xl px-4 py-3 text-sm font-bold ${
                actionState.status === "success"
                  ? "bg-[#E5F4ED] text-[#176951]"
                  : "bg-[#FDECEC] text-[#A52E2E]"
              }`}
            >
              {actionState.message}
            </p>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-3">
            {state.hosting.opportunities.map((opportunity) => (
              <article
                key={opportunity.eventKey}
                className="flex flex-col rounded-2xl border border-[#315B3E]/14 bg-[#F8FBF9] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#278B70]">
                      {opportunity.shortLabel} · S{state.hosting.targetGameYear}
                    </p>
                    <p className="mt-2 inline-flex rounded-full bg-[#E5F4ED] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#176951]">
                      {opportunity.riderCategory === "professional"
                        ? "Professionnels"
                        : "Juniors"}
                    </p>
                    <h3 className="mt-1 text-xl font-black text-[#183F37]">
                      {opportunity.label}
                    </h3>
                  </div>
                  <span className="rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black text-[#4A3A00]">
                    +{opportunity.prestigeGain} prestige
                  </span>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <HostingMetric label="Coût si retenu" value={moneyFormatter.format(opportunity.hostingCost)} />
                  <HostingMetric label="Affluence estimée" value={numberFormatter.format(opportunity.projectedAttendance)} />
                  <HostingMetric label="Recettes estimées" value={moneyFormatter.format(opportunity.projectedGrossRevenue)} />
                  <HostingMetric
                    label="Solde estimé"
                    value={moneyFormatter.format(opportunity.projectedNetReturn)}
                    negative={opportunity.projectedNetReturn < 0}
                  />
                </dl>

                <div className="mt-5 flex-1 rounded-xl border border-[#315B3E]/10 bg-white p-4 text-sm font-bold text-[#536B63]">
                  {opportunity.selectedHostName
                    ? `Pays hôte désigné : ${opportunity.selectedHostName}.`
                    : opportunity.candidacy
                      ? `Candidature déposée · score ${opportunity.candidacy.selectionScore}/1000.`
                      : opportunity.unavailableReason ?? "La fédération peut déposer sa candidature."}
                </div>

                {!opportunity.candidacy && !opportunity.selectedHostName ? (
                  <form action={action} className="mt-4">
                    <input type="hidden" name="countryCode" value={countryCode} />
                    <input type="hidden" name="eventType" value={opportunity.eventType} />
                    <button
                      type="submit"
                      disabled={!opportunity.canApply || pending}
                      className="min-h-11 w-full rounded-xl bg-[#123F36] px-4 text-sm font-black text-white transition hover:bg-[#176951] disabled:cursor-not-allowed disabled:bg-[#A8B7B1]"
                    >
                      {pending ? "Dépôt…" : "Déposer la candidature"}
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>

          <CandidacyRanking state={state} />
        </div>
      </section>

      {raceCreationState ? (
        <FederationRaceCreationPanel
          countryCode={countryCode}
          gameYear={gameYear}
          state={raceCreationState}
        />
      ) : null}
    </div>
  );
}

function RenownPanel({ state }: { state: FederationCoursesState }) {
  const metrics = [
    { label: "Classements UCI · 10 saisons", value: state.renown.breakdown.uciHistory, maximum: 600 },
    { label: "Palmarès des équipes", value: state.renown.breakdown.teamLegacy, maximum: 180 },
    { label: "Palmarès des coureurs", value: state.renown.breakdown.riderLegacy, maximum: 170 },
    { label: "Héritage d’organisation", value: state.renown.breakdown.hostingLegacy, maximum: 50 },
  ];
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#278B70]/30 bg-[linear-gradient(135deg,#0B302B_0%,#176951_100%)] p-6 text-white shadow-[0_20px_55px_rgba(19,60,46,0.18)] sm:p-8">
      <div className="grid gap-7 xl:grid-cols-[0.7fr_1.3fr] xl:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
            Renommée historique · calcul S{state.renown.sourceThroughGameYear}
          </p>
          <div className="mt-3 flex items-end gap-3">
            <p className="text-6xl font-black">{state.renown.score}</p>
            <p className="pb-2 text-lg font-black text-[#B8DDCF]">/ 1000</p>
          </div>
          <p className="mt-2 text-lg font-black text-[#F2C94C]">{state.renown.label}</p>
          <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-[#D6E9E2]">
            Cette valeur conserve la mémoire sportive du pays : résultats
            récents, grandes équipes, podiums de ses coureurs et compétitions
            internationales déjà accueillies.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <div className="flex items-center justify-between gap-3 text-xs font-black">
                <span>{metric.label}</span>
                <span className="text-[#9BE0BC]">{metric.value}/{metric.maximum}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
                <div
                  className="h-full rounded-full bg-[#75D7B5]"
                  style={{ width: `${Math.min(100, Math.round((metric.value / metric.maximum) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CountryRacePortfolio({ state }: { state: FederationCoursesState }) {
  return (
    <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
          Patrimoine sportif national
        </p>
        <h2 className="mt-2 text-3xl font-black text-[#183F37]">Courses du pays</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
          Catégorie, remplissage des équipes et des compositions, puis retour
          financier et prestige associés à chaque épreuve de la saison.
        </p>
      </div>

      {state.portfolio.length ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {state.portfolio.map((race) => (
            <article key={race.id} className="rounded-2xl border border-[#315B3E]/14 bg-[#F8FBF9] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#123F36] px-3 py-1 text-[10px] font-black uppercase text-white">
                      {race.categoryName ?? "Hors calendrier"}
                      {race.prestigeRank ? ` · rang ${race.prestigeRank}` : ""}
                    </span>
                    <span className="rounded-full bg-[#E5F4ED] px-3 py-1 text-[10px] font-black uppercase text-[#176951]">
                      {race.format === "one_day" ? "Classique" : "Tour"}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-black text-[#183F37]">{race.name}</h3>
                </div>
                <Link href={`/jeu/courses/${race.slug}`} className="text-xs font-black text-[#176951] hover:underline">
                  Voir la course →
                </Link>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <ParticipationGauge
                  label="Participation équipes"
                  percentage={race.teamParticipationPercentage}
                  detail={`${race.acceptedTeamCount}/${race.fieldLimit ?? "—"} acceptées · ${race.pendingTeamCount} en attente`}
                />
                <ParticipationGauge
                  label="Compositions remplies"
                  percentage={race.riderFillPercentage}
                  detail={`${race.activeRiderCount} coureurs · ${race.withdrawnTeamCount} retraits · ${race.rejectedTeamCount} refus`}
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
                <p className="text-xs font-bold text-[#60756E]">
                  {race.returnStatus === "earned" ? "Gain acquis" : "Gain projeté"} · {race.completedStageCount}/{race.totalStageCount} étapes terminées
                </p>
                <p className="text-sm font-black text-[#176951]">
                  {moneyFormatter.format(race.moneyGain)}
                  {race.gainKind === "mixed" ? ` + ${race.prestigeGain} prestige` : " · gain financier"}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-2xl bg-[#F1F5F3] p-5 text-sm font-bold text-[#60756E]">
          Aucune course active n’est encore rattachée à cette nationalité.
        </p>
      )}
    </section>
  );
}

function CandidacyRanking({ state }: { state: FederationCoursesState }) {
  return (
    <div className="rounded-2xl border border-[#315B3E]/14 bg-[#F8FBF9] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#278B70]">Transparence de l’attribution</p>
          <h3 className="mt-1 text-xl font-black text-[#183F37]">Candidatures déposées</h3>
        </div>
        <p className="text-xs font-bold text-[#60756E]">Toutes les équipes affiliées consultent le même classement.</p>
      </div>
      {state.hosting.candidacies.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-[10px] font-black uppercase tracking-[0.1em] text-[#60756E]">
              <tr>
                <th className="px-3 py-2">Pays / épreuve</th>
                <th className="px-3 py-2">Dernier accueil</th>
                <th className="px-3 py-2">UCI</th>
                <th className="px-3 py-2">Renommée</th>
                <th className="px-3 py-2">Détail du score</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {state.hosting.candidacies.map((candidate) => (
                <tr key={candidate.id} className="border-t border-[#315B3E]/10 font-bold text-[#183F37]">
                  <td className="px-3 py-3">
                    <span className="mr-2 rounded bg-[#E5F4ED] px-2 py-1 text-[10px] font-black text-[#176951]">{candidate.countryCode}</span>
                    {candidate.countryName} · {getFederationHostingEvent(candidate.eventType).shortLabel}
                  </td>
                  <td className="px-3 py-3">{candidate.lastHostedGameYear ? `S${candidate.lastHostedGameYear}` : "Jamais"}</td>
                  <td className="px-3 py-3">#{candidate.uciRank}</td>
                  <td className="px-3 py-3">{candidate.renownScore}/1000</td>
                  <td className="px-3 py-3 text-xs text-[#60756E]">{candidate.recencyPoints} + {candidate.rankingPoints} + {candidate.renownPoints}</td>
                  <td className="px-3 py-3">{getCandidacyStatusLabel(candidate.status)}</td>
                  <td className="px-3 py-3 text-right font-black">{candidate.selectionScore}/1000</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm font-bold text-[#60756E]">Aucune candidature déposée pour la saison suivante.</p>
      )}
    </div>
  );
}

function getCandidacyStatusLabel(
  status: FederationCoursesState["hosting"]["candidacies"][number]["status"],
): string {
  if (status === "selected") return "Retenue";
  if (status === "not_selected") return "Non retenue";
  if (status === "withdrawn") return "Retirée";
  return "Déposée";
}

function ParticipationGauge({ label, percentage, detail }: { label: string; percentage: number; detail: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-black text-[#183F37]"><span>{label}</span><span>{percentage} %</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#DDE7E3]"><div className="h-full rounded-full bg-[#278B70]" style={{ width: `${percentage}%` }} /></div>
      <p className="mt-2 text-[11px] font-bold text-[#60756E]">{detail}</p>
    </div>
  );
}

function HostingMetric({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-[#789087]">{label}</dt>
      <dd className={`mt-1 font-black ${negative ? "text-[#B33A3A]" : "text-[#183F37]"}`}>{value}</dd>
    </div>
  );
}
