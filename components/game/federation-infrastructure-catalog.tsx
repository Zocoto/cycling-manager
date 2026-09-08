"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import {
  contributeArchitectToFederationProjectAction,
  startFederationSchoolCyclingPlanAction,
  startFederationInfrastructureProjectAction,
  updateFederationProjectPriorityAction,
  type FederationInfrastructureActionState,
} from "@/app/jeu/federations/infrastructure-actions";
import { InfrastructureSpecializationPanel } from "@/components/game/infrastructure-specialization-panel";
import { initialFederationInfrastructureActionState } from "@/lib/game/federation-action-states";
import { getInfrastructureSpecializationProposal } from "@/lib/game/infrastructure-specializations";
import {
  FEDERATION_INFRASTRUCTURE_DEFINITIONS,
  MAX_FEDERATION_PROJECT_ARCHITECTS,
  calculateFederationConstructionPreview,
  type FederationConstructionPriority,
  type FederationInfrastructureDefinition,
} from "@/lib/game/federation-infrastructures";
import {
  SCHOOL_CYCLING_PLAN_COST,
  SCHOOL_CYCLING_PLAN_DURATION_DAYS,
  SCHOOL_CYCLING_PLAN_MATURITY_TRANSFERS,
  SCHOOL_CYCLING_PLAN_REQUIRED_DETECTION_NETWORK_LEVEL,
} from "@/lib/game/federation-school-cycling-plan";
import {
  getCountryYouthSpecialties,
  getYouthArchetypeProbabilities,
  YOUTH_ARCHETYPES,
  YOUTH_ARCHETYPE_LABELS,
  type YouthArchetype,
  type YouthArchetypeProbability,
} from "@/lib/game/youth-development";
import type {
  FederationInfrastructureProjectState,
  FederationInfrastructureState,
} from "@/services/federation-infrastructures";

type FederationInfrastructureCatalogProps = {
  countryCode: string;
  currency?: string;
  managementLocked: boolean;
  infrastructureState: FederationInfrastructureState | null;
};

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const PRIORITIES: Array<{
  value: FederationConstructionPriority;
  label: string;
  detail: string;
}> = [
  {
    value: "balanced",
    label: "Équilibré",
    detail: "−2 % de coût et −3 % de délai par architecte",
  },
  {
    value: "cost",
    label: "Maîtrise du budget",
    detail: "−4 % de coût par architecte",
  },
  {
    value: "time",
    label: "Livraison rapide",
    detail: "−6 % de délai par architecte",
  },
];

export function FederationInfrastructureCatalog({
  countryCode,
  currency = "EUR",
  managementLocked,
  infrastructureState,
}: FederationInfrastructureCatalogProps) {
  const activeProjects = infrastructureState?.activeProjects ?? [];

  return (
    <div className="space-y-6">
      {activeProjects.length > 0 ? (
        <section className="rounded-[2rem] border border-[var(--federation-secondary)]/30 bg-white p-6 shadow-[0_18px_48px_rgba(19,60,46,0.12)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-secondary)]">
            Construction en cours
          </p>
          <h2 className="mt-2 text-3xl font-black text-[#183F37]">
            Les chantiers de la fédération
          </h2>
          <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-[#60756E]">
            Chaque DS peut affecter un seul architecte de son staff par
            chantier. Le bonus financier est recrédité immédiatement et le
            planning est recalculé à chaque arrivée ou départ.
          </p>
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {activeProjects.map((project) => (
              <ActiveProjectPanel
                key={project.id}
                countryCode={countryCode}
                project={project}
                state={infrastructureState}
                currency={currency}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!managementLocked ? (
        <aside className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#315B3E]/12 bg-white px-5 py-4">
          <span className="text-sm font-bold text-[#60756E]">
            Trésorerie fédérale disponible
          </span>
          <strong className="text-xl font-black text-[#183F37]">
            {infrastructureState?.balance == null
              ? "Initialisation en cours"
              : formatMoney(infrastructureState.balance, currency)}
          </strong>
        </aside>
      ) : null}

      {FEDERATION_INFRASTRUCTURE_DEFINITIONS.map((definition) => {
        const currentLevel =
          infrastructureState?.levels[definition.code] ?? 0;
        return (
          <div key={definition.code} className="space-y-4">
            <FederationInfrastructureCard
              countryCode={countryCode}
              definition={definition}
              currency={currency}
              managementLocked={managementLocked}
              currentLevel={currentLevel}
              activeProject={
                infrastructureState?.activeProjects.find(
                  (project) => project.code === definition.code,
                ) ?? null
              }
              infrastructureState={infrastructureState}
            />
            {definition.code === "national_detection_network" ? (
              <FederationSchoolCyclingPlan
                countryCode={countryCode}
                currency={currency}
                managementLocked={managementLocked}
                detectionNetworkLevel={currentLevel}
                infrastructureState={infrastructureState}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function FederationSchoolCyclingPlan({
  countryCode,
  currency,
  managementLocked,
  detectionNetworkLevel,
  infrastructureState,
}: {
  countryCode: string;
  currency: string;
  managementLocked: boolean;
  detectionNetworkLevel: number;
  infrastructureState: FederationInfrastructureState | null;
}) {
  const specialties = getCountryYouthSpecialties(countryCode);
  const plan = infrastructureState?.schoolCyclingPlan ?? null;
  const choices = YOUTH_ARCHETYPES.filter(
    (archetype) => archetype !== specialties.primary,
  );
  const [selectedArchetype, setSelectedArchetype] = useState<YouthArchetype>(
    choices.find((archetype) => archetype !== plan?.targetArchetype) ??
      choices[0]!,
  );
  const [actionState, action, pending] = useActionState(
    startFederationSchoolCyclingPlanAction,
    initialFederationInfrastructureActionState,
  );
  const currentPlanIsActive = plan?.status === "active";
  const currentProbabilities = getYouthArchetypeProbabilities({
    ...specialties,
    schoolPlanArchetype: currentPlanIsActive ? plan.targetArchetype : null,
    schoolPlanTransferPoints: currentPlanIsActive ? plan.transferPoints : 0,
  });
  const matureProbabilities = getYouthArchetypeProbabilities({
    ...specialties,
    schoolPlanArchetype: selectedArchetype,
    schoolPlanTransferPoints: 10,
  });
  const isUnlocked =
    detectionNetworkLevel >=
    SCHOOL_CYCLING_PLAN_REQUIRED_DETECTION_NETWORK_LEVEL;
  const hasEnoughFunds =
    (infrastructureState?.balance ?? 0) >= SCHOOL_CYCLING_PLAN_COST;
  const sameOrientation = plan?.targetArchetype === selectedArchetype;
  const canSubmit =
    !managementLocked &&
    isUnlocked &&
    Boolean(infrastructureState?.canLaunch) &&
    hasEnoughFunds &&
    !sameOrientation;

  return (
    <section className="overflow-hidden rounded-[1.9rem] border border-[#D5AC18]/30 bg-[#FFFDF4] shadow-[0_16px_44px_rgba(19,60,46,0.08)]">
      <div className="grid gap-5 bg-[#102C27] p-5 text-white sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F2C94C]">
            Politique fédérale autonome · programme pluri-saisonnier
          </p>
          <h3 className="mt-2 text-2xl font-black sm:text-3xl">
            Plan vélo scolaire
          </h3>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
            Réoriente une part des jeunes détectés vers un nouveau style sans
            augmenter leur potentiel, leurs notes initiales ou leurs capacités
            rares.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <PlanMetric label="Déploiement" value={`${SCHOOL_CYCLING_PLAN_DURATION_DAYS} j`} />
          <PlanMetric label="Coût" value={formatMoney(SCHOOL_CYCLING_PLAN_COST, currency)} />
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-2">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#60756E]">
                Probabilités actuelles du pays
              </p>
              <p className="mt-1 text-sm font-black text-[#183F37]">
                Style historique · {YOUTH_ARCHETYPE_LABELS[specialties.primary]}
              </p>
            </div>
            <span className="rounded-full bg-[#EAF5F3] px-3 py-1.5 text-[10px] font-black text-[#176951]">
              Réseau de détection N{detectionNetworkLevel}/5
            </span>
          </div>
          <ProbabilityBars probabilities={currentProbabilities} />
          {plan ? (
            <div className="mt-4 rounded-2xl border border-[#315B3E]/12 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#60756E]">
                    Orientation fédérale
                  </p>
                  <p className="mt-1 font-black text-[#183F37]">
                    {YOUTH_ARCHETYPE_LABELS[plan.targetArchetype]}
                  </p>
                </div>
                <span className="rounded-full bg-[#FFF4C7] px-3 py-1.5 text-[10px] font-black text-[#806114]">
                  {plan.status === "deploying"
                    ? `${plan.remainingDays} j restants · livraison S${plan.deliveryGameYear}`
                    : `Actif · +${plan.transferPoints} points`}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[#D5AC18]/25 bg-white p-4 sm:p-5">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#60756E]">
              Nouvelle orientation
            </span>
            <select
              value={selectedArchetype}
              onChange={(event) =>
                setSelectedArchetype(event.target.value as YouthArchetype)
              }
              className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-black text-[#183F37]"
            >
              {choices.map((archetype) => (
                <option key={archetype} value={archetype}>
                  {YOUTH_ARCHETYPE_LABELS[archetype]}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs font-semibold leading-5 text-[#60756E]">
            À pleine maturité, 10 points quittent le style historique pour
            rejoindre {YOUTH_ARCHETYPE_LABELS[selectedArchetype].toLocaleLowerCase("fr")}.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {SCHOOL_CYCLING_PLAN_MATURITY_TRANSFERS.map((transfer, index) => (
              <div
                key={transfer}
                className="rounded-xl bg-[#F5F8F6] p-3 text-center"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#60756E]">
                  Promotion {index + 1}
                </p>
                <p className="mt-1 text-lg font-black text-[#176951]">
                  +{transfer} pts
                </p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.13em] text-[#60756E]">
            Projection à maturité
          </p>
          <ProbabilityBars probabilities={matureProbabilities} compact />

          <form action={action} className="mt-5">
            <input type="hidden" name="countryCode" value={countryCode} />
            <input
              type="hidden"
              name="targetArchetype"
              value={selectedArchetype}
            />
            <button
              type="submit"
              disabled={!canSubmit || pending}
              className="min-h-11 w-full rounded-xl bg-[#F2C94C] px-4 text-sm font-black text-[#183F37] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#D5D6CE] disabled:text-[#6F7773]"
            >
              {pending
                ? "Financement…"
                : plan
                  ? `Réorienter · ${formatMoney(SCHOOL_CYCLING_PLAN_COST, currency)}`
                  : `Financer · ${formatMoney(SCHOOL_CYCLING_PLAN_COST, currency)}`}
            </button>
            {!isUnlocked ? (
              <PlanBlockReason>
                Réseau national de détection niveau {SCHOOL_CYCLING_PLAN_REQUIRED_DETECTION_NETWORK_LEVEL} requis.
              </PlanBlockReason>
            ) : managementLocked ? (
              <PlanBlockReason>Programme disponible à partir de la Saison 3.</PlanBlockReason>
            ) : !infrastructureState?.canLaunch ? (
              <PlanBlockReason>Décision réservée au président élu.</PlanBlockReason>
            ) : !hasEnoughFunds ? (
              <PlanBlockReason>Trésorerie fédérale insuffisante.</PlanBlockReason>
            ) : sameOrientation ? (
              <PlanBlockReason>Cette orientation est déjà engagée.</PlanBlockReason>
            ) : plan ? (
              <p className="mt-3 text-[11px] font-semibold leading-5 text-[#806114]">
                Une réorientation remplace le plan actuel et relance intégralement
                les 56 jours de déploiement.
              </p>
            ) : null}
            <ActionFeedback state={actionState} />
          </form>
        </div>
      </div>
    </section>
  );
}

function ProbabilityBars({
  probabilities,
  compact = false,
}: {
  probabilities: YouthArchetypeProbability[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mt-3 space-y-2" : "mt-4 space-y-2.5"}>
      {probabilities.map((probability) => (
        <div key={probability.archetype}>
          <div className="flex items-center justify-between gap-3 text-[10px] font-black text-[#45655C]">
            <span>{YOUTH_ARCHETYPE_LABELS[probability.archetype]}</span>
            <span>{formatPercentage(probability.probabilityPercentage)} %</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#E7EEEA]">
            <div
              className="h-full rounded-full bg-[#278B70]"
              style={{ width: `${probability.probabilityPercentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 rounded-xl border border-white/15 bg-white/10 px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#BFD0C9]">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function PlanBlockReason({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-xs font-bold text-[#9D3E37]">{children}</p>
  );
}

function formatPercentage(value: number): string {
  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(1).replace(".", ",");
}

function FederationInfrastructureCard({
  countryCode,
  definition,
  currency,
  managementLocked,
  currentLevel,
  activeProject,
  infrastructureState,
}: {
  countryCode: string;
  definition: FederationInfrastructureDefinition;
  currency: string;
  managementLocked: boolean;
  currentLevel: number;
  activeProject: FederationInfrastructureProjectState | null;
  infrastructureState: FederationInfrastructureState | null;
}) {
  const [selectedLevel, setSelectedLevel] = useState(
    Math.min(5, Math.max(1, currentLevel + 1)),
  );
  const previewLevel =
    definition.levels.find((candidate) => candidate.level === selectedLevel) ??
    definition.levels[0];
  const nextLevel = definition.levels.find(
    (candidate) => candidate.level === currentLevel + 1,
  );
  const quoteLevel = managementLocked ? previewLevel : nextLevel;
  const quote = quoteLevel
    ? calculateFederationConstructionPreview({
        level: quoteLevel,
        architectCount: 0,
        priority: "balanced",
      })
    : null;
  const balance = infrastructureState?.balance ?? 0;
  const insufficientFunds = Boolean(quote && balance < quote.cost);
  const specializationProposal = getInfrastructureSpecializationProposal(
    "federation",
    definition.code,
  );

  return (
    <article className="overflow-hidden rounded-[1.9rem] border border-[#315B3E]/15 bg-white shadow-[0_16px_44px_rgba(19,60,46,0.09)]">
      <div className="relative isolate min-h-[250px] overflow-hidden bg-[#071A17] text-white sm:min-h-[285px]">
        <Image
          src={definition.illustration.src}
          alt={definition.illustration.alt}
          fill
          sizes="(max-width: 768px) 100vw, 1400px"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,26,23,0.97)_0%,rgba(7,26,23,0.84)_45%,rgba(7,26,23,0.26)_82%),linear-gradient(0deg,rgba(7,26,23,0.82)_0%,transparent_65%)]"
        />
        <div className="relative flex min-h-[250px] flex-col justify-between gap-8 p-6 sm:min-h-[285px] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="rounded-full border border-[#F2C94C]/40 bg-[#071A17]/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#FFE897] backdrop-blur-sm">
              Dès {formatMoney(definition.levels[0].cost, currency)}
            </span>
            <span className="rounded-full border border-white/20 bg-[#071A17]/70 px-4 py-2 text-xs font-black backdrop-blur-sm">
              Niveau {currentLevel}/5
              {activeProject ? ` · chantier N${activeProject.targetLevel}` : ""}
            </span>
          </div>
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F2C94C]">
              {definition.domain}
            </p>
            <h3 className="mt-2 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
              {definition.name}
            </h3>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
              {definition.summary}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-7 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_minmax(330px,0.42fr)]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[var(--federation-secondary)]">
            Apports niveau par niveau
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-5">
            {definition.levels.map((candidate) => (
              <button
                key={candidate.level}
                type="button"
                onClick={() => setSelectedLevel(candidate.level)}
                aria-pressed={selectedLevel === candidate.level}
                className={`rounded-xl border p-3 text-left transition ${
                  currentLevel >= candidate.level
                    ? "border-[var(--federation-secondary)]/45 bg-[#DDF3E7]"
                    : selectedLevel === candidate.level
                      ? "border-[var(--federation-secondary)]/55 bg-[#EAF7F1] shadow-sm"
                      : "border-[#315B3E]/10 bg-[#F6F8F6] hover:border-[var(--federation-secondary)]/30"
                }`}
              >
                <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
                  Niveau {candidate.level}
                  {currentLevel >= candidate.level ? " · acquis" : ""}
                </span>
                <span className="mt-1 block text-xs font-bold leading-5 text-[#183F37]">
                  {candidate.effect}
                </span>
                <span className="mt-3 block text-[10px] font-black text-[var(--federation-secondary)]">
                  {formatMoney(candidate.cost, currency)} · {candidate.durationDays} j
                </span>
              </button>
            ))}
          </div>
          {definition.principle ? (
            <p className="mt-4 rounded-xl border border-[#315B3E]/10 bg-[#F8FBF9] px-4 py-3 text-xs font-semibold leading-5 text-[#60756E]">
              <strong className="text-[#183F37]">Garde-fou :</strong>{" "}
              {definition.principle}
            </p>
          ) : null}
        </div>

        {activeProject ? (
          <aside className="h-fit rounded-2xl border border-[var(--federation-secondary)]/25 bg-[#EAF7F1] p-5 text-sm font-bold leading-6 text-[var(--federation-secondary)]">
            Ce chantier est suivi dans l’encart « Construction en cours » en
            tête de page.
          </aside>
        ) : quote && quoteLevel ? (
          <aside className="h-fit rounded-2xl border border-[#F2C94C]/35 bg-[#FFF9E5] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#75631C]">
              {managementLocked ? "Devis prévisionnel" : "Prochain chantier"} · niveau {quoteLevel.level}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <QuoteMetric label="Coût fédéral" value={formatMoney(quote.cost, currency)} />
              <QuoteMetric label="Durée" value={`${quote.durationDays} jours`} />
              <QuoteMetric
                label="Économie simulée"
                value={quote.savedAmount > 0 ? formatMoney(quote.savedAmount, currency) : "—"}
              />
              <QuoteMetric
                label="Temps simulé"
                value={quote.savedDays > 0 ? `${quote.savedDays} jour${quote.savedDays > 1 ? "s" : ""}` : "—"}
              />
            </dl>
            <p className="mt-4 text-xs font-bold leading-5 text-[#75631C]">
              {managementLocked && quote.architectCount > 0
                ? `${quote.architectCount} architecte${quote.architectCount > 1 ? "s" : ""} · −${quote.costReductionPercentage} % coût · −${quote.durationReductionPercentage} % délai`
                : managementLocked
                  ? "Aucun architecte mobilisé sur cette estimation."
                  : "Le devis brut est débité, puis les architectes des clubs peuvent réduire le coût et le délai."}
            </p>
            {managementLocked ? (
              <button
                type="button"
                disabled
                className="mt-5 min-h-11 w-full cursor-not-allowed rounded-xl bg-[#9AA9A3] px-4 text-sm font-black text-white"
              >
                Construction disponible en S3
              </button>
            ) : (
              <LaunchProjectForm
                countryCode={countryCode}
                infrastructureCode={definition.code}
                targetLevel={quoteLevel.level}
                priority="balanced"
                disabled={
                  !infrastructureState?.canLaunch ||
                  infrastructureState.balance == null ||
                  insufficientFunds
                }
                disabledReason={
                  !infrastructureState?.canLaunch
                    ? "Lancement réservé au président élu."
                    : infrastructureState.balance == null
                      ? "La trésorerie S3 est en cours d’initialisation."
                      : insufficientFunds
                        ? "Trésorerie fédérale insuffisante."
                        : null
                }
              />
            )}
          </aside>
        ) : (
          <aside className="h-fit rounded-2xl border border-[var(--federation-secondary)]/25 bg-[#E5F4ED] p-5 text-sm font-black text-[var(--federation-secondary)]">
            Niveau maximal atteint. Aucun nouveau chantier n’est nécessaire.
          </aside>
        )}
      </div>
      {specializationProposal ? (
        <InfrastructureSpecializationPanel
          proposal={specializationProposal}
          level={currentLevel}
          selection={
            infrastructureState?.specializations[definition.code] ?? {
              activeCode: null,
              pendingCode: null,
              effectiveGameDayIndex: null,
              canSelectThisSeason: true,
              reorientationCost: currentLevel * 250_000,
            }
          }
          gameYear={infrastructureState?.gameYear ?? 2}
          currency={currency}
          countryCode={countryCode}
          canManage={
            infrastructureState?.canManageSpecializations ?? false
          }
        />
      ) : null}
    </article>
  );
}

function ActiveProjectPanel({
  countryCode,
  project,
  state,
  currency,
}: {
  countryCode: string;
  project: FederationInfrastructureProjectState;
  state: FederationInfrastructureState | null;
  currency: string;
}) {
  const definition = FEDERATION_INFRASTRUCTURE_DEFINITIONS.find(
    (candidate) => candidate.code === project.code,
  );
  const [priorityState, priorityAction, priorityPending] = useActionState(
    updateFederationProjectPriorityAction,
    initialFederationInfrastructureActionState,
  );
  const elapsedDays = Math.max(
    0,
    project.finalDurationDays - project.remainingDays,
  );
  const progress = Math.min(
    100,
    Math.max(4, Math.round((elapsedDays / project.finalDurationDays) * 100)),
  );
  const hasCapacity =
    project.architectCount < MAX_FEDERATION_PROJECT_ARCHITECTS;
  const canContribute =
    Boolean(state?.canContribute) &&
    !project.viewerTeamHasContributed &&
    hasCapacity &&
    (state?.availableArchitects.length ?? 0) > 0;

  return (
    <aside className="h-fit rounded-2xl border border-[var(--federation-secondary)]/30 bg-[#EAF7F1] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--federation-secondary)]">
            Chantier en cours · niveau {project.targetLevel}
          </p>
          <p className="mt-2 text-xl font-black text-[#183F37]">
            {definition?.name ?? "Infrastructure fédérale"}
          </p>
          <p className="mt-1 text-sm font-black text-[var(--federation-secondary)]">
            {project.remainingDays > 0
              ? `${project.remainingDays} jour${project.remainingDays > 1 ? "s" : ""} restant${project.remainingDays > 1 ? "s" : ""}`
              : "Livraison imminente"}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--federation-secondary)]">
          {project.architectCount}/5
        </span>
      </div>
      <form action={priorityAction} className="mt-4 rounded-xl bg-white p-3">
        <input type="hidden" name="countryCode" value={countryCode} />
        <input type="hidden" name="projectId" value={project.id} />
        <label className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <span>
            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
              Priorité du chantier
            </span>
            <select
              name="priority"
              defaultValue={project.priority}
              disabled={!state?.canLaunch || priorityPending}
              className="mt-1 min-h-10 w-full rounded-lg border border-[#315B3E]/15 bg-white px-3 text-xs font-black text-[#183F37] disabled:bg-[#EDF1EF]"
            >
              {PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
          <button
            type="submit"
            disabled={!state?.canLaunch || priorityPending}
            className="min-h-10 rounded-lg bg-[var(--federation-primary)] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-[#9AA9A3]"
          >
            {priorityPending ? "Calcul…" : "Mettre à jour"}
          </button>
        </label>
        {state?.canLaunch ? (
          <p className="mt-2 text-[10px] font-semibold text-[#60756E]">
            {PRIORITIES.find((option) => option.value === project.priority)?.detail}
          </p>
        ) : null}
        <ActionFeedback state={priorityState} />
      </form>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#C9E3D7]">
        <div
          className="h-full rounded-full bg-[var(--federation-secondary)] transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <QuoteMetric label="Coût final" value={formatMoney(project.finalCost, currency)} />
        <QuoteMetric label="Délai final" value={`${project.finalDurationDays} jours`} />
        <QuoteMetric
          label="Économie"
          value={formatMoney(project.baseCost - project.finalCost, currency)}
        />
        <QuoteMetric
          label="Temps gagné"
          value={`${project.baseDurationDays - project.finalDurationDays} jour(s)`}
        />
      </dl>
      {project.architects.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-[var(--federation-secondary)]/15 pt-4">
          {project.architects.map((architect) => (
            <li
              key={architect.contractId}
              className="grid gap-2 rounded-xl bg-white p-3 text-xs font-bold text-[#60756E] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="min-w-0">
                <span className="block truncate font-black text-[#183F37]">
                  {architect.name} · N{architect.level}
                </span>
                <span className="mt-1 block truncate text-[10px]">
                  {architect.teamName} · {architect.specialty}
                </span>
              </span>
              <span className="shrink-0 text-[var(--federation-secondary)]">
                +{formatMoney(architect.costRefund, currency)} · −{architect.savedDays} j
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-[10px] font-semibold leading-4 text-[#60756E]">
        Si son contrat prend fin, l’architecte quitte automatiquement le
        chantier et les montants ainsi que la livraison sont recalculés.
      </p>
      <ArchitectContributionForm
        countryCode={countryCode}
        projectId={project.id}
        architects={state?.availableArchitects ?? []}
        disabled={!canContribute}
        disabledReason={
          project.viewerTeamHasContributed
            ? "Votre club contribue déjà à ce chantier."
            : !hasCapacity
              ? "Le plafond de cinq architectes est atteint."
              : !state?.canContribute
                ? "Réservé aux équipes affiliées."
                : (state?.availableArchitects.length ?? 0) === 0
                  ? "Aucun architecte libre dans votre staff."
                  : null
        }
      />
    </aside>
  );
}

function LaunchProjectForm({
  countryCode,
  infrastructureCode,
  targetLevel,
  priority,
  disabled,
  disabledReason,
}: {
  countryCode: string;
  infrastructureCode: string;
  targetLevel: number;
  priority: FederationConstructionPriority;
  disabled: boolean;
  disabledReason: string | null;
}) {
  const [state, action, pending] = useActionState(
    startFederationInfrastructureProjectAction,
    initialFederationInfrastructureActionState,
  );
  return (
    <form action={action} className="mt-5">
      <input type="hidden" name="countryCode" value={countryCode} />
      <input type="hidden" name="infrastructureCode" value={infrastructureCode} />
      <input type="hidden" name="priority" value={priority} />
      <button
        type="submit"
        disabled={disabled || pending}
        className="min-h-11 w-full rounded-xl bg-[var(--federation-primary)] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#9AA9A3]"
      >
        {pending ? "Lancement…" : `Lancer le niveau ${targetLevel}`}
      </button>
      {disabledReason ? (
        <p className="mt-3 text-xs font-bold text-[#9D3E37]">{disabledReason}</p>
      ) : null}
      <ActionFeedback state={state} />
    </form>
  );
}

function ArchitectContributionForm({
  countryCode,
  projectId,
  architects,
  disabled,
  disabledReason,
}: {
  countryCode: string;
  projectId: string;
  architects: FederationInfrastructureState["availableArchitects"];
  disabled: boolean;
  disabledReason: string | null;
}) {
  const [selectedArchitect, setSelectedArchitect] = useState(
    architects[0]?.contractId ?? "",
  );
  const [state, action, pending] = useActionState(
    contributeArchitectToFederationProjectAction,
    initialFederationInfrastructureActionState,
  );
  return (
    <form action={action} className="mt-5 border-t border-[var(--federation-secondary)]/15 pt-4">
      <input type="hidden" name="countryCode" value={countryCode} />
      <input type="hidden" name="projectId" value={projectId} />
      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#60756E]">
          Architecte de votre club
        </span>
        <select
          name="staffContractId"
          value={selectedArchitect}
          disabled={disabled}
          onChange={(event) => setSelectedArchitect(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] disabled:cursor-not-allowed disabled:bg-[#EDF1EF]"
        >
          {architects.length === 0 ? (
            <option value="">Aucun architecte disponible</option>
          ) : null}
          {architects.map((architect) => (
            <option key={architect.contractId} value={architect.contractId}>
              {architect.firstName} {architect.lastName} · N{architect.level} · {architect.specialty}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={disabled || pending || !selectedArchitect}
        className="mt-3 min-h-11 w-full rounded-xl border border-[var(--federation-secondary)]/25 bg-white px-4 text-sm font-black text-[var(--federation-secondary)] disabled:cursor-not-allowed disabled:text-[#9AA9A3]"
      >
        {pending ? "Affectation…" : "Affecter au chantier"}
      </button>
      {disabledReason ? (
        <p className="mt-3 text-xs font-bold text-[#60756E]">{disabledReason}</p>
      ) : null}
      <ActionFeedback state={state} />
    </form>
  );
}

function ActionFeedback({ state }: { state: FederationInfrastructureActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      role="status"
      className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${
        state.status === "success"
          ? "bg-white text-[var(--federation-secondary)]"
          : "bg-[#FFF2F0] text-[#9D3E37]"
      }`}
    >
      {state.message}
    </p>
  );
}

function QuoteMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-[#806300]">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-black text-[#183F37]">{value}</dd>
    </div>
  );
}

function formatMoney(value: number, currency: string): string {
  if (currency === "EUR") return moneyFormatter.format(value);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
