"use client";

import { useActionState, useState } from "react";

import {
  createFederationRaceAction,
  initialFederationGovernanceActionState,
} from "@/app/jeu/federations/governance-actions";
import {
  FEDERATION_RACE_CATEGORY_OPTIONS,
  FEDERATION_RACE_CREATION_START_GAME_YEAR,
  getFederationRaceScheduledSlot,
  getFederationRaceStageDistance,
  type FederationRaceCategoryCode,
  type FederationRaceDaySlot,
  type FederationRaceFormat,
  type FederationRaceProfileType,
  type FederationRaceStageBlueprint,
  type FederationRaceStageType,
  type FederationRaceSurfaceType,
  type FederationRaceTerrainType,
} from "@/lib/game/federation-race-creation";
import type { FederationRaceCreationState } from "@/services/federation-race-creation";

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-[#315B3E]/18 bg-white px-3 text-sm font-bold text-[#183F37] outline-none transition focus:border-[var(--federation-secondary,#278B70)] disabled:cursor-not-allowed disabled:bg-[#EEF3F1]";

const STAGE_TYPE_OPTIONS: Array<{
  value: FederationRaceStageType;
  label: string;
}> = [
  { value: "road", label: "Route" },
  { value: "individual_time_trial", label: "CLM individuel" },
  { value: "team_time_trial", label: "CLM par équipes" },
  { value: "prologue", label: "Prologue" },
];

const PROFILE_OPTIONS: Array<{
  value: FederationRaceProfileType;
  label: string;
}> = [
  { value: "flat", label: "Plat" },
  { value: "sprint", label: "Sprint" },
  { value: "hilly", label: "Vallonné" },
  { value: "mountain", label: "Montagne" },
  { value: "cobbles", label: "Pavés" },
  { value: "mixed", label: "Mixte" },
  { value: "time_trial", label: "Chrono" },
];

const TERRAIN_OPTIONS: Array<{
  value: FederationRaceTerrainType;
  label: string;
}> = [
  { value: "flat", label: "Plat" },
  { value: "climb", label: "Montée" },
  { value: "descent", label: "Descente" },
];

export function FederationRaceCreationPanel({
  countryCode,
  gameYear,
  state,
}: {
  countryCode: string;
  gameYear: number;
  state: FederationRaceCreationState;
}) {
  const [actionState, action, pending] = useActionState(
    createFederationRaceAction,
    initialFederationGovernanceActionState,
  );
  const [raceFormat, setRaceFormat] =
    useState<FederationRaceFormat>("one_day");
  const [categoryCode, setCategoryCode] =
    useState<FederationRaceCategoryCode>("national");
  const [startDay, setStartDay] = useState(12);
  const [startSlot, setStartSlot] =
    useState<FederationRaceDaySlot>("early");
  const [stages, setStages] = useState<FederationRaceStageBlueprint[]>([
    createDefaultStage(1),
  ]);

  const setFormat = (format: FederationRaceFormat) => {
    setRaceFormat(format);
    setStages((current) => {
      if (format === "one_day") return [current[0] ?? createDefaultStage(1)];
      return current.length >= 2
        ? current
        : [current[0] ?? createDefaultStage(1), createDefaultStage(2)];
    });
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
      <div className="grid gap-6 bg-[linear-gradient(135deg,var(--federation-primary,#102F2A)_0%,var(--federation-secondary,#176951)_100%)] p-6 text-white sm:p-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
            Homologation fédérale · active en Saison 4
          </p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">
            Créer une course du pays
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6E9E2]">
            Une attribution exceptionnelle, gagnée par les résultats et les
            objectifs de la fédération. Le parcours homologué rejoint le
            calendrier de la saison suivante.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#B8DDCF]">
              Indice d’homologation
            </p>
            <p className="mt-1 text-3xl font-black">
              {state.score.total}
              <span className="text-base text-[#B8DDCF]">
                /{state.score.threshold}
              </span>
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
              state.score.eligible
                ? "bg-[var(--federation-accent,#9BE0BC)] text-[var(--federation-primary,#123F36)]"
                : "bg-[#F2C94C] text-[#4A3A00]"
            }`}
          >
            {state.score.eligible ? "Seuil atteint" : "À consolider"}
          </span>
        </div>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        <ScoreBreakdown state={state} gameYear={gameYear} />

        {state.project ? (
          <ScheduledProject project={state.project} />
        ) : state.canCreate ? (
          <form action={action} className="space-y-6">
            <input type="hidden" name="countryCode" value={countryCode} />
            <input
              type="hidden"
              name="blueprint"
              value={JSON.stringify({
                raceFormat,
                categoryCode,
                startDay,
                startSlot,
                stages,
              })}
            />

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <Field label="Nom officiel" className="xl:col-span-2">
                <input
                  className={fieldClassName}
                  name="name"
                  minLength={4}
                  maxLength={80}
                  placeholder="Tour des Flandres fédéral"
                  required
                />
              </Field>
              <Field label="Sigle calendrier">
                <input
                  className={fieldClassName}
                  name="shortName"
                  minLength={2}
                  maxLength={12}
                  placeholder="TFF"
                  required
                />
              </Field>
              <Field label="Rang de la course">
                <select
                  className={fieldClassName}
                  value={categoryCode}
                  onChange={(event) =>
                    setCategoryCode(
                      event.target.value as FederationRaceCategoryCode,
                    )
                  }
                >
                  {FEDERATION_RACE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Format">
                <select
                  className={fieldClassName}
                  value={raceFormat}
                  onChange={(event) =>
                    setFormat(event.target.value as FederationRaceFormat)
                  }
                >
                  <option value="one_day">Classique</option>
                  <option value="stage_race">Tour par étapes</option>
                </select>
              </Field>
              <Field label="Jour de départ">
                <input
                  className={fieldClassName}
                  type="number"
                  min={1}
                  max={28}
                  value={startDay}
                  onChange={(event) => setStartDay(Number(event.target.value))}
                  required
                />
              </Field>
              <Field label="Vague de départ">
                <select
                  className={fieldClassName}
                  value={startSlot}
                  onChange={(event) =>
                    setStartSlot(event.target.value as FederationRaceDaySlot)
                  }
                >
                  <option value="early">14 h</option>
                  <option value="late">18 h</option>
                </select>
              </Field>
              <div className="rounded-xl bg-[var(--federation-soft,#E5F4ED)] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--federation-secondary,#278B70)]">
                  Programmation
                </p>
                <p className="mt-1 text-sm font-black text-[#183F37]">
                  {stages.length} étape{stages.length > 1 ? "s" : ""} · fin J
                  {getFederationRaceScheduledSlot({
                    startDay,
                    startSlot,
                    stageIndex: stages.length - 1,
                  }).dayNumber}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {stages.map((stage, stageIndex) => (
                <StageEditor
                  key={stageIndex}
                  stage={stage}
                  stageIndex={stageIndex}
                  startDay={startDay}
                  startSlot={startSlot}
                  canRemove={raceFormat === "stage_race" && stages.length > 2}
                  onChange={(next) =>
                    setStages((current) =>
                      current.map((item, index) =>
                        index === stageIndex ? next : item,
                      ),
                    )
                  }
                  onRemove={() =>
                    setStages((current) =>
                      current.filter((_, index) => index !== stageIndex),
                    )
                  }
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-3">
                {raceFormat === "stage_race" && stages.length < 8 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setStages((current) => [
                        ...current,
                        createDefaultStage(current.length + 1),
                      ])
                    }
                    className="min-h-11 rounded-xl border border-[var(--federation-secondary,#176951)]/25 bg-[var(--federation-soft,#E5F4ED)] px-4 text-sm font-black text-[var(--federation-secondary,#176951)]"
                  >
                    + Ajouter une étape
                  </button>
                ) : null}
                <p className="self-center text-xs font-bold text-[#60756E]">
                  8 étapes et 12 tronçons par étape au maximum.
                </p>
              </div>
              <button
                type="submit"
                disabled={pending}
                className="min-h-12 rounded-xl bg-[var(--federation-primary,#123F36)] px-6 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#9AA9A3]"
              >
                {pending ? "Homologation…" : "Homologuer la course"}
              </button>
            </div>
            <ActionFeedback
              status={actionState.status}
              message={actionState.message}
            />
          </form>
        ) : (
          <LockedCreationNotice state={state} gameYear={gameYear} />
        )}
      </div>
    </section>
  );
}

function ScoreBreakdown({
  state,
  gameYear,
}: {
  state: FederationRaceCreationState;
  gameYear: number;
}) {
  const items = [
    {
      label: "Classement national",
      value: `+${state.score.rankingPoints}`,
      detail: state.score.nationRank ? `Rang #${state.score.nationRank}` : "Non classée",
    },
    {
      label: "Objectifs validés",
      value: `+${state.score.objectivePoints}`,
      detail: `${state.score.completedObjectiveCount}/5 objectifs`,
    },
    {
      label: "Courses déjà présentes",
      value: `−${state.score.calendarPenalty}`,
      detail: `${state.score.existingRaceCount} course${state.score.existingRaceCount > 1 ? "s" : ""} du pays`,
    },
    {
      label: "Bureau d’organisation",
      value: `Niv. ${state.officeLevel}`,
      detail: state.officeLevel >= 1 ? "Prérequis acquis" : "Niveau 1 requis",
    },
  ];
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-4"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.11em] text-[#60756E]">
              {item.label}
            </p>
            <p className="mt-2 text-2xl font-black text-[#183F37]">
              {item.value}
            </p>
            <p className="mt-1 text-xs font-bold text-[var(--federation-secondary,#278B70)]">{item.detail}</p>
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-[#60756E]">
        Formule : classement (40 points maximum) + 15 points par objectif − 10
        points par course existante. Seuil 60. Une seule homologation par
        fédération et par saison, à partir de S
        {FEDERATION_RACE_CREATION_START_GAME_YEAR}
        {gameYear < FEDERATION_RACE_CREATION_START_GAME_YEAR ? " (verrouillée actuellement)" : ""}.
      </p>
    </div>
  );
}

function LockedCreationNotice({
  state,
  gameYear,
}: {
  state: FederationRaceCreationState;
  gameYear: number;
}) {
  const conditions = [
    {
      label: "Saison 4 ouverte",
      complete: gameYear >= FEDERATION_RACE_CREATION_START_GAME_YEAR,
    },
    { label: "Président élu connecté", complete: state.viewerIsPresident },
    { label: "Bureau d’organisation niveau 1", complete: state.officeLevel >= 1 },
    {
      label: `Indice au moins égal à ${state.score.threshold}`,
      complete: state.score.eligible,
    },
  ];
  return (
    <div className="rounded-2xl border border-[#D5AC18]/30 bg-[#FFF9DE] p-5">
      <p className="font-black text-[#4A3A00]">
        Le formulaire s’ouvrira lorsque toutes les conditions seront réunies.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {conditions.map((condition) => (
          <p
            key={condition.label}
            className="rounded-xl bg-white/70 px-4 py-3 text-sm font-bold text-[#4A3A00]"
          >
            {condition.complete ? "✓" : "○"} {condition.label}
          </p>
        ))}
      </div>
    </div>
  );
}

function ScheduledProject({
  project,
}: {
  project: NonNullable<FederationRaceCreationState["project"]>;
}) {
  const category = FEDERATION_RACE_CATEGORY_OPTIONS.find(
    (option) => option.code === project.categoryCode,
  );
  return (
    <article className="rounded-2xl border border-[var(--federation-secondary,#278B70)]/35 bg-[var(--federation-soft,#E5F4ED)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--federation-secondary,#278B70)]">
            Course homologuée · Saison {project.activationGameYear}
          </p>
          <h3 className="mt-2 text-2xl font-black text-[#183F37]">
            {project.name} <span className="text-[#60756E]">({project.shortName})</span>
          </h3>
          <p className="mt-2 text-sm font-semibold text-[#60756E]">
            {project.raceFormat === "one_day" ? "Classique" : "Tour"} · {category?.label ?? project.categoryCode} · départ J{project.startDay} à {project.startSlot === "early" ? "14 h" : "18 h"}
          </p>
        </div>
        <span className="rounded-full bg-[var(--federation-secondary,#176951)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white">
          Programmée
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {project.stages.map((stage, index) => {
          const slot = getFederationRaceScheduledSlot({
            startDay: project.startDay,
            startSlot: project.startSlot,
            stageIndex: index,
          });
          return (
            <div key={`${stage.name}-${index}`} className="rounded-xl bg-white/75 p-4">
              <p className="text-xs font-black text-[#183F37]">{stage.name}</p>
              <p className="mt-1 text-[11px] font-bold text-[#60756E]">
                J{slot.dayNumber} · {slot.daySlot === "early" ? "14 h" : "18 h"} · {formatDistance(getFederationRaceStageDistance(stage))}
              </p>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function StageEditor({
  stage,
  stageIndex,
  startDay,
  startSlot,
  canRemove,
  onChange,
  onRemove,
}: {
  stage: FederationRaceStageBlueprint;
  stageIndex: number;
  startDay: number;
  startSlot: FederationRaceDaySlot;
  canRemove: boolean;
  onChange: (stage: FederationRaceStageBlueprint) => void;
  onRemove: () => void;
}) {
  const schedule = getFederationRaceScheduledSlot({
    startDay,
    startSlot,
    stageIndex,
  });
  const updateSegment = (
    segmentIndex: number,
    patch: Partial<FederationRaceStageBlueprint["segments"][number]>,
  ) => {
    onChange({
      ...stage,
      segments: stage.segments.map((segment, index) =>
        index === segmentIndex ? { ...segment, ...patch } : segment,
      ),
    });
  };

  return (
    <article className="rounded-2xl border border-[#315B3E]/14 bg-[#F8FBF9] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.13em] text-[var(--federation-secondary,#278B70)]">
            Étape {stageIndex + 1} · J{schedule.dayNumber} · {schedule.daySlot === "early" ? "14 h" : "18 h"}
          </p>
          <p className="mt-1 text-sm font-black text-[#183F37]">
            {formatDistance(getFederationRaceStageDistance(stage))}
          </p>
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-[#B54A3A]/20 bg-white px-3 py-2 text-xs font-black text-[#B54A3A]"
          >
            Retirer l’étape
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Field label="Nom de l’étape">
          <input
            className={fieldClassName}
            value={stage.name}
            minLength={3}
            maxLength={80}
            onChange={(event) => onChange({ ...stage, name: event.target.value })}
            required
          />
        </Field>
        <Field label="Type d’étape">
          <select
            className={fieldClassName}
            value={stage.stageType}
            onChange={(event) => {
              const stageType = event.target.value as FederationRaceStageType;
              onChange({
                ...stage,
                stageType,
                profileType:
                  stageType === "road"
                    ? stage.profileType === "time_trial"
                      ? "hilly"
                      : stage.profileType
                    : "time_trial",
              });
            }}
          >
            {STAGE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Profil officiel">
          <select
            className={fieldClassName}
            value={stage.profileType}
            onChange={(event) =>
              onChange({
                ...stage,
                profileType: event.target.value as FederationRaceProfileType,
              })
            }
            disabled={stage.stageType !== "road"}
          >
            {PROFILE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-5 space-y-2">
        <div className="hidden grid-cols-[70px_minmax(92px,1fr)_minmax(100px,1fr)_minmax(100px,1fr)_90px_42px] gap-2 px-2 text-[9px] font-black uppercase tracking-[0.1em] text-[#60756E] lg:grid">
          <span>Tronçon</span><span>Longueur</span><span>Relief</span><span>Surface</span><span>Pente</span><span />
        </div>
        {stage.segments.map((segment, segmentIndex) => (
          <div
            key={segmentIndex}
            className="grid gap-2 rounded-xl border border-[#315B3E]/10 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[70px_minmax(92px,1fr)_minmax(100px,1fr)_minmax(100px,1fr)_90px_42px] lg:items-center"
          >
            <span className="text-xs font-black text-[var(--federation-secondary,#278B70)]">
              #{segmentIndex + 1}
            </span>
            <input
              aria-label={`Longueur du tronçon ${segmentIndex + 1}`}
              className={fieldClassName}
              type="number"
              min={2}
              max={250}
              step={0.1}
              value={segment.distanceKm}
              onChange={(event) =>
                updateSegment(segmentIndex, {
                  distanceKm: Number(event.target.value),
                })
              }
              required
            />
            <select
              aria-label={`Relief du tronçon ${segmentIndex + 1}`}
              className={fieldClassName}
              value={segment.terrainType}
              onChange={(event) => {
                const terrainType = event.target.value as FederationRaceTerrainType;
                updateSegment(segmentIndex, {
                  terrainType,
                  averageGradientPct:
                    terrainType === "flat" ? 0 : terrainType === "climb" ? 4 : -3,
                });
              }}
            >
              {TERRAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label={`Surface du tronçon ${segmentIndex + 1}`}
              className={fieldClassName}
              value={segment.surfaceType}
              onChange={(event) =>
                updateSegment(segmentIndex, {
                  surfaceType: event.target.value as FederationRaceSurfaceType,
                })
              }
            >
              <option value="asphalt">Asphalte</option>
              <option value="cobbles">Pavés</option>
            </select>
            <input
              aria-label={`Pente du tronçon ${segmentIndex + 1}`}
              className={fieldClassName}
              type="number"
              min={-30}
              max={30}
              step={0.1}
              value={segment.averageGradientPct}
              disabled={segment.terrainType === "flat"}
              onChange={(event) =>
                updateSegment(segmentIndex, {
                  averageGradientPct: Number(event.target.value),
                })
              }
              required
            />
            <button
              type="button"
              aria-label={`Supprimer le tronçon ${segmentIndex + 1}`}
              disabled={stage.segments.length === 1}
              onClick={() =>
                onChange({
                  ...stage,
                  segments: stage.segments.filter((_, index) => index !== segmentIndex),
                })
              }
              className="h-10 rounded-lg text-lg font-black text-[#B54A3A] disabled:text-[#AAB5B1]"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {stage.segments.length < 12 ? (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...stage,
              segments: [...stage.segments, createDefaultSegment()],
            })
          }
          className="mt-3 rounded-lg border border-[var(--federation-secondary,#176951)]/20 bg-white px-3 py-2 text-xs font-black text-[var(--federation-secondary,#176951)]"
        >
          + Ajouter un tronçon
        </button>
      ) : null}
    </article>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.11em] text-[#60756E]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ActionFeedback({
  status,
  message,
}: {
  status: "idle" | "success" | "error";
  message: string;
}) {
  if (status === "idle" || !message) return null;
  return (
    <p
      role={status === "error" ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-sm font-bold ${
        status === "success"
          ? "bg-[var(--federation-soft,#E5F4ED)] text-[var(--federation-secondary,#176951)]"
          : "bg-[#FBE9E5] text-[#9B392C]"
      }`}
    >
      {message}
    </p>
  );
}

function createDefaultStage(index: number): FederationRaceStageBlueprint {
  return {
    name: `Étape ${index}`,
    stageType: "road",
    profileType: "hilly",
    segments: [
      {
        distanceKm: 70,
        terrainType: "flat",
        surfaceType: "asphalt",
        averageGradientPct: 0,
      },
      {
        distanceKm: 35,
        terrainType: "climb",
        surfaceType: "asphalt",
        averageGradientPct: 4,
      },
      {
        distanceKm: 45,
        terrainType: "descent",
        surfaceType: "asphalt",
        averageGradientPct: -3,
      },
    ],
  };
}

function createDefaultSegment(): FederationRaceStageBlueprint["segments"][number] {
  return {
    distanceKm: 20,
    terrainType: "flat",
    surfaceType: "asphalt",
    averageGradientPct: 0,
  };
}

function formatDistance(distance: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(distance)} km`;
}
