"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import {
  saveRiderTrainingPlanAction,
  saveTeamTrainingSettingsAction,
} from "@/app/jeu/entrainement/actions";
import {
  TRAINING_DOMAINS,
  TRAINING_DOMAIN_LABELS,
  getTrainingFormDelta,
  type TrainingDomain,
} from "@/lib/game/training";
import type { TeamTrainer } from "@/services/team-training";

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

export function RiderTrainingPlanForm({
  riderId,
  initialIntensity,
  initialDomain,
  initialTrainerContractId,
  riderCountryCode,
  trainers,
}: {
  riderId: string;
  initialIntensity: number;
  initialDomain: TrainingDomain;
  initialTrainerContractId: string | null;
  riderCountryCode: string;
  trainers: TeamTrainer[];
}) {
  const [intensity, setIntensity] = useState(initialIntensity);
  const [trainerContractId, setTrainerContractId] = useState(
    initialTrainerContractId ?? "",
  );
  const formDelta = getTrainingFormDelta(intensity);
  const selectedTrainer = trainers.find(
    (trainer) => trainer.contractId === trainerContractId,
  );
  const nationalityBonus =
    selectedTrainer?.countryCode.toUpperCase() === riderCountryCode.toUpperCase();
  const intensityLabelId = `training-intensity-${riderId}`;

  function updateIntensity(value: number) {
    if (!Number.isFinite(value)) return;
    setIntensity(Math.min(100, Math.max(0, Math.round(value))));
  }

  return (
    <form
      action={saveRiderTrainingPlanAction}
      className="grid min-w-0 gap-4 lg:grid-cols-[minmax(210px,1.2fr)_minmax(170px,0.9fr)_minmax(190px,1fr)_150px] lg:items-end"
    >
      <input type="hidden" name="riderId" value={riderId} />
      <div className="min-w-0">
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
              name="intensity"
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

      <label>
        <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#60756E]">
          Domaine
        </span>
        <select
          name="domain"
          defaultValue={initialDomain}
          className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/15"
        >
          {TRAINING_DOMAINS.map((domain) => (
            <option key={domain} value={domain}>
              {TRAINING_DOMAIN_LABELS[domain]}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#60756E]">
          Entraîneur assigné
        </span>
        <select
          name="trainerContractId"
          value={trainerContractId}
          onChange={(event) => setTrainerContractId(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/15"
        >
          <option value="">Sans entraîneur</option>
          {trainers.map((trainer) => {
            const isCurrentTrainer =
              trainer.contractId === initialTrainerContractId;
            const isAtCapacity =
              trainer.assignedRiderCount >= trainer.riderCapacity;

            return (
              <option
                key={trainer.contractId}
                value={trainer.contractId}
                disabled={isAtCapacity && !isCurrentTrainer}
              >
                {trainer.firstName} {trainer.lastName} · {trainer.countryCode} · N{trainer.level} · {trainer.specialtyLabel} · {trainer.assignedRiderCount}/{trainer.riderCapacity}
                {isAtCapacity ? " · Complet" : ""}
              </option>
            );
          })}
        </select>
        {selectedTrainer ? (
          <span
            className={`mt-2 block text-[10px] font-black ${
              selectedTrainer.assignedRiderCount >= selectedTrainer.riderCapacity
                ? "text-[#B54242]"
                : "text-[#60756E]"
            }`}
          >
            {selectedTrainer.assignedRiderCount}/{selectedTrainer.riderCapacity} coureurs suivis
            {selectedTrainer.assignedRiderCount >= selectedTrainer.riderCapacity
              ? " · quota atteint"
              : ""}
          </span>
        ) : null}
        {nationalityBonus ? (
          <span className="mt-2 block text-[10px] font-black text-[#8A6B16]">
            Affinité nationale active · +5%
          </span>
        ) : null}
      </label>

      <TrainingSubmitButton pendingLabel="Sauvegarde…">
        Enregistrer
      </TrainingSubmitButton>
    </form>
  );
}

function TrainingSubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
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
