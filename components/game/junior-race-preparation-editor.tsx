"use client";

import { useActionState, useState } from "react";

import {
  getJuniorRaceInstructions,
  type JuniorRaceAssignment,
  type JuniorRaceInstruction,
  type JuniorRacePreparationSaveState,
  type JuniorRacePreparationScope,
} from "@/lib/game/junior-race-preparation";
import type { JuniorRacePreparationStage } from "@/services/junior-race-preparation";

import { useUnsavedManagementChanges } from "./use-management-draft";

const INSTRUCTION_LABELS: Record<JuniorRaceInstruction, string> = {
  free: "Libre",
  leader: "Leader protégé",
  domestique: "Équipier",
  attack: "Attaquant",
  steady: "Régulier",
  progressive: "Progressif",
  aggressive: "Engagé",
};

export function JuniorRacePreparationEditor({
  action,
  stage,
  scope,
  registrationId,
}: {
  action: (state: JuniorRacePreparationSaveState, form: FormData) => Promise<JuniorRacePreparationSaveState>;
  stage: JuniorRacePreparationStage;
  scope: JuniorRacePreparationScope;
  registrationId: string;
}) {
  const [result, submit, pending] = useActionState(action, { status: "ready" });
  const [assignments, setAssignments] = useState<Record<string, JuniorRaceInstruction>>(
    () => Object.fromEntries(stage.riders.map(({ riderId, instruction }) => [riderId, instruction])),
  );
  const options = getJuniorRaceInstructions(stage.type);
  const confirmed: readonly JuniorRaceAssignment[] = result.status === "saved" ? result.assignments : stage.riders;
  const dirty = confirmed.some(({ riderId, instruction }) => (assignments[riderId] ?? instruction) !== instruction);
  const duplicateLeader = stage.riders.filter(({ riderId, instruction }) => (assignments[riderId] ?? instruction) === "leader").length > 1;
  useUnsavedManagementChanges(dirty && !pending);

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="stageId" value={stage.id} />
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="stageType" value={stage.type} />
      <div className="grid gap-2">
        {stage.riders.map((rider) => {
          const value = assignments[rider.riderId] ?? rider.instruction;
          return (
            <label
              key={rider.riderId}
              className="grid items-center gap-2 rounded-xl border border-[#315B3E]/15 bg-[#F5FAF7] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,16rem)] sm:gap-4"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-[#103C34]">
                {rider.countryCode ? <span aria-hidden="true" className={`fi fi-${rider.countryCode.toLowerCase()} shrink-0 rounded-sm`} /> : null}
                <span>{rider.firstName} {rider.lastName}</span>
              </span>
              <select
                name={`rider:${rider.riderId}`}
                value={value}
                disabled={pending}
                onChange={({ target }) => setAssignments((previous) => ({ ...previous, [rider.riderId]: target.value as JuniorRaceInstruction }))}
                className="min-h-11 w-full min-w-0 rounded-lg border border-[#315B3E]/25 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] disabled:opacity-70"
              >
                {options.map((instruction) => <option key={instruction} value={instruction}>{INSTRUCTION_LABELS[instruction]}</option>)}
              </select>
            </label>
          );
        })}
      </div>
      {duplicateLeader ? <p role="alert" className="text-sm font-semibold text-red-800">Choisissez un seul leader protégé pour cette étape.</p> : null}
      {result.status === "error" ? <p role="alert" className="text-sm font-semibold text-red-800">{result.message}</p> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="submit"
          disabled={pending || duplicateLeader || stage.riders.length === 0}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#176951] px-5 text-sm font-black text-white transition hover:bg-[#0B302B] disabled:opacity-55 sm:w-auto"
        >
          {pending ? "Enregistrement…" : "Enregistrer les consignes"}
        </button>
        {result.status === "saved" && !dirty ? <p role="status" className="text-sm font-semibold text-[#176951]">Consignes enregistrées pour cette étape.</p> : null}
      </div>
    </form>
  );
}
