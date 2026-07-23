"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { scheduleRecognitionCampAction } from "@/app/jeu/entrainement/actions";
import {
  RECOGNITION_CAMP_DURATION_DAYS,
  validateRecognitionCampSchedule,
} from "@/lib/game/training";
import type {
  RecognitionCampTarget,
  ScheduledRecognitionCamp,
} from "@/services/team-recognition-camps";

type SeasonDay = {
  dayNumber: number;
  calendarDate: string;
};

type RecognitionCampSchedulerProps = {
  currentDayNumber: number;
  seasonLastDayNumber: number;
  seasonDays: SeasonDay[];
  targets: RecognitionCampTarget[];
  scheduledCamps: ScheduledRecognitionCamp[];
};

export function RecognitionCampScheduler({
  currentDayNumber,
  seasonLastDayNumber,
  seasonDays,
  targets,
  scheduledCamps,
}: RecognitionCampSchedulerProps) {
  const initialTarget =
    targets.find((target) =>
      getCandidateDays({
        target,
        seasonDays,
        currentDayNumber,
        seasonLastDayNumber,
      }).some((candidate) => candidate.validation.valid),
    ) ?? targets[0];
  const [targetStageId, setTargetStageId] = useState(
    initialTarget?.stageId ?? "",
  );
  const selectedTarget =
    targets.find((target) => target.stageId === targetStageId) ?? initialTarget;
  const candidates = useMemo(
    () =>
      selectedTarget
        ? getCandidateDays({
            target: selectedTarget,
            seasonDays,
            currentDayNumber,
            seasonLastDayNumber,
          })
        : [],
    [
      currentDayNumber,
      seasonDays,
      seasonLastDayNumber,
      selectedTarget,
    ],
  );
  const firstValidCandidate = candidates.find(
    (candidate) => candidate.validation.valid,
  );
  const [startDayNumber, setStartDayNumber] = useState(
    firstValidCandidate ? String(firstValidCandidate.day.dayNumber) : "",
  );
  const selectedCandidate =
    candidates.find(
      (candidate) => String(candidate.day.dayNumber) === startDayNumber,
    ) ?? firstValidCandidate;
  const existingCamp = selectedTarget
    ? scheduledCamps.find(
        (camp) => camp.target.stageId === selectedTarget.stageId,
      )
    : null;

  function handleTargetChange(nextStageId: string) {
    const nextTarget = targets.find((target) => target.stageId === nextStageId);
    const nextFirstValid = nextTarget
      ? getCandidateDays({
          target: nextTarget,
          seasonDays,
          currentDayNumber,
          seasonLastDayNumber,
        }).find((candidate) => candidate.validation.valid)
      : null;

    setTargetStageId(nextStageId);
    setStartDayNumber(
      nextFirstValid ? String(nextFirstValid.day.dayNumber) : "",
    );
  }

  if (targets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#315B3E]/20 bg-[#F7FAF8] p-6">
        <p className="text-sm font-black text-[#183F37]">
          Aucune étape future ne peut encore être préparée.
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
          Les étapes apparaîtront ici dès qu’elles seront planifiées après la
          journée actuelle.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
      <form
        action={scheduleRecognitionCampAction}
        className="rounded-[1.6rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_14px_38px_rgba(19,60,46,0.07)] sm:p-7"
      >
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
          Nouveau stage
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#183F37]">
          Planifier deux jours de reconnaissance
        </h2>

        <label className="mt-6 block">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#60756E]">
            Étape ciblée
          </span>
          <select
            name="targetStageId"
            value={targetStageId}
            onChange={(event) => handleTargetChange(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/18 bg-[#F7FAF8] px-4 text-sm font-bold text-[#183F37] outline-none transition focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/15"
          >
            {targets.map((target) => (
              <option key={target.stageId} value={target.stageId}>
                J{target.stageDayNumber} ·{" "}
                {formatShortDate(target.stageCalendarDate)} ·{" "}
                {target.editionName} · Étape {target.stageNumber} —{" "}
                {target.stageName}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-5 block">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#60756E]">
            Premier jour du stage
          </span>
          <select
            name="startDayNumber"
            value={startDayNumber}
            onChange={(event) => setStartDayNumber(event.target.value)}
            disabled={!firstValidCandidate}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/18 bg-[#F7FAF8] px-4 text-sm font-bold text-[#183F37] outline-none transition disabled:cursor-not-allowed disabled:opacity-55 focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/15"
          >
            {!firstValidCandidate ? (
              <option value="">Aucune période de deux jours disponible</option>
            ) : null}
            {candidates.map((candidate) => (
              <option
                key={candidate.day.dayNumber}
                value={candidate.day.dayNumber}
                disabled={!candidate.validation.valid}
              >
                J{candidate.day.dayNumber}–J
                {candidate.day.dayNumber + RECOGNITION_CAMP_DURATION_DAYS - 1} ·{" "}
                {formatShortDate(candidate.day.calendarDate)} au{" "}
                {formatShortDate(
                  seasonDays.find(
                    (day) =>
                      day.dayNumber ===
                      candidate.day.dayNumber +
                        RECOGNITION_CAMP_DURATION_DAYS -
                        1,
                  )?.calendarDate ?? candidate.day.calendarDate,
                )}
                {!candidate.validation.valid
                  ? " · indisponible (course en cours)"
                  : ""}
              </option>
            ))}
          </select>
        </label>

        {selectedTarget ? (
          <div className="mt-5 rounded-2xl bg-[#EAF5F3] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#278B70]">
              Fenêtre protégée
            </p>
            <p className="mt-1 text-sm font-bold leading-6 text-[#315B3E]">
              {selectedTarget.editionName} occupe J
              {selectedTarget.editionStartDayNumber}
              {selectedTarget.editionEndDayNumber !==
              selectedTarget.editionStartDayNumber
                ? `–J${selectedTarget.editionEndDayNumber}`
                : ""}
              . Toute période qui touche l’un de ces jours est automatiquement
              bloquée.
            </p>
          </div>
        ) : null}

        {selectedCandidate?.validation.valid && selectedTarget ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F2C94C]/35 bg-[#FFF7D6] px-4 py-3">
            <div>
              <p className="text-xs font-black text-[#5D4A16]">
                Stage J{selectedCandidate.validation.startDayNumber}–J
                {selectedCandidate.validation.endDayNumber}
              </p>
              <p className="mt-1 text-xs font-bold text-[#8A6B16]">
                Préparation terminée avant l’étape de J
                {selectedTarget.stageDayNumber}.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#176951]">
              2 jours
            </span>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-[#C94F4F]/20 bg-[#FFF0EE] px-4 py-3 text-xs font-bold leading-5 text-[#8A2F2F]">
            Aucune période complète n’est disponible avant cette étape sans
            empiéter sur sa course.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-md text-xs font-semibold leading-5 text-[#60756E]">
            Programmer de nouveau la même étape remplace simplement les dates du
            stage précédent.
          </p>
          <RecognitionSubmitButton
            disabled={!selectedCandidate?.validation.valid}
            isRescheduling={Boolean(existingCamp)}
          />
        </div>
      </form>

      <aside className="rounded-[1.6rem] bg-[#0B302B] p-6 text-white sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9BE0BC]">
          Planning enregistré
        </p>
        <h2 className="mt-2 text-2xl font-black">
          {scheduledCamps.length} stage{scheduledCamps.length > 1 ? "s" : ""}
        </h2>

        {scheduledCamps.length > 0 ? (
          <div className="mt-5 space-y-3">
            {scheduledCamps.map((camp) => (
              <article
                key={camp.id}
                className="rounded-2xl border border-white/10 bg-white/6 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-white">
                      J{camp.startDayNumber}–J{camp.endDayNumber}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#9BE0BC]">
                      {formatShortDate(camp.startCalendarDate)} au{" "}
                      {formatShortDate(camp.endCalendarDate)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#F2C94C] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#17261E]">
                    Programmé
                  </span>
                </div>
                <p className="mt-3 text-sm font-black leading-5 text-[#FFF4C5]">
                  {camp.target.editionName}
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-[#D6DFD2]">
                  Étape {camp.target.stageNumber} · J
                  {camp.target.stageDayNumber} · {camp.target.stageName}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-white/15 px-4 py-5 text-sm font-semibold leading-6 text-[#D6DFD2]">
            Aucun stage de reconnaissance n’est encore programmé.
          </p>
        )}
      </aside>
    </div>
  );
}

function RecognitionSubmitButton({
  disabled,
  isRescheduling,
}: {
  disabled: boolean;
  isRescheduling: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="min-h-12 rounded-xl bg-[#F2C94C] px-5 text-xs font-black uppercase tracking-[0.1em] text-[#17261E] shadow-[0_8px_20px_rgba(242,201,76,0.25)] transition hover:bg-[#FFD95A] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending
        ? "Programmation…"
        : isRescheduling
          ? "Reprogrammer"
          : "Programmer le stage"}
    </button>
  );
}

function getCandidateDays({
  target,
  seasonDays,
  currentDayNumber,
  seasonLastDayNumber,
}: {
  target: RecognitionCampTarget;
  seasonDays: SeasonDay[];
  currentDayNumber: number;
  seasonLastDayNumber: number;
}) {
  return seasonDays
    .filter(
      (day) =>
        day.dayNumber > currentDayNumber &&
        day.dayNumber + RECOGNITION_CAMP_DURATION_DAYS - 1 <
          target.stageDayNumber,
    )
    .map((day) => ({
      day,
      validation: validateRecognitionCampSchedule({
        currentDayNumber,
        startDayNumber: day.dayNumber,
        targetStageDayNumber: target.stageDayNumber,
        targetEditionStartDayNumber: target.editionStartDayNumber,
        targetEditionEndDayNumber: target.editionEndDayNumber,
        seasonLastDayNumber,
      }),
    }));
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(date);
}
