"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

import {
  saveRiderTrainingPlansAction,
  saveTeamTrainingSettingsAction,
} from "@/app/jeu/entrainement/actions";
import {
  TRAINING_DOMAINS,
  TRAINING_DOMAIN_LABELS,
  getTrainingFormDelta,
  type TrainingDomain,
} from "@/lib/game/training";
import {
  countTrainingPlansByTrainer,
  getChangedTrainingPlanIds,
  type TrainingPlanDraft,
} from "@/lib/game/training-plan-drafts";
import { STAFF_NATIONALITY_EFFICIENCY_BONUS_PERCENTAGE } from "@/lib/game/staff-talents";
import type { TeamTrainer } from "@/services/team-training";

type TrainingPlanPatch = Partial<Omit<TrainingPlanDraft, "riderId">>;

type TrainingPlansEditorContextValue = {
  plansByRiderId: Record<string, TrainingPlanDraft>;
  trainerAssignmentCounts: Record<string, number>;
  updatePlan: (riderId: string, patch: TrainingPlanPatch) => void;
};

const TrainingPlansEditorContext =
  createContext<TrainingPlansEditorContextValue | null>(null);

export function TrainingPlansEditor({
  initialPlans,
  children,
}: {
  initialPlans: TrainingPlanDraft[];
  children: ReactNode;
}) {
  const initialPlansByRiderId = useMemo(
    () =>
      Object.fromEntries(
        initialPlans.map((plan) => [plan.riderId, plan]),
      ) as Record<string, TrainingPlanDraft>,
    [initialPlans],
  );
  const [plansByRiderId, setPlansByRiderId] = useState(
    () => initialPlansByRiderId,
  );
  const currentPlans = useMemo(
    () =>
      initialPlans.map(
        (initialPlan) => plansByRiderId[initialPlan.riderId] ?? initialPlan,
      ),
    [initialPlans, plansByRiderId],
  );
  const changedRiderIds = useMemo(
    () => getChangedTrainingPlanIds(initialPlans, currentPlans),
    [currentPlans, initialPlans],
  );
  const changedRiderIdSet = useMemo(
    () => new Set(changedRiderIds),
    [changedRiderIds],
  );
  const changedPlans = useMemo(
    () => currentPlans.filter((plan) => changedRiderIdSet.has(plan.riderId)),
    [changedRiderIdSet, currentPlans],
  );
  const trainerAssignmentCounts = useMemo(
    () => countTrainingPlansByTrainer(currentPlans),
    [currentPlans],
  );
  const updatePlan = useCallback(
    (riderId: string, patch: TrainingPlanPatch) => {
      setPlansByRiderId((current) => {
        const plan = current[riderId];
        if (!plan) return current;
        return {
          ...current,
          [riderId]: { ...plan, ...patch },
        };
      });
    },
    [],
  );
  const editorContext = useMemo(
    () => ({ plansByRiderId, trainerAssignmentCounts, updatePlan }),
    [plansByRiderId, trainerAssignmentCounts, updatePlan],
  );

  return (
    <TrainingPlansEditorContext.Provider value={editorContext}>
      <form
        action={saveRiderTrainingPlansAction}
        data-tutorial-id="training-plan-save"
      >
        <input
          type="hidden"
          name="plans"
          value={JSON.stringify(changedPlans)}
        />
        {children}

        {changedPlans.length > 0 ? (
          <>
            <div aria-hidden="true" className="h-28 sm:h-24" />
            <div className="mobile-dock-clearance fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] mx-auto max-w-3xl sm:inset-x-6">
              <div className="flex flex-col gap-3 rounded-[1.35rem] border border-white/20 bg-[#0B302B]/95 p-3 text-white shadow-[0_22px_65px_rgba(7,26,23,0.38)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-4">
                <div className="flex min-w-0 items-center gap-3 px-1">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2C94C] text-sm font-black text-[#0B302B]">
                    {changedPlans.length}
                  </span>
                  <div className="min-w-0" aria-live="polite">
                    <p className="text-sm font-black">
                      {changedPlans.length === 1
                        ? "1 programme modifié"
                        : `${changedPlans.length} programmes modifiés`}
                    </p>
                    <p className="text-[11px] font-semibold text-[#CDE2DA]">
                      Continuez vos réglages ou validez-les en une fois.
                    </p>
                  </div>
                </div>
                <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() =>
                      setPlansByRiderId({ ...initialPlansByRiderId })
                    }
                    className="min-h-11 rounded-xl px-3 text-xs font-black uppercase tracking-[0.08em] text-[#CDE2DA] transition hover:bg-white/10 hover:text-white"
                  >
                    Annuler
                  </button>
                  <TrainingPlansSubmitButton count={changedPlans.length} />
                </div>
              </div>
            </div>
          </>
        ) : null}
      </form>
    </TrainingPlansEditorContext.Provider>
  );
}

export function TrainingThresholdForm({ minimumForm }: { minimumForm: number }) {
  const [value, setValue] = useState(minimumForm);

  return (
    <form
      action={saveTeamTrainingSettingsAction}
      className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <label className="block">
        <span className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.14em] text-[#9BE0BC]">
          Forme minimale pour s’entraîner
          <strong className="text-lg text-[#F2C94C]">{value}%</strong>
        </span>
        <input
          type="range"
          name="minimumForm"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          className="mt-3 h-2 w-full cursor-pointer accent-[#F2C94C]"
        />
      </label>
      <TrainingSubmitButton pendingLabel="Enregistrement…">
        Enregistrer le seuil
      </TrainingSubmitButton>
    </form>
  );
}

export function RiderTrainingPlanFields({
  riderId,
  riderCountryCode,
  trainers,
  tutorialTargetPrefix,
}: {
  riderId: string;
  riderCountryCode: string;
  trainers: TeamTrainer[];
  tutorialTargetPrefix?: string;
}) {
  const editor = useTrainingPlansEditor();
  const plan = editor.plansByRiderId[riderId];
  if (!plan) {
    throw new Error(`Programme d’entraînement introuvable pour ${riderId}.`);
  }

  const { intensity, domain, trainerContractId } = plan;
  const formDelta = getTrainingFormDelta(intensity);
  const selectedTrainer = trainers.find(
    (trainer) => trainer.contractId === trainerContractId,
  );
  const nationalityBonus =
    selectedTrainer?.countryCode.toUpperCase() === riderCountryCode.toUpperCase();
  const intensityLabelId = `training-intensity-${riderId}`;
  const trainerSelectId = `training-trainer-${riderId}`;

  function updateIntensity(value: number) {
    if (!Number.isFinite(value)) return;
    editor.updatePlan(riderId, {
      intensity: Math.min(100, Math.max(0, Math.round(value))),
    });
  }

  return (
    <div
      data-tutorial-id={
        tutorialTargetPrefix ? `${tutorialTargetPrefix}-setup` : undefined
      }
      className="grid min-w-0 gap-4 lg:grid-cols-[minmax(210px,1.2fr)_minmax(170px,0.9fr)_minmax(190px,1fr)] lg:items-end"
    >
      <div
        data-tutorial-id={
          tutorialTargetPrefix ? `${tutorialTargetPrefix}-intensity` : undefined
        }
        className="min-w-0"
      >
        <div className="flex items-center justify-between gap-3">
          <span
            id={intensityLabelId}
            className="text-[10px] font-black uppercase tracking-[0.13em] text-[#60756E]"
          >
            Intensité
          </span>
          <label className="flex min-h-9 items-center overflow-hidden rounded-lg border border-[#315B3E]/20 bg-white shadow-sm focus-within:border-[#278B70] focus-within:ring-2 focus-within:ring-[#278B70]/15">
            <span className="sr-only">Saisir l’intensité d’entraînement</span>
            <input
              type="number"
              name={`training-intensity-${riderId}`}
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              value={intensity}
              onChange={(event) => updateIntensity(event.target.valueAsNumber)}
              className="h-9 w-16 bg-transparent px-2 text-right text-sm font-black text-[#176951] outline-none"
            />
            <span className="pr-2 text-xs font-black text-[#60756E]">%</span>
          </label>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={intensity}
          aria-labelledby={intensityLabelId}
          onChange={(event) => updateIntensity(event.target.valueAsNumber)}
          className="mt-3 h-2 w-full cursor-pointer accent-[#176951]"
        />
        <span
          className={`mt-2 block text-[10px] font-black ${
            formDelta < 0 ? "text-[#B54242]" : "text-[#278B70]"
          }`}
        >
          Forme : {formDelta > 0 ? "+" : ""}
          {formDelta} point{Math.abs(formDelta) > 1 ? "s" : ""} / séance
        </span>
      </div>

      <label
        data-tutorial-id={
          tutorialTargetPrefix ? `${tutorialTargetPrefix}-domain` : undefined
        }
      >
        <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#60756E]">
          Domaine
        </span>
        <select
          name={`training-domain-${riderId}`}
          value={domain}
          onChange={(event) =>
            editor.updatePlan(riderId, {
              domain: event.target.value as TrainingDomain,
            })
          }
          className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/15"
        >
          {TRAINING_DOMAINS.map((trainingDomain) => (
            <option key={trainingDomain} value={trainingDomain}>
              {TRAINING_DOMAIN_LABELS[trainingDomain]}
            </option>
          ))}
        </select>
      </label>

      <div
        data-tutorial-id={
          tutorialTargetPrefix ? `${tutorialTargetPrefix}-trainer` : undefined
        }
      >
        <label
          htmlFor={trainerSelectId}
          className="text-[10px] font-black uppercase tracking-[0.13em] text-[#60756E]"
        >
          Entraîneur assigné
        </label>
        <select
          id={trainerSelectId}
          name={`training-trainer-${riderId}`}
          value={trainerContractId ?? ""}
          onChange={(event) =>
            editor.updatePlan(riderId, {
              trainerContractId: event.target.value || null,
            })
          }
          className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/15"
        >
          <option value="">Sans entraîneur</option>
          {trainers.map((trainer) => {
            const assignedRiderCount =
              editor.trainerAssignmentCounts[trainer.contractId] ?? 0;
            const isCurrentTrainer = trainer.contractId === trainerContractId;
            const isAtCapacity = assignedRiderCount >= trainer.riderCapacity;
            const additionalTalents = trainer.talents
              .map(
                (talent) =>
                  `${talent.specialtyLabel} +${talent.efficiencyBonus}%`,
              )
              .join(", ");

            return (
              <option
                key={trainer.contractId}
                value={trainer.contractId}
                disabled={isAtCapacity && !isCurrentTrainer}
              >
                {trainer.firstName} {trainer.lastName} · {trainer.countryCode} · N
                {trainer.level} · Base {trainer.specialtyLabel} +
                {trainer.efficiencyBonus}%
                {additionalTalents
                  ? ` · Lignes ${additionalTalents}`
                  : " · Sans ligne supplémentaire"}
                {` · ${assignedRiderCount}/${trainer.riderCapacity}`}
                {isAtCapacity ? " · Complet" : ""}
              </option>
            );
          })}
        </select>
        {selectedTrainer ? (
          <span className="mt-2 block rounded-xl border border-[#315B3E]/12 bg-[#F7FAF8] p-3">
            <span className="block text-[9px] font-black uppercase tracking-[0.13em] text-[#60756E]">
              Talents de l’entraîneur
            </span>
            <span className="mt-2 flex items-center justify-between gap-3 text-[11px] font-black text-[#183F37]">
              <span>Talent de base · {selectedTrainer.specialtyLabel}</span>
              <span className="shrink-0 text-[#176951]">
                +{selectedTrainer.efficiencyBonus}%
              </span>
            </span>
            {selectedTrainer.talents.length > 0 ? (
              <span className="mt-2 block border-t border-[#315B3E]/10 pt-2">
                {selectedTrainer.talents.map((talent) => (
                  <span
                    key={`${selectedTrainer.contractId}-${talent.slot}`}
                    className="mt-1 flex items-center justify-between gap-3 text-[11px] font-black text-[#183F37] first:mt-0"
                  >
                    <span>
                      Ligne {talent.slot} · {talent.specialtyLabel}
                    </span>
                    <span className="shrink-0 text-[#176951]">
                      +{talent.efficiencyBonus}%
                    </span>
                  </span>
                ))}
              </span>
            ) : (
              <span className="mt-2 block border-t border-[#315B3E]/10 pt-2 text-[10px] font-bold text-[#60756E]">
                Aucune ligne supplémentaire
              </span>
            )}
            <span
              className={`mt-2 block border-t border-[#315B3E]/10 pt-2 text-[10px] font-black ${
                (editor.trainerAssignmentCounts[selectedTrainer.contractId] ??
                  0) >= selectedTrainer.riderCapacity
                  ? "text-[#B54242]"
                  : "text-[#60756E]"
              }`}
            >
              {editor.trainerAssignmentCounts[selectedTrainer.contractId] ?? 0}/
              {selectedTrainer.riderCapacity} coureurs suivis
              {(editor.trainerAssignmentCounts[selectedTrainer.contractId] ??
                0) >= selectedTrainer.riderCapacity
                ? " · quota atteint"
                : ""}
            </span>
          </span>
        ) : null}
        {nationalityBonus ? (
          <span className="mt-2 block text-[10px] font-black text-[#8A6B16]">
            {`Affinité nationale active · +${STAFF_NATIONALITY_EFFICIENCY_BONUS_PERCENTAGE} %`}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function useTrainingPlansEditor() {
  const editor = useContext(TrainingPlansEditorContext);
  if (!editor) {
    throw new Error(
      "RiderTrainingPlanFields doit être rendu dans TrainingPlansEditor.",
    );
  }
  return editor;
}

function TrainingSubmitButton({
  children,
  pendingLabel,
}: {
  children: ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#176951] px-4 text-xs font-black uppercase tracking-[0.11em] text-white transition hover:bg-[#0B302B] disabled:cursor-wait disabled:bg-[#B8C8C2]"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

function TrainingPlansSubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F2C94C] px-4 text-center text-xs font-black uppercase tracking-[0.08em] text-[#0B302B] transition hover:bg-[#FFE071] disabled:cursor-wait disabled:bg-[#91A59D] disabled:text-white sm:min-w-56"
    >
      {pending
        ? "Validation…"
        : count === 1
          ? "Valider la modification"
          : "Valider les modifications"}
    </button>
  );
}
