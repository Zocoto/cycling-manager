"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import {
  contributeArchitectToFederationProjectAction,
  initialFederationInfrastructureActionState,
  startFederationInfrastructureProjectAction,
  type FederationInfrastructureActionState,
} from "@/app/jeu/federations/infrastructure-actions";
import {
  FEDERATION_INFRASTRUCTURE_DEFINITIONS,
  MAX_FEDERATION_PROJECT_ARCHITECTS,
  calculateFederationConstructionPreview,
  type FederationConstructionPriority,
  type FederationInfrastructureDefinition,
} from "@/lib/game/federation-infrastructures";
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
  const [previewArchitectCount, setPreviewArchitectCount] = useState(0);
  const [priority, setPriority] =
    useState<FederationConstructionPriority>("balanced");
  const activeProjectCount = infrastructureState?.activeProjects.length ?? 0;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
        <div className="grid gap-6 bg-[#123F36] p-6 text-white sm:p-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)] xl:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
              Cellule des grands travaux · {managementLocked ? "Préparation S3" : "Gestion active"}
            </p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">
              Neuf infrastructures, cinq niveaux chacune
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
              Les bâtiments sont financés par la trésorerie fédérale. Les
              effets sont modestes, plafonnés et figés par saison afin de ne pas
              créer de recalcul pendant les courses.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <CatalogMetric label="Bâtiments" value="9" />
            <CatalogMetric
              label={managementLocked ? "Niveaux" : "Chantiers"}
              value={managementLocked ? "45" : String(activeProjectCount)}
            />
            <CatalogMetric
              label="Architectes libres"
              value={
                managementLocked
                  ? "0–5"
                  : String(infrastructureState?.availableArchitects.length ?? 0)
              }
            />
          </div>
        </div>

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(260px,0.55fr)]">
          {managementLocked ? (
            <label className="block">
              <span className="flex items-center justify-between gap-4 text-sm font-black text-[#183F37]">
                <span>Simulation des architectes affiliés</span>
                <span className="rounded-full bg-[#DDF3E7] px-3 py-1 text-xs text-[#176951]">
                  {previewArchitectCount}/{MAX_FEDERATION_PROJECT_ARCHITECTS}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={MAX_FEDERATION_PROJECT_ARCHITECTS}
                value={previewArchitectCount}
                onChange={(event) =>
                  setPreviewArchitectCount(Number(event.target.value))
                }
                className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#DDE8E2] accent-[#176951]"
              />
              <span className="mt-3 block text-xs font-semibold leading-5 text-[#60756E]">
                Cette jauge sert uniquement à comparer les futurs devis. En S3,
                chaque club pourra affecter un architecte réel par chantier.
              </span>
            </label>
          ) : (
            <div className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#60756E]">
                Trésorerie disponible
              </p>
              <p className="mt-2 text-2xl font-black text-[#183F37]">
                {infrastructureState?.balance == null
                  ? "Initialisation en cours"
                  : formatMoney(infrastructureState.balance, currency)}
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
                Le coût brut est débité au lancement. Les économies apportées
                ensuite par les architectes sont recréditées automatiquement.
              </p>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[#60756E]">
              Priorité des prochains chantiers
            </span>
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as FederationConstructionPriority)
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/18 bg-[#F8FBF9] px-4 text-sm font-black text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#42B99A]/25"
            >
              {PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs font-semibold text-[#60756E]">
              {PRIORITIES.find((option) => option.value === priority)?.detail}
            </span>
          </label>
        </div>

        <p className="border-t border-[#315B3E]/10 bg-[#FFF9DE] px-6 py-4 text-xs font-bold leading-5 text-[#75631C] sm:px-8">
          Jusqu’à cinq clubs différents peuvent affecter chacun un architecte
          à un chantier. Un architecte déjà mobilisé sur un bâtiment de club ou
          fédéral n’est jamais proposé.
        </p>
      </section>

      {FEDERATION_INFRASTRUCTURE_DEFINITIONS.map((definition) => (
        <FederationInfrastructureCard
          key={definition.code}
          countryCode={countryCode}
          definition={definition}
          previewArchitectCount={previewArchitectCount}
          priority={priority}
          currency={currency}
          managementLocked={managementLocked}
          currentLevel={infrastructureState?.levels[definition.code] ?? 0}
          activeProject={
            infrastructureState?.activeProjects.find(
              (project) => project.code === definition.code,
            ) ?? null
          }
          infrastructureState={infrastructureState}
        />
      ))}
    </div>
  );
}

function FederationInfrastructureCard({
  countryCode,
  definition,
  previewArchitectCount,
  priority,
  currency,
  managementLocked,
  currentLevel,
  activeProject,
  infrastructureState,
}: {
  countryCode: string;
  definition: FederationInfrastructureDefinition;
  previewArchitectCount: number;
  priority: FederationConstructionPriority;
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
        architectCount: managementLocked ? previewArchitectCount : 0,
        priority,
      })
    : null;
  const balance = infrastructureState?.balance ?? 0;
  const insufficientFunds = Boolean(quote && balance < quote.cost);

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
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#278B70]">
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
                    ? "border-[#278B70]/45 bg-[#DDF3E7]"
                    : selectedLevel === candidate.level
                      ? "border-[#278B70]/55 bg-[#EAF7F1] shadow-sm"
                      : "border-[#315B3E]/10 bg-[#F6F8F6] hover:border-[#278B70]/30"
                }`}
              >
                <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
                  Niveau {candidate.level}
                  {currentLevel >= candidate.level ? " · acquis" : ""}
                </span>
                <span className="mt-1 block text-xs font-bold leading-5 text-[#183F37]">
                  {candidate.effect}
                </span>
                <span className="mt-3 block text-[10px] font-black text-[#278B70]">
                  {formatMoney(candidate.cost, currency)} · {candidate.durationDays} j
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 rounded-xl border border-[#315B3E]/10 bg-[#F8FBF9] px-4 py-3 text-xs font-semibold leading-5 text-[#60756E]">
            <strong className="text-[#183F37]">Garde-fou :</strong>{" "}
            {definition.principle}
          </p>
        </div>

        {activeProject ? (
          <ActiveProjectPanel
            countryCode={countryCode}
            project={activeProject}
            state={infrastructureState}
            currency={currency}
          />
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
                priority={priority}
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
          <aside className="h-fit rounded-2xl border border-[#278B70]/25 bg-[#E5F4ED] p-5 text-sm font-black text-[#176951]">
            Niveau maximal atteint. Aucun nouveau chantier n’est nécessaire.
          </aside>
        )}
      </div>
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
    <aside className="h-fit rounded-2xl border border-[#278B70]/30 bg-[#EAF7F1] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#176951]">
            Chantier en cours · niveau {project.targetLevel}
          </p>
          <p className="mt-2 text-xl font-black text-[#183F37]">
            {project.remainingDays > 0
              ? `${project.remainingDays} jour${project.remainingDays > 1 ? "s" : ""} restant${project.remainingDays > 1 ? "s" : ""}`
              : "Livraison imminente"}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#176951]">
          {project.architectCount}/5
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#C9E3D7]">
        <div
          className="h-full rounded-full bg-[#278B70] transition-[width]"
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
        <ul className="mt-4 space-y-2 border-t border-[#278B70]/15 pt-4">
          {project.architects.map((architect) => (
            <li
              key={architect.teamId}
              className="flex items-center justify-between gap-3 text-xs font-bold text-[#60756E]"
            >
              <span className="truncate">{architect.teamName}</span>
              <span className="shrink-0 text-[#176951]">
                +{formatMoney(architect.costRefund, currency)} · −{architect.savedDays} j
              </span>
            </li>
          ))}
        </ul>
      ) : null}
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
        className="min-h-11 w-full rounded-xl bg-[#123F36] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#9AA9A3]"
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
    <form action={action} className="mt-5 border-t border-[#278B70]/15 pt-4">
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
        className="mt-3 min-h-11 w-full rounded-xl border border-[#176951]/25 bg-white px-4 text-sm font-black text-[#176951] disabled:cursor-not-allowed disabled:text-[#9AA9A3]"
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
          ? "bg-white text-[#176951]"
          : "bg-[#FFF2F0] text-[#9D3E37]"
      }`}
    >
      {state.message}
    </p>
  );
}

function CatalogMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#BFD1C6]">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
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
