"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

import {
  dismissYouthRidersBulkAction,
  saveYouthTrainingSettingsBulkAction,
} from "@/app/jeu/centre-de-formation/actions";
import { TrainingDomainGainBreakdown } from "@/components/game/training-domain-gain-breakdown";
import { getTrainingDomainChoiceLabel } from "@/lib/game/training";
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
  selectedDismissalIds: ReadonlySet<string>;
  toggleDismissal: (academyRiderId: string) => void;
};

const YouthTrainingBulkContext =
  createContext<YouthTrainingBulkContextValue | null>(null);

export function YouthTrainingBulkEditor({
  initialSettings,
  preserveFinalYearFilter = false,
  children,
}: {
  initialSettings: YouthTrainingSettingsValue[];
  preserveFinalYearFilter?: boolean;
  children: ReactNode;
}) {
  const initialByRiderId = useMemo(
    () => indexYouthTrainingSettings(initialSettings),
    [initialSettings],
  );
  const [valuesByRiderId, setValuesByRiderId] = useState(() =>
    indexYouthTrainingSettings(initialSettings),
  );
  const [selectedDismissalIds, setSelectedDismissalIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
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

  function toggleDismissal(academyRiderId: string) {
    setSelectedDismissalIds((current) => {
      const next = new Set(current);
      if (next.has(academyRiderId)) next.delete(academyRiderId);
      else next.add(academyRiderId);
      return next;
    });
  }

  const selectedDismissalIdList = [...selectedDismissalIds];
  const pendingDecisionCount =
    changedSettings.length + selectedDismissalIdList.length;

  return (
    <YouthTrainingBulkContext.Provider
      value={{
        initialByRiderId,
        valuesByRiderId,
        updateValue,
        selectedDismissalIds,
        toggleDismissal,
      }}
    >
      {children}

      {pendingDecisionCount > 0 ? (
        <>
          <div aria-hidden="true" className="h-32 sm:h-24" />
          <div className="mobile-dock-clearance fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] mx-auto max-w-5xl sm:inset-x-6">
            <div className="flex flex-col gap-3 rounded-[1.35rem] border border-white/20 bg-[#0B302B]/95 p-3 text-white shadow-[0_22px_65px_rgba(7,26,23,0.38)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-4">
              <div className="flex min-w-0 items-center gap-3 px-1">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2C94C] text-sm font-black text-[#0B302B]">
                  {pendingDecisionCount}
                </span>
                <div className="min-w-0" aria-live="polite">
                  <p className="text-sm font-black">
                    Décisions prêtes à être validées
                  </p>
                  <p className="text-[11px] font-semibold text-[#CDE2DA]">
                    {changedSettings.length > 0
                      ? `${changedSettings.length} entraînement${changedSettings.length > 1 ? "s" : ""}`
                      : null}
                    {changedSettings.length > 0 &&
                    selectedDismissalIdList.length > 0
                      ? " · "
                      : null}
                    {selectedDismissalIdList.length > 0
                      ? `${selectedDismissalIdList.length} départ${selectedDismissalIdList.length > 1 ? "s" : ""}`
                      : null}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setValuesByRiderId({ ...initialByRiderId });
                    setSelectedDismissalIds(new Set());
                  }}
                  className="min-h-11 rounded-xl px-3 text-xs font-black uppercase tracking-[0.08em] text-[#CDE2DA] transition hover:bg-white/10 hover:text-white"
                >
                  Tout annuler
                </button>
                {changedSettings.length > 0 ? (
                  <form action={saveYouthTrainingSettingsBulkAction}>
                    <input
                      type="hidden"
                      name="settings"
                      value={JSON.stringify(changedSettings)}
                    />
                    {preserveFinalYearFilter ? (
                      <input type="hidden" name="age" value="18" />
                    ) : null}
                    <YouthTrainingBulkSubmitButton />
                  </form>
                ) : null}
                {selectedDismissalIdList.length > 0 ? (
                  <form
                    action={dismissYouthRidersBulkAction}
                    onSubmit={(event) => {
                      const confirmed = window.confirm(
                        `Programmer le départ en fin de saison de ${selectedDismissalIdList.length} junior${selectedDismissalIdList.length > 1 ? "s" : ""} ?`,
                      );
                      if (!confirmed) event.preventDefault();
                    }}
                  >
                    <input
                      type="hidden"
                      name="academyRiderIds"
                      value={JSON.stringify(selectedDismissalIdList)}
                    />
                    {preserveFinalYearFilter ? (
                      <input type="hidden" name="age" value="18" />
                    ) : null}
                    <YouthDismissalBulkSubmitButton
                      count={selectedDismissalIdList.length}
                    />
                  </form>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </YouthTrainingBulkContext.Provider>
  );
}

export function YouthDismissalSelectionField({
  academyRiderId,
  riderName,
}: {
  academyRiderId: string;
  riderName: string;
}) {
  const context = useContext(YouthTrainingBulkContext);
  if (!context) {
    throw new Error(
      "YouthDismissalSelectionField doit être utilisé dans YouthTrainingBulkEditor.",
    );
  }

  const selected = context.selectedDismissalIds.has(academyRiderId);
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-[11px] font-bold leading-5 transition ${
        selected
          ? "border-[#C94848]/45 bg-[#FBE4DF] text-[#702E2E]"
          : "border-[#C94848]/15 bg-white text-[#702E2E] hover:border-[#C94848]/35"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => context.toggleDismissal(academyRiderId)}
        aria-label={`Sélectionner ${riderName} pour un départ en fin de saison`}
        className="mt-0.5 h-4 w-4 accent-[#B54242]"
      />
      <span>
        {selected
          ? "Départ ajouté aux décisions groupées."
          : "Ajouter ce départ aux décisions à valider."}
      </span>
    </label>
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
                {getTrainingDomainChoiceLabel(domain)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TrainingDomainGainBreakdown
        domain={current.trainingPriority}
        className="mt-3"
      />
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

function YouthDismissalBulkSubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F3D7D7] px-4 text-center text-xs font-black uppercase tracking-[0.08em] text-[#8A2F2F] transition hover:bg-[#F7C7C7] disabled:cursor-wait disabled:bg-[#91A59D] disabled:text-white"
    >
      {pending
        ? "Programmation…"
        : `Programmer ${count} départ${count > 1 ? "s" : ""}`}
    </button>
  );
}
