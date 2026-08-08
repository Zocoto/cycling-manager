"use client";

import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useFormStatus } from "react-dom";

import type {
  RaceCalendarStage,
  RaceFormat,
} from "@/lib/game/race-calendar";
import { getStageLiveState } from "@/lib/game/race-live";
import {
  RACE_ROLES,
  RACE_ROLE_LABELS,
  type RaceRole,
} from "@/lib/game/race-simulation";
import {
  MAX_RACE_ATTACK_ORDERS,
  RACE_ATTACK_CONDITIONS,
  RACE_ATTACK_CONDITION_LABELS,
  RACE_ATTACK_INTENSITIES,
  RACE_ATTACK_INTENSITY_LABELS,
  RACE_BREAKAWAY_POLICIES,
  RACE_BREAKAWAY_POLICY_LABELS,
  RACE_CHASE_POLICIES,
  RACE_CHASE_POLICY_LABELS,
  RACE_COLLECTIVE_POSTURES,
  RACE_COLLECTIVE_POSTURE_LABELS,
  RACE_STRATEGY_OBJECTIVES,
  RACE_STRATEGY_OBJECTIVE_LABELS,
  type RaceAttackOrder,
  type RaceBreakawayPolicy,
  type RaceChasePolicy,
  type RaceCollectivePosture,
  type RaceStrategyObjective,
} from "@/lib/game/race-strategy";
import type {
  RacePreparationEditionPlan,
  RacePreparationRider,
  RaceStagePreparationPlan,
} from "@/services/race-calendar";

export type RacePreparationWorkspaceEdition = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  countryCode: string;
  raceFormat: RaceFormat;
  stages: RaceCalendarStage[];
  plan: RacePreparationEditionPlan;
};

type RacePreparationWorkspaceProps = {
  action: (formData: FormData) => Promise<void>;
  editions: RacePreparationWorkspaceEdition[];
  nowIso: string;
  initialSlug?: string;
};

export function RacePreparationWorkspace({
  action,
  editions,
  nowIso,
  initialSlug,
}: RacePreparationWorkspaceProps) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const firstEditableEdition = editions.find((edition) =>
    edition.stages.some(
      (stage) => getStageLiveState(stage, now).status === "scheduled",
    ),
  );
  const initialEdition =
    editions.find((edition) => edition.slug === initialSlug) ??
    firstEditableEdition ??
    editions[0];
  const [selectedEditionId, setSelectedEditionId] = useState(
    initialEdition?.id ?? "",
  );
  const selectedEdition =
    editions.find((edition) => edition.id === selectedEditionId) ?? editions[0];

  if (!selectedEdition) return null;

  const orderedStages = [...selectedEdition.stages].sort(
    (first, second) => first.stageNumber - second.stageNumber,
  );
  const nextEditableStageId = orderedStages.find(
    (stage) => getStageLiveState(stage, now).status === "scheduled",
  )?.id;

  return (
    <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="self-start rounded-3xl border border-[#315B3E]/15 bg-white p-4 shadow-[0_18px_45px_rgba(19,60,46,0.1)] xl:sticky xl:top-5">
        <p className="px-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#397A67]">
          Courses engagées
        </p>
        <div className="mt-3 space-y-2" role="list">
          {editions.map((edition) => {
            const isSelected = edition.id === selectedEdition.id;
            const editableCount = edition.stages.filter(
              (stage) => getStageLiveState(stage, now).status === "scheduled",
            ).length;

            return (
              <button
                key={edition.id}
                type="button"
                onClick={() => setSelectedEditionId(edition.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] ${
                  isSelected
                    ? "border-[#278B70] bg-[#EAF5F0] text-[#0B302B]"
                    : "border-[#315B3E]/12 bg-[#F8FBF9] text-[#315B3E] hover:border-[#278B70]/45"
                }`}
              >
                <span className="block text-sm font-black">
                  {edition.shortName ?? edition.name}
                </span>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-[#66877C]">
                  {editableCount > 0
                    ? `${editableCount} étape${editableCount > 1 ? "s" : ""} à préparer`
                    : "Plan verrouillé"}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0">
        <header className="overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-7 text-white shadow-[0_22px_55px_rgba(7,26,23,0.18)] sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
                {selectedEdition.raceFormat === "stage_race"
                  ? "Plan du tour"
                  : "Plan de la course"}
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {selectedEdition.name}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#D6DFD2]">
                Les consignes sont figées au départ de chaque étape et intégrées
                à son unique simulation officielle.
              </p>
            </div>
            <span
              className={`fi fi-${selectedEdition.countryCode.toLowerCase()} rounded-sm text-3xl shadow`}
            />
          </div>
        </header>

        <div className="mt-5 space-y-4">
          {orderedStages.map((stage) => (
            <StagePreparationForm
              key={`${selectedEdition.id}:${stage.id}`}
              action={action}
              edition={selectedEdition}
              stage={stage}
              riders={selectedEdition.plan.riders}
              strategy={selectedEdition.plan.stages[stage.id]}
              now={now}
              initiallyOpen={stage.id === nextEditableStageId}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function StagePreparationForm({
  action,
  edition,
  stage,
  riders,
  strategy,
  now,
  initiallyOpen,
}: {
  action: (formData: FormData) => Promise<void>;
  edition: RacePreparationWorkspaceEdition;
  stage: RaceCalendarStage;
  riders: RacePreparationRider[];
  strategy: RaceStagePreparationPlan;
  now: Date;
  initiallyOpen: boolean;
}) {
  const [roles, setRoles] = useState<Record<string, RaceRole>>(() =>
    Object.fromEntries(
      riders.map((rider) => [
        rider.riderId,
        rider.stageRoles[stage.id] ?? rider.generalRole,
      ]),
    ),
  );
  const [objective, setObjective] = useState<RaceStrategyObjective>(
    strategy.objective,
  );
  const [collectivePosture, setCollectivePosture] =
    useState<RaceCollectivePosture>(strategy.collectivePosture);
  const [breakawayPolicy, setBreakawayPolicy] =
    useState<RaceBreakawayPolicy>(strategy.breakawayPolicy);
  const [chasePolicy, setChasePolicy] = useState<RaceChasePolicy>(
    strategy.chasePolicy,
  );
  const [missions, setMissions] = useState({
    lieutenantRiderId: strategy.lieutenantRiderId ?? "",
    dangerPacerRiderId: strategy.dangerPacerRiderId ?? "",
    protectorRiderId: strategy.protectorRiderId ?? "",
    breakawayRiderId: strategy.breakawayRiderId ?? "",
  });
  const [attackOrders, setAttackOrders] = useState<RaceAttackOrder[]>(
    strategy.attackOrders.slice(0, MAX_RACE_ATTACK_ORDERS),
  );
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const liveState = getStageLiveState(stage, now);
  const isEditable = liveState.status === "scheduled";
  const hasUniqueRoles = (["leader", "sprinter"] as const).every(
    (role) => Object.values(roles).filter((value) => value === role).length <= 1,
  );
  const assignedMissionIds = Object.values(missions).filter(Boolean);
  const unavailableMissionIds = [
    ...assignedMissionIds,
    ...riders
      .filter((rider) => {
        const role = roles[rider.riderId];
        return role === "leader" || role === "sprinter";
      })
      .map((rider) => rider.riderId),
  ];
  const hasUniqueMissions =
    new Set(assignedMissionIds).size === assignedMissionIds.length;
  const missionsUseTeammates = assignedMissionIds.every(
    (riderId) => roles[riderId] !== "leader" && roles[riderId] !== "sprinter",
  );
  const attacksAreValid = attackOrders.every(
    (order) =>
      riders.some((rider) => rider.riderId === order.riderId) &&
      stage.segments.some(
        (segment) => segment.segmentNumber === order.segmentNumber,
      ),
  );
  const isValid =
    hasUniqueRoles &&
    hasUniqueMissions &&
    missionsUseTeammates &&
    attacksAreValid;

  return (
    <details
      id={`etape-${stage.id}`}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="scroll-mt-5 overflow-hidden rounded-3xl border border-[#315B3E]/15 bg-white shadow-[0_18px_45px_rgba(19,60,46,0.1)]"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-7">
        <span className="min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#397A67]">
            {edition.raceFormat === "stage_race"
              ? `Étape ${stage.stageNumber}`
              : "Course"}
          </span>
          <span className="mt-1 block truncate text-lg font-black text-[#0B302B]">
            {stage.name}
          </span>
          <span className="mt-1 block text-xs font-semibold text-[#66877C]">
            {stage.distanceKm} km · {formatProfile(stage.profileType)} · {formatStageDeparture(stage.departureAt)}
          </span>
        </span>
        <span
          className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${
            isEditable
              ? strategy.updatedAt
                ? "bg-[#F2C94C]/20 text-[#7B6110]"
                : "bg-[#278B70]/12 text-[#176951]"
              : "bg-[#315B3E]/10 text-[#66877C]"
          }`}
        >
          {isEditable
            ? strategy.updatedAt
              ? "Plan enregistré"
              : "À préparer"
            : liveState.status === "live"
              ? "En cours · verrouillé"
              : "Verrouillé"}
        </span>
      </summary>

      <form action={action} className="border-t border-[#315B3E]/12">
        <input type="hidden" name="editionId" value={edition.id} />
        <input type="hidden" name="stageId" value={stage.id} />
        <input type="hidden" name="stageNumber" value={stage.stageNumber} />
        <input type="hidden" name="slug" value={edition.slug} />
        <input
          type="hidden"
          name="attackOrders"
          value={JSON.stringify(attackOrders)}
        />

        <div className="grid gap-7 p-5 sm:p-7 2xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
          <div>
            <SectionTitle
              eyebrow="Hiérarchie"
              title="Rôles en course"
              description="Le rôle de l’inscription reste le défaut ; l’étape peut le remplacer jusqu’à son départ."
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {riders.map((rider) => {
                const role = roles[rider.riderId] ?? rider.generalRole;
                return (
                  <label
                    key={rider.riderId}
                    className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] px-3 py-3"
                  >
                    <span className="block truncate text-xs font-black text-[#0B302B]">
                      {rider.firstName} {rider.lastName}
                    </span>
                    <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-[#789487]">
                      Général · {RACE_ROLE_LABELS[rider.generalRole]}
                    </span>
                    <select
                      name="stageRoles"
                      value={`${rider.riderId}:${role}`}
                      disabled={!isEditable}
                      onChange={(event) => {
                        const nextRole = event.target.value
                          .split(":")
                          .at(-1) as RaceRole;
                        setRoles((current) => ({
                          ...current,
                          [rider.riderId]: nextRole,
                        }));
                      }}
                      className="mt-2 min-h-10 w-full rounded-xl border border-[#315B3E]/18 bg-white px-2 text-xs font-bold text-[#0B302B] outline-none focus:border-[#278B70] disabled:bg-[#EDF2EF] disabled:text-[#66877C]"
                    >
                      {RACE_ROLES.map((candidateRole) => {
                        const isUniqueRole =
                          candidateRole === "leader" ||
                          candidateRole === "sprinter";
                        const isTaken =
                          isUniqueRole &&
                          riders.some(
                            (candidate) =>
                              candidate.riderId !== rider.riderId &&
                              roles[candidate.riderId] === candidateRole,
                          );
                        return (
                          <option
                            key={candidateRole}
                            value={`${rider.riderId}:${candidateRole}`}
                            disabled={isTaken}
                          >
                            {RACE_ROLE_LABELS[candidateRole]}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <SectionTitle
              eyebrow="Scénario"
              title="Plan collectif"
              description="Ces choix modulent les décisions du moteur ; ils ne garantissent jamais un résultat."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
              <StrategySelect
                name="objective"
                label="Objectif prioritaire"
                value={objective}
                disabled={!isEditable}
                onChange={(value) => setObjective(value as RaceStrategyObjective)}
                options={RACE_STRATEGY_OBJECTIVES.map((value) => ({
                  value,
                  label: RACE_STRATEGY_OBJECTIVE_LABELS[value],
                }))}
              />
              <StrategySelect
                name="collectivePosture"
                label="Attitude collective"
                value={collectivePosture}
                disabled={!isEditable}
                onChange={(value) =>
                  setCollectivePosture(value as RaceCollectivePosture)
                }
                options={RACE_COLLECTIVE_POSTURES.map((value) => ({
                  value,
                  label: RACE_COLLECTIVE_POSTURE_LABELS[value],
                }))}
              />
              <StrategySelect
                name="breakawayPolicy"
                label="Politique d’échappée"
                value={breakawayPolicy}
                disabled={!isEditable}
                onChange={(value) =>
                  setBreakawayPolicy(value as RaceBreakawayPolicy)
                }
                options={RACE_BREAKAWAY_POLICIES.map((value) => ({
                  value,
                  label: RACE_BREAKAWAY_POLICY_LABELS[value],
                }))}
              />
              <StrategySelect
                name="chasePolicy"
                label="Politique de poursuite"
                value={chasePolicy}
                disabled={!isEditable}
                onChange={(value) => setChasePolicy(value as RaceChasePolicy)}
                options={RACE_CHASE_POLICIES.map((value) => ({
                  value,
                  label: RACE_CHASE_POLICY_LABELS[value],
                }))}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[#315B3E]/10 bg-[#F4F8F6] p-5 sm:p-7">
          <SectionTitle
            eyebrow="Missions"
            title="Responsabilités individuelles"
            description="Une mission par équipier : lieutenant, protection, poursuite ou présence dans l’échappée."
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MissionSelect
              name="lieutenantRiderId"
              label="Lieutenant de course"
              value={missions.lieutenantRiderId}
              riders={riders}
              unavailableIds={unavailableMissionIds}
              disabled={!isEditable}
              onChange={(value) =>
                setMissions((current) => ({
                  ...current,
                  lieutenantRiderId: value,
                }))
              }
            />
            <MissionSelect
              name="protectorRiderId"
              label="Protecteur du leader"
              value={missions.protectorRiderId}
              riders={riders}
              unavailableIds={unavailableMissionIds}
              disabled={!isEditable}
              onChange={(value) =>
                setMissions((current) => ({
                  ...current,
                  protectorRiderId: value,
                }))
              }
            />
            <MissionSelect
              name="dangerPacerRiderId"
              label="Rouleur en cas de danger"
              value={missions.dangerPacerRiderId}
              riders={riders}
              unavailableIds={unavailableMissionIds}
              disabled={!isEditable}
              onChange={(value) =>
                setMissions((current) => ({
                  ...current,
                  dangerPacerRiderId: value,
                }))
              }
            />
            <MissionSelect
              name="breakawayRiderId"
              label="Candidat à l’échappée"
              value={missions.breakawayRiderId}
              riders={riders}
              unavailableIds={unavailableMissionIds}
              disabled={!isEditable}
              onChange={(value) =>
                setMissions((current) => ({
                  ...current,
                  breakawayRiderId: value,
                }))
              }
            />
          </div>
        </div>

        <div className="border-t border-[#315B3E]/10 p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle
              eyebrow="Offensive"
              title="Attaques préparées"
              description={`Choisissez le coureur, le tronçon et la condition de déclenchement — ${MAX_RACE_ATTACK_ORDERS} ordres maximum.`}
            />
            {isEditable && attackOrders.length < MAX_RACE_ATTACK_ORDERS ? (
              <button
                type="button"
                onClick={() => {
                  const rider = riders[0];
                  const segment = stage.segments[0];
                  if (!rider || !segment) return;
                  setAttackOrders((current) => [
                    ...current,
                    {
                      riderId: rider.riderId,
                      segmentNumber: segment.segmentNumber,
                      intensity: "measured",
                      condition: "always",
                    },
                  ]);
                }}
                className="rounded-full border border-[#278B70]/35 bg-[#278B70]/10 px-4 py-2 text-xs font-black text-[#176951] transition hover:bg-[#278B70] hover:text-white"
              >
                + Préparer une attaque
              </button>
            ) : null}
          </div>

          {attackOrders.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {attackOrders.map((order, index) => (
                <div
                  key={`${index}:${order.riderId}:${order.segmentNumber}`}
                  className="rounded-2xl border border-[#F2C94C]/45 bg-[#FFF9E8] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-wide text-[#6F5812]">
                      Ordre {index + 1}
                    </p>
                    {isEditable ? (
                      <button
                        type="button"
                        onClick={() =>
                          setAttackOrders((current) =>
                            current.filter((_, candidateIndex) => candidateIndex !== index),
                          )
                        }
                        className="text-[10px] font-black uppercase text-[#9B4A35] hover:underline"
                      >
                        Retirer
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <AttackSelect
                      label="Coureur"
                      value={order.riderId}
                      disabled={!isEditable}
                      onChange={(value) =>
                        updateAttackOrder(setAttackOrders, index, {
                          riderId: value,
                        })
                      }
                      options={riders.map((rider) => ({
                        value: rider.riderId,
                        label: `${rider.firstName} ${rider.lastName}`,
                      }))}
                    />
                    <AttackSelect
                      label="Tronçon"
                      value={String(order.segmentNumber)}
                      disabled={!isEditable}
                      onChange={(value) =>
                        updateAttackOrder(setAttackOrders, index, {
                          segmentNumber: Number(value),
                        })
                      }
                      options={stage.segments.map((segment) => ({
                        value: String(segment.segmentNumber),
                        label: formatSegment(segment),
                      }))}
                    />
                    <AttackSelect
                      label="Intensité"
                      value={order.intensity}
                      disabled={!isEditable}
                      onChange={(value) =>
                        updateAttackOrder(setAttackOrders, index, {
                          intensity: value as RaceAttackOrder["intensity"],
                        })
                      }
                      options={RACE_ATTACK_INTENSITIES.map((value) => ({
                        value,
                        label: RACE_ATTACK_INTENSITY_LABELS[value],
                      }))}
                    />
                    <AttackSelect
                      label="Condition"
                      value={order.condition}
                      disabled={!isEditable}
                      onChange={(value) =>
                        updateAttackOrder(setAttackOrders, index, {
                          condition: value as RaceAttackOrder["condition"],
                        })
                      }
                      options={RACE_ATTACK_CONDITIONS.map((value) => ({
                        value,
                        label: RACE_ATTACK_CONDITION_LABELS[value],
                      }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-[#315B3E]/20 bg-[#F8FBF9] px-4 py-5 text-sm font-semibold text-[#66877C]">
              Aucun ordre offensif : le coureur garde son initiative selon le
              déroulement de la course.
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#315B3E]/10 bg-[#0B302B] px-5 py-4 text-white sm:px-7">
          <p className="max-w-2xl text-xs font-semibold leading-5 text-[#BFD1C6]">
            {isEditable
              ? "L’enregistrement remplace le plan de cette étape. Les autres étapes restent indépendantes."
              : "Le départ est passé : ce plan reste consultable et ne peut plus être modifié."}
          </p>
          {isEditable ? <SavePreparationButton disabled={!isValid} /> : null}
        </footer>
      </form>
    </details>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#397A67]">
        {eyebrow}
      </p>
      <h3 className="mt-1 text-base font-black text-[#0B302B]">{title}</h3>
      <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-[#66877C]">
        {description}
      </p>
    </div>
  );
}

function StrategySelect({
  name,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-black text-[#315B3E]">
      {label}
      <select
        name={name}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 min-h-11 w-full rounded-xl border border-[#315B3E]/18 bg-white px-3 text-xs font-bold text-[#0B302B] outline-none focus:border-[#278B70] disabled:bg-[#EDF2EF] disabled:text-[#66877C]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MissionSelect({
  name,
  label,
  value,
  riders,
  unavailableIds,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  riders: RacePreparationRider[];
  unavailableIds: string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-2xl border border-[#315B3E]/12 bg-white p-3 text-xs font-black text-[#315B3E]">
      {label}
      <select
        name={name}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/18 bg-white px-2 text-xs font-bold text-[#0B302B] outline-none focus:border-[#278B70] disabled:bg-[#EDF2EF] disabled:text-[#66877C]"
      >
        <option value="">Aucun coureur désigné</option>
        {riders.map((rider) => (
          <option
            key={rider.riderId}
            value={rider.riderId}
            disabled={
              rider.riderId !== value && unavailableIds.includes(rider.riderId)
            }
          >
            {rider.firstName} {rider.lastName}
          </option>
        ))}
      </select>
    </label>
  );
}

function AttackSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[10px] font-black uppercase tracking-wide text-[#6F5812]">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 min-h-10 w-full rounded-xl border border-[#B98B18]/25 bg-white px-2 text-xs font-bold normal-case tracking-normal text-[#3D351D] outline-none focus:border-[#B98B18] disabled:bg-[#F3ECD9]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SavePreparationButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="min-h-11 rounded-xl bg-[#F2C94C] px-5 text-xs font-black text-[#17261E] transition hover:bg-[#F7D96C] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {pending ? "Enregistrement…" : "Enregistrer ce plan"}
    </button>
  );
}

function updateAttackOrder(
  setAttackOrders: Dispatch<SetStateAction<RaceAttackOrder[]>>,
  index: number,
  update: Partial<RaceAttackOrder>,
) {
  setAttackOrders((current) =>
    current.map((order, candidateIndex) =>
      candidateIndex === index ? { ...order, ...update } : order,
    ),
  );
}

function formatStageDeparture(value: string | null) {
  if (!value) return "Départ à confirmer";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function formatProfile(profile: RaceCalendarStage["profileType"]) {
  return {
    flat: "Plat",
    sprint: "Sprint",
    hilly: "Vallonné",
    mountain: "Montagne",
    cobbles: "Pavés",
    time_trial: "Contre-la-montre",
    mixed: "Mixte",
  }[profile];
}

function formatSegment(segment: RaceCalendarStage["segments"][number]) {
  const terrain =
    segment.surface === "cobbles"
      ? "pavés"
      : segment.terrain === "climb"
        ? `montée ${Math.abs(segment.averageGradientPct)} %`
        : segment.terrain === "descent"
          ? "descente"
          : "plat";
  return `T${segment.segmentNumber} · ${terrain} · ${segment.distanceKm} km`;
}
