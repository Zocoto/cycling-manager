"use client";

import { useActionState } from "react";

import {
  manageFederationHostingCandidacyAction,
} from "@/app/jeu/federations/governance-actions";
import { FederationRaceCreationPanel } from "@/components/game/federation-race-creation-panel";
import { NationalChampionshipRoutePanel } from "@/components/game/national-championship-route-panel";
import { useLocale } from "@/components/i18n/locale-provider";
import Link from "@/components/ui/app-link";
import { initialFederationGovernanceActionState } from "@/lib/game/federation-action-states";
import { getFederationHostingEvent, type FederationHostingEconomics } from "@/lib/game/federation-hosting";
import type { NationalChampionshipRouteChoice } from "@/lib/game/national-championship-road-route";
import {
  getRaceProfileLabel,
  isRaceCategoryCode,
  RACE_CATEGORY_CODES,
  RACE_CATEGORY_STYLE,
  type RaceCategoryCode,
  type RaceProfileType,
} from "@/lib/game/race-calendar";
import { getIntlLocale, type AppLocale } from "@/lib/i18n/config";
import type { FederationCountryRace, FederationCoursesState, FederationHostingCandidacy, FederationHostingReport } from "@/services/federation-courses";
import type { FederationRaceCreationState } from "@/services/federation-race-creation";

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const hostingDateFormatters: Record<AppLocale, Intl.DateTimeFormat> = {
  fr: new Intl.DateTimeFormat(getIntlLocale("fr"), { dateStyle: "long", timeZone: "Europe/Paris" }),
  en: new Intl.DateTimeFormat(getIntlLocale("en"), { dateStyle: "long", timeZone: "Europe/Paris" }),
};

const hostingWindowFormatters: Record<AppLocale, Intl.DateTimeFormat> = {
  fr: new Intl.DateTimeFormat(getIntlLocale("fr"), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }),
  en: new Intl.DateTimeFormat(getIntlLocale("en"), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }),
};

const PROFILE_COLORS: Record<RaceProfileType, string> = {
  flat: "#59AFC9",
  sprint: "#4FB59B",
  hilly: "#E2A23A",
  mountain: "#C94D4D",
  cobbles: "#7D6A58",
  time_trial: "#6658A8",
  mixed: "#D36F3A",
};
const PORTFOLIO_CATEGORY_ORDER = [...[...RACE_CATEGORY_CODES].reverse(), null];

export function FederationCoursesPanel({
  countryCode,
  gameYear,
  state,
  raceCreationState,
  viewerIsAffiliated = false,
  nationalChampionshipRouteChoice = null,
}: {
  countryCode: string;
  gameYear: number;
  state: FederationCoursesState;
  raceCreationState: FederationRaceCreationState | null;
  viewerIsAffiliated?: boolean;
  nationalChampionshipRouteChoice?: NationalChampionshipRouteChoice | null;
}) {
  const { locale } = useLocale();
  const [actionState, action, pending] = useActionState(
    manageFederationHostingCandidacyAction,
    initialFederationGovernanceActionState,
  );
  const availableBalance = state.hosting.balance === null
    ? null
    : Math.max(0, state.hosting.balance - state.hosting.reservedAmount);
  const dateFormatter = hostingDateFormatters[locale];

  return (
    <div className="space-y-7">
      <nav aria-label="Gestion des courses" className="flex flex-wrap gap-2 text-sm font-bold">
        <a href="#accueil-international" className="rounded-xl bg-white px-4 py-2">Accueil international</a>
        <a href="#candidatures-internationales" className="rounded-xl bg-white px-4 py-2">Candidatures déposées</a>
        {nationalChampionshipRouteChoice ? <a href="#championnat-national" className="rounded-xl bg-white px-4 py-2">Championnat national</a> : null}
        {raceCreationState ? <a href="#creation-course" className="rounded-xl bg-white px-4 py-2">Créer une course</a> : null}
        <a href="#courses-du-pays" className="rounded-xl bg-white px-4 py-2">Courses du pays</a>
      </nav>

      <section id="accueil-international" className="scroll-mt-24 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
        <div className="grid gap-5 bg-[var(--federation-primary)] p-6 text-white sm:p-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-accent)]">
              Accueil international · Saison {state.hosting.targetGameYear}
            </p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">
              Candidater à l’accueil d’une compétition
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6E9E2]">
              Toute fédération peut candidater, même sans Bureau d’organisation.
            </p>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <dt className="text-xs font-bold text-[#B8DDCF]">Fin des dépôts</dt>
                <dd className="mt-1 text-sm font-black">
                  <HostingDate value={state.hosting.applicationCloseDate} formatter={dateFormatter} fallback={`J${state.hosting.applicationCloseDay}`} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[#B8DDCF]">Décision du jury à partir du</dt>
                <dd className="mt-1 text-sm font-black">
                  <HostingDate value={state.hosting.decisionDate} formatter={dateFormatter} fallback={`J${state.hosting.decisionDay}`} />
                </dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#B8DDCF]">
              Trésorerie disponible
            </p>
            <p className="mt-1 text-xl font-black">
              {availableBalance === null
                ? "Non active"
                : moneyFormatter.format(availableBalance)}
            </p>
            <p className="mt-1 text-xs font-bold text-[#B8DDCF]">
              {moneyFormatter.format(state.hosting.reservedAmount)} garantis
            </p>
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <HostingCandidacies
            hosting={state.hosting}
            ownCountryCode={viewerIsAffiliated ? countryCode : null}
            dateFormatter={dateFormatter}
          />

          <div className="rounded-2xl border border-[#D5AC18]/30 bg-[#FFF9DE] px-5 py-4 text-sm font-bold leading-6 text-[#66520D]">
            Le dépôt réserve le coût affiché. Le pays retenu paie à l’attribution.
            Les estimations couvrent 50 à 95 % des objectifs pour un programme intégralement disputé, hors prime de tirage.
          </div>

          {actionState.message ? (
            <p
              role="status"
              className={`rounded-xl px-4 py-3 text-sm font-bold ${
                actionState.status === "success"
                  ? "bg-[#E5F4ED] text-[var(--federation-secondary)]"
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
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--federation-secondary)]">
                      {opportunity.shortLabel} · S{state.hosting.targetGameYear}
                    </p>
                    <p className="mt-2 inline-flex rounded-full bg-[#E5F4ED] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--federation-secondary)]">
                      {opportunity.riderCategory === "professional"
                        ? "Professionnels"
                        : "Juniors"}
                    </p>
                    <h3 className="mt-1 text-xl font-black text-[#183F37]">
                      {opportunity.label}
                    </h3>
                  </div>
                  <span className="rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black text-[#4A3A00]">
                    +{opportunity.prestigeGain} prestige d’orga.
                  </span>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <HostingMetric label="Coût si retenu" value={moneyFormatter.format(opportunity.hostingCost)} />
                  <HostingMetric label="Recettes estimées" value={formatMoneyRange(opportunity.projectedGrossRevenue)} />
                  <HostingMetric
                    label="Solde estimé"
                    value={formatMoneyRange(opportunity.projectedNetReturn)}
                    negative={opportunity.projectedNetReturn[1] < 0}
                  />
                </dl>

                {opportunity.economics ? <HostingEconomicsDetails economics={opportunity.economics} /> : null}

                <div className="mt-5 flex-1 rounded-xl border border-[#315B3E]/10 bg-white p-4 text-sm font-bold text-[#536B63]">
                  {opportunity.isNeutralHost ? (
                    "Terrain neutre"
                  ) : opportunity.selectedHostName ? (
                    <><span>Pays hôte désigné</span>{" · "}{opportunity.selectedHostName}</>
                  ) : opportunity.candidacy && opportunity.candidacy.status !== "withdrawn" ? (
                    <><span>Candidature</span>{" · "}{getCandidacyStatusLabel(opportunity.candidacy.status)}</>
                  ) : opportunity.unavailableReason ?? "La fédération peut déposer sa candidature."}
                </div>

                {opportunity.canWithdraw && opportunity.candidacy ? (
                  <form action={action} className="mt-4">
                    <input type="hidden" name="intent" value="withdraw" />
                    <input type="hidden" name="countryCode" value={countryCode} />
                    <input type="hidden" name="candidacyId" value={opportunity.candidacy.id} />
                    <button type="submit" disabled={pending} className="min-h-11 w-full rounded-xl border border-[#315B3E]/25 bg-white px-4 text-sm font-black disabled:opacity-50">
                      Retirer la candidature
                    </button>
                  </form>
                ) : state.hosting.viewerIsPresident && !opportunity.isNeutralHost && !opportunity.selectedHostName && (!opportunity.candidacy || opportunity.candidacy.status === "withdrawn") ? (
                  <form action={action} className="mt-4">
                    <input type="hidden" name="countryCode" value={countryCode} />
                    <input type="hidden" name="eventType" value={opportunity.eventType} />
                    <button
                      type="submit"
                      disabled={!opportunity.canApply || pending}
                      className="min-h-11 w-full rounded-xl bg-[var(--federation-primary)] px-4 text-sm font-black text-white transition hover:bg-[var(--federation-secondary)] disabled:cursor-not-allowed disabled:bg-[#A8B7B1]"
                    >
                      {pending ? "Dépôt…" : "Déposer la candidature"}
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>

          {state.hosting.reports.length ? <HostingReports reports={state.hosting.reports} locale={locale} /> : null}
        </div>
      </section>

      <NationalChampionshipRoutePanel choice={nationalChampionshipRouteChoice} />
      {raceCreationState ? (
        <FederationRaceCreationPanel
          countryCode={countryCode}
          gameYear={gameYear}
          state={raceCreationState}
        />
      ) : null}
      <div id="courses-du-pays" className="space-y-7 scroll-mt-24">
        <CountryRacePortfolio state={state} />
        <RenownPanel state={state} />
      </div>
    </div>
  );
}

function formatMoneyRange(range: [number, number]) {
  return range.map((amount) => moneyFormatter.format(amount)).join(" – ");
}

function HostingEconomicsDetails({ economics }: { economics: FederationHostingEconomics }) {
  const asPercent = (value: number) => `${Math.round(value * 100)} %`;
  return (
    <details className="mt-4 rounded-xl border border-[#315B3E]/10 bg-white px-3 py-2">
      <summary className="cursor-pointer text-xs font-black text-[#205D4A]">Objectifs et prime d’accueil</summary>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <HostingMetric label="Socle de recettes" value={asPercent(economics.baseRate)} />
        <HostingMetric label="Objectif de pays au départ" value={`${economics.countryTarget} · +${asPercent(economics.countryCapRate)}`} />
        <HostingMetric label="Objectif de lecteurs uniques" value={`${economics.readerTarget} · +${asPercent(economics.readerCapRate)}`} />
        <HostingMetric label="Objectif de places en car" value={`${economics.seatTarget} · +${asPercent(economics.seatCapRate)}`} />
      </dl>
      <p className="mt-3 text-xs font-semibold text-[#536B63]">Les pourcentages s’appliquent au tarif de référence de <strong>{moneyFormatter.format(economics.catalogCost)}</strong>, au prorata des épreuves disputées.</p>
      <p className="mt-1.5 text-xs font-semibold text-[#536B63]">
        {`Le tirage se déclenche à partir de ${asPercent(economics.drawEligibleCountryRate)} de l’objectif de pays au départ.`}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <HostingMetric label="Prime d’accueil" value={`+${asPercent(economics.drawSmallRate)} · ${asPercent(economics.drawSmallProbability)} de chances`} />
        <HostingMetric label="Prime exceptionnelle" value={`+${asPercent(economics.drawLargeRate)} · ${asPercent(economics.drawLargeProbability)} de chances`} />
      </dl>
    </details>
  );
}

function HostingReports({ reports, locale }: { reports: FederationHostingReport[]; locale: AppLocale }) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-black text-[#183F37]">Bilan des accueils</h3>
      {reports.map((report) => (
        <article key={`${report.gameYear}-${report.eventType}`} className="rounded-xl border border-[#315B3E]/14 bg-[#F8FBF9] p-4">
          <h4 className="font-black text-[#183F37]">{getFederationHostingEvent(report.eventType).label} · S{report.gameYear}</h4>
          {report.status === "scheduled" ? (
            <div className="mt-1 space-y-1 text-sm text-[#536B63]">
              <p>Accueil prévu · {moneyFormatter.format(report.hostingCost)}</p>
              {report.revenueWindowEndsAt ? (
                <p><span>Clôture des recettes</span>{" · "}<time dateTime={report.revenueWindowEndsAt}>{hostingWindowFormatters[locale].format(new Date(report.revenueWindowEndsAt))}</time></p>
              ) : report.economics ? (
                <p>Le bilan est calculé après les 72 heures de consultation des résultats.</p>
              ) : null}
            </div>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <HostingMetric label="Coût d’accueil" value={moneyFormatter.format(report.hostingCost)} />
              {report.grossRevenue === null ? null : <HostingMetric label="Recettes" value={moneyFormatter.format(report.grossRevenue)} />}
              {report.refund ? <HostingMetric label="Remboursement" value={moneyFormatter.format(report.refund)} /> : null}
              {report.netReturn === null ? null : <HostingMetric label="Résultat net" value={moneyFormatter.format(report.netReturn)} negative={report.netReturn < 0} />}
              {report.participationRate === null ? null : (
                <HostingMetric label="Participation réelle" value={
                  report.placeCount
                    ? `${report.starterCount ?? 0}/${report.placeCount} · ${Math.round(report.participationRate * 100)} %`
                    : `${Math.round(report.participationRate * 100)} %`
                } />
              )}
              {report.scheduledEditionCount === null ? null : <HostingMetric label="Épreuves courues" value={`${report.completedEditionCount ?? 0}/${report.scheduledEditionCount}`} />}
              <HostingMetric label="Prestige d’organisation" value={`+${report.prestigeGain}`} />
            </dl>
          )}
          {report.economics && report.breakdown ? (
            <HostingRevenueBreakdown economics={report.economics} breakdown={report.breakdown} />
          ) : null}
        </article>
      ))}
    </section>
  );
}

function HostingRevenueBreakdown({ economics, breakdown }: {
  economics: FederationHostingEconomics;
  breakdown: NonNullable<FederationHostingReport["breakdown"]>;
}) {
  return (
    <details className="mt-3 border-t border-[#315B3E]/10 pt-3">
      <summary className="cursor-pointer text-sm font-black text-[#205D4A]">Détail des recettes d’accueil</summary>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <HostingMetric label="Socle de recettes" value={moneyFormatter.format(breakdown.baseAmount)} />
        <HostingMetric label="Recettes de participation" value={moneyFormatter.format(breakdown.countryAmount)} />
        <HostingMetric label="Recettes de lecture" value={moneyFormatter.format(breakdown.readerAmount)} />
        <HostingMetric label="Recettes de déplacements" value={moneyFormatter.format(breakdown.seatAmount)} />
        <HostingMetric label="Prime du tirage" value={moneyFormatter.format(breakdown.drawAmount)} />
      </dl>
      <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[#315B3E]/10 pt-3 text-sm sm:grid-cols-3">
        <HostingMetric label="Pays inscrits" value={String(breakdown.registeredCountryCount)} />
        <HostingMetric label="Pays au départ" value={`${breakdown.countryCount} / ${economics.countryTarget}`} />
        <HostingMetric label="Lecteurs uniques" value={`${breakdown.readerCount} / ${economics.readerTarget}`} />
        <HostingMetric label="Cars mobilisés" value={String(breakdown.carCount)} />
        <HostingMetric label="Places mobilisées" value={`${breakdown.seatCount} / ${economics.seatTarget}`} />
      </dl>
    </details>
  );
}

function RenownPanel({ state }: { state: FederationCoursesState }) {
  const metrics = [
    { label: "Classements UCI · 10 saisons", value: state.renown.breakdown.uciHistory, maximum: 600 },
    { label: "Palmarès des équipes", value: state.renown.breakdown.teamLegacy, maximum: 180 },
    { label: "Palmarès des coureurs", value: state.renown.breakdown.riderLegacy, maximum: 170 },
    { label: "Prestige d’organisation · 5 saisons", value: state.renown.breakdown.hostingLegacy, maximum: 100 },
  ];
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[var(--federation-secondary)]/30 bg-[linear-gradient(135deg,var(--federation-primary)_0%,var(--federation-secondary)_100%)] p-6 text-white shadow-[0_20px_55px_rgba(19,60,46,0.18)] sm:p-8">
      <div className="grid gap-7 xl:grid-cols-[0.7fr_1.3fr] xl:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-accent)]">
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
            accueillies. Le prestige d’organisation cumule les cinq dernières
            saisons, jusqu’à 100 points. À son maximum, il augmente d’environ
            5 % l’affluence de référence.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <div className="flex items-center justify-between gap-3 text-xs font-black">
                <span>{metric.label}</span>
                <span className="text-[var(--federation-accent)]">{metric.value}/{metric.maximum}</span>
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
  const racesByCategory = new Map<RaceCategoryCode | null, FederationCountryRace[]>();
  for (const race of state.portfolio) {
    const category = race.categoryCode && isRaceCategoryCode(race.categoryCode)
      ? race.categoryCode
      : null;
    const races = racesByCategory.get(category);
    if (races) races.push(race);
    else racesByCategory.set(category, [race]);
  }

  return (
    <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.07)] sm:p-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-secondary)]">
          Patrimoine sportif national
        </p>
        <h2 className="mt-2 text-3xl font-black text-[#183F37]">Courses du pays</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
          Dépliez une catégorie pour consulter les profils et les statistiques de ses courses.
        </p>
      </div>

      {state.portfolio.length ? (
        <div className="mt-5 space-y-2">
          {PORTFOLIO_CATEGORY_ORDER.map((category) => {
            const races = racesByCategory.get(category);
            if (!races?.length) return null;
            const style = category ? RACE_CATEGORY_STYLE[category] : null;

            return (
              <details key={category ?? "unscheduled"} className="group rounded-xl border border-[#315B3E]/14 bg-[#F8FBF9]">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-2.5 marker:hidden transition hover:bg-[#E8F7F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70] [&::-webkit-details-marker]:hidden">
                  {style ? (
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-full border"
                      style={{ backgroundColor: style.background, borderColor: style.border }}
                    />
                  ) : null}
                  <span className="flex-1 text-sm font-black text-[#183F37]">
                    {style ? races[0].categoryName ?? style.label : "Hors calendrier"}
                  </span>
                  <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#536B63]">
                    {`${races.length} course${races.length === 1 ? "" : "s"}`}
                  </span>
                  <span aria-hidden="true" className="text-[#536B63] transition-transform group-open:rotate-180">⌄</span>
                </summary>
                <ul className="divide-y divide-[#315B3E]/10 border-t border-[#315B3E]/10 px-4">
                  {races.map((race) => <CountryRaceRow key={race.id} race={race} />)}
                </ul>
              </details>
            );
          })}
        </div>
      ) : (
        <p className="mt-6 rounded-2xl bg-[#F1F5F3] p-5 text-sm font-bold text-[#60756E]">
          Aucune course active n’est encore rattachée à cette nationalité.
        </p>
      )}
    </section>
  );
}

function CountryRaceRow({ race }: { race: FederationCountryRace }) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-[#183F37]">{race.name}</h3>
        <span className="rounded-full bg-[#E5F4ED] px-2 py-0.5 text-[10px] font-black uppercase text-[var(--federation-secondary)]">
          {race.format === "one_day" ? "Classique" : "Tour"}
        </span>
      </div>
      <RaceProfileTags profiles={race.profiles} />
      <div className="mt-2.5">
        <Link href={`/jeu/courses/${race.slug}`} className="text-xs font-black text-[var(--federation-secondary)] hover:underline">
          Voir la course →
        </Link>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-bold leading-6 text-[#536B63]">
          Statistiques de la course
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
          <p className="text-xs font-bold text-[#60756E]">
            {race.returnStatus === "earned" ? "Contribution consolidée au budget S+1" : "Contribution projetée au budget S+1"} · {race.completedStageCount}/{race.totalStageCount} étapes terminées · {race.creditedStageCount} jour{race.creditedStageCount > 1 ? "s" : ""} rémunéré{race.creditedStageCount > 1 ? "s" : ""}
          </p>
          <p className="text-sm font-black text-[var(--federation-secondary)]">
            {moneyFormatter.format(race.moneyGain)}
            {race.gainKind === "mixed" ? ` + ${race.prestigeGain} prestige d’orga.` : " · gain financier"}
          </p>
        </div>
        {race.gainKind === "mixed" ? (
          <p className="mt-2 text-[11px] font-bold text-[#789087]">
            Crédité dans la renommée fédérale une fois l’épreuve terminée.
          </p>
        ) : null}
        <div className="mt-3 border-t border-[#315B3E]/10 pt-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--federation-secondary)]">
            Derniers vainqueurs
          </p>
          {race.pastWinners.length ? (
            <ol className="mt-2 grid gap-2 sm:grid-cols-3">
              {race.pastWinners.map((winner) => (
                <li
                  key={`${winner.gameYear}-${winner.riderName}`}
                  className="rounded-xl border border-[#315B3E]/10 bg-white p-2.5"
                >
                  <p className="text-[10px] font-black uppercase tracking-wide text-[var(--federation-secondary)]">
                    Saison {winner.gameYear}
                  </p>
                  <p className="mt-1 text-sm font-black text-[#183F37]">
                    {winner.riderName}
                  </p>
                  <p className="mt-1 truncate text-[10px] font-bold text-[#789087]">
                    {winner.teamName ?? "Équipe non renseignée"}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-xs font-bold text-[#789087]">
              Le premier vainqueur apparaîtra dès qu’une édition sera terminée.
            </p>
          )}
        </div>
      </details>
    </li>
  );
}

function RaceProfileTags({ profiles }: { profiles: FederationCountryRace["profiles"] }) {
  if (!profiles.length) {
    return (
      <p className="mt-1.5 text-xs font-bold text-[#60756E]">
        Profil détaillé à venir.
      </p>
    );
  }

  return (
    <ul aria-label="Profil de course" className="mt-1.5 flex flex-wrap gap-1.5">
      {profiles.map(({ type, variant, count }) => {
        const label = getRaceProfileLabel({ profileType: type, profileVariant: variant });
        return (
          <li key={label} className="inline-flex items-center gap-1.5 rounded-full border border-[#315B3E]/12 bg-white px-2 py-0.5 text-xs font-bold text-[#183F37]">
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: PROFILE_COLORS[type] }} />
            {label}{count > 1 ? ` ×${count}` : ""}
          </li>
        );
      })}
    </ul>
  );
}

function HostingCandidacies({ hosting, ownCountryCode, dateFormatter }: {
  hosting: FederationCoursesState["hosting"];
  ownCountryCode: string | null;
  dateFormatter: Intl.DateTimeFormat;
}) {
  const candidaciesByEvent = new Map<string, FederationHostingCandidacy[]>();
  for (const candidacy of hosting.candidacies) {
    const candidacies = candidaciesByEvent.get(candidacy.eventKey);
    if (candidacies) candidacies.push(candidacy);
    else candidaciesByEvent.set(candidacy.eventKey, [candidacy]);
  }

  const eventGroups = hosting.opportunities.filter((opportunity) =>
    candidaciesByEvent.has(opportunity.eventKey) || opportunity.isNeutralHost || opportunity.selectedHostName,
  );

  return (
    <section id="candidatures-internationales" className="scroll-mt-24 rounded-2xl border border-[#315B3E]/14 bg-[#F8FBF9] p-4 sm:p-5">
      <h3 className="text-xl font-black text-[#183F37]">Candidatures déposées</h3>
      {eventGroups.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {eventGroups.map((opportunity) => {
            const candidacies = candidaciesByEvent.get(opportunity.eventKey) ?? [];
            candidacies.sort((left, right) =>
              Number(right.countryCode === ownCountryCode) - Number(left.countryCode === ownCountryCode) ||
              left.countryName.localeCompare(right.countryName, "fr"),
            );

            return (
              <article key={opportunity.eventKey} className="min-w-0 rounded-xl border border-[#315B3E]/12 bg-white">
                <div className="px-4 py-3">
                  <h4 className="text-sm font-black text-[#183F37]">{opportunity.label}</h4>
                  {opportunity.isNeutralHost ? (
                    <p className="mt-1 text-xs font-bold text-[#536B63]">Terrain neutre</p>
                  ) : opportunity.selectedHostName ? (
                    <p className="mt-1 text-xs font-bold text-[#536B63]"><span>Pays hôte désigné</span>{" · "}{opportunity.selectedHostName}</p>
                  ) : null}
                </div>
                {candidacies.length ? (
                  <ul className="border-t border-[#315B3E]/10">
                    {candidacies.map((candidacy) => {
                      const isOwnCandidacy = candidacy.countryCode === ownCountryCode;
                      return (
                        <li key={candidacy.id} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[#315B3E]/10 px-4 py-2.5 last:border-0 ${isOwnCandidacy ? "bg-[#EAF5EF] last:rounded-b-xl" : ""}`}>
                          <div className="min-w-0">
                            <p className="break-words text-sm font-black text-[#183F37]">{candidacy.countryName}</p>
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-[#536B63]">
                              {isOwnCandidacy ? <span className="font-bold text-[#205D4A]">Votre fédération</span> : null}
                              <HostingDate value={candidacy.submittedAt} formatter={dateFormatter} />
                            </p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${candidacy.status === "selected" ? "bg-[#D5EDDD] text-[#20513B]" : "bg-[#EEF2F0] text-[#3B574C]"}`}>
                            {getCandidacyStatusLabel(candidacy.status)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm font-bold text-[#60756E]">Aucune candidature déposée pour la saison suivante.</p>
      )}
    </section>
  );
}

function HostingDate({ value, formatter, fallback = null }: {
  value?: string | null;
  formatter: Intl.DateTimeFormat;
  fallback?: string | null;
}) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return fallback;
  return <time dateTime={value ?? undefined}>{formatter.format(date)}</time>;
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
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#DDE7E3]"><div className="h-full rounded-full bg-[var(--federation-secondary)]" style={{ width: `${percentage}%` }} /></div>
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
