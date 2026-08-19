"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

import { saveYouthTrainingSettingsBulkAction } from "@/app/jeu/centre-de-formation/actions";
import { TRAINING_DOMAIN_LABELS } from "@/lib/game/training";
import {
  getChangedYouthTrainingSettings,
  indexYouthTrainingSettings,
  type YouthTrainingSettingsByRiderId,
  type YouthTrainingSettingsValue,
} from "@/lib/game/youth-training-bulk";
import {
  YOUTH_TRAINING_DOMAINS,
  isYouthTrainingDomain,
  isYouthTrainingMode,
  type YouthTrainingMode,
} from "@/lib/game/youth-training";

type YouthTrainingBulkContextValue = {
  initialByRiderId: YouthTrainingSettingsByRiderId;
  valuesByRiderId: YouthTrainingSettingsByRiderId;
  updateValue: (
    academyRiderId: string,
    value: YouthTrainingSettingsByRiderId[string],
  ) => void;
};

const YouthTrainingBulkContext =
  createContext<YouthTrainingBulkContextValue | null>(null);

export function YouthTrainingBulkEditor({
  initialSettings,
  children,
}: {
  initialSettings: YouthTrainingSettingsValue[];
  children: ReactNode;
}) {
  const initialByRiderId = useMemo(
    () => indexYouthTrainingSettings(initialSettings),
    [initialSettings],
  );
  const [valuesByRiderId, setValuesByRiderId] = useState(() =>
    indexYouthTrainingSettings(initialSettings),
  );
  const changedSettings = useMemo(
    () =>
      getChangedYouthTrainingSettings(initialByRiderId, valuesByRiderId),
    [initialByRiderId, valuesByRiderId],
  );

  function updateValue(
    academyRiderId: string,
    value: YouthTrainingSettingsByRiderId[string],
  ) {
    setValuesByRiderId((current) => ({
      ...current,
      [academyRiderId]: value,
    }));
  }

  return (
    <YouthTrainingBulkContext.Provider
      value={{ initialByRiderId, valuesByRiderId, updateValue }}
    >
      {children}

      {changedSettings.length > 0 ? (
        <>
          <div aria-hidden="true" className="h-32 sm:h-24" />
          <form action={saveYouthTrainingSettingsBulkAction}>
            <input
              type="hidden"
              name="settings"
              value={JSON.stringify(changedSettings)}
            />
            <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] mx-auto max-w-3xl sm:inset-x-6">
              <div className="flex flex-col gap-3 rounded-[1.35rem] border border-white/20 bg-[#0B302B]/95 p-3 text-white shadow-[0_22px_65px_rgba(7,26,23,0.38)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-4">
                <div className="flex min-w-0 items-center gap-3 px-1">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2C94C] text-sm font-black text-[#0B302B]">
                    {changedSettings.length}
                  </span>
                  <div className="min-w-0" aria-live="polite">
                    <p className="text-sm font-black">
                      {changedSettings.length} jeune
                      {changedSettings.length > 1 ? "s" : ""} modifié
                      {changedSettings.length > 1 ? "s" : ""}
                    </p>
                    <p className="text-[11px] font-semibold text-[#CDE2DA]">
                      Continuez vos réglages ou validez tout en une fois.
                    </p>
                  </div>
                </div>
                <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() =>
                      setValuesByRiderId({ ...initialByRiderId })
                    }
                    className="min-h-11 rounded-xl px-3 text-xs font-black uppercase tracking-[0.08em] text-[#CDE2DA] transition hover:bg-white/10 hover:text-white"
                  >
                    Annuler
                  </button>
                  <YouthTrainingBulkSubmitButton />
                </div>
              </div>
            </div>
          </form>
        </>
      ) : null}
    </YouthTrainingBulkContext.Provider>
  );
}

export function YouthTrainingSettingsFields({
  academyRiderId,
  pendingTrainingMode,
}: {
  academyRiderId: string;
  pendingTrainingMode: YouthTrainingMode | null;
}) {
  const context = useContext(YouthTrainingBulkContext);
  if (!context) {
    throw new Error(
      "YouthTrainingSettingsFields doit être utilisé dans YouthTrainingBulkEditor.",
    );
  }

  const current = context.valuesByRiderId[academyRiderId];
  const initial = context.initialByRiderId[academyRiderId];
  if (!current || !initial) return null;

  const hasLocalChanges =
    current.trainingMode !== initial.trainingMode ||
    current.trainingPriority !== initial.trainingPriority;

  return (
    <section className="rounded-2xl bg-[#EAF5F3] p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <label className="text-[9px] font-black uppercase tracking-[0.15em] text-[#60756E]">
          Mode d’entraînement
          <select
            value={current.trainingMode}
            onChange={(event) => {
              if (!isYouthTrainingMode(event.target.value)) return;
              context.updateValue(academyRiderId, {
                ...current,
                trainingMode: event.target.value,
              });
            }}
            className="mt-2 min-h-10 w-full rounded-lg border border-[#315B3E]/15 bg-white px-3 text-xs font-bold text-[#183F37]"
          >
            <option value="automatic">Automatique · séance quotidienne à 8 h</option>
            <option value="manual">Manuel · 2 minijeux / jour</option>
          </select>
        </label>
        <label className="text-[9px] font-black uppercase tracking-[0.15em] text-[#60756E]">
          Profil travaillé
          <select
            value={current.trainingPriority}
            onChange={(event) => {
              if (!isYouthTrainingDomain(event.target.value)) return;
              context.updateValue(academyRiderId, {
                ...current,
                trainingPriority: event.target.value,
              });
            }}
            className="mt-2 min-h-10 w-full rounded-lg border border-[#315B3E]/15 bg-white px-3 text-xs font-bold text-[#183F37]"
          >
            {YOUTH_TRAINING_DOMAINS.map((domain) => (
              <option key={domain} value={domain}>
                {domain === "rouleur"
                  ? "CLM / Rouleur"
                  : TRAINING_DOMAIN_LABELS[domain]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {hasLocalChanges ? (
        <p className="mt-3 rounded-lg bg-[#DCEFE9] px-3 py-2 text-[9px] font-black text-[#176951]">
          Modification prête à être validée dans la barre en bas de l’écran.
        </p>
      ) : pendingTrainingMode ? (
        <p className="mt-3 rounded-lg bg-[#FFF5D6] px-3 py-2 text-[9px] font-black text-[#806114]">
          Bascule vers le mode {pendingTrainingMode === "automatic"
            ? "automatique"
            : "manuel"} programmée pour la prochaine journée.
        </p>
      ) : (
        <p className="mt-2 text-[9px] font-semibold leading-4 text-[#60756E]">
          Le mode choisi s’applique à la prochaine journée d’entraînement,
          puis à toutes les suivantes.
        </p>
      )}
    </section>
  );
}

function YouthTrainingBulkSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F2C94C] px-4 text-center text-xs font-black uppercase tracking-[0.08em] text-[#0B302B] transition hover:bg-[#FFE071] disabled:cursor-wait disabled:bg-[#91A59D] disabled:text-white sm:min-w-56"
    >
      {pending ? "Validation…" : "Valider les entraînements"}
    </button>
  );
}
