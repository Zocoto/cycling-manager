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

import { applyNutritionPlanAction } from "@/app/jeu/centre-de-soin/actions";
import { WEIGHT_PROGRAM_STEPS, getWeightProgramQuote, type WeightProgramDraft, type WeightProgramRider } from "@/lib/game/weight-program";
import {
  NUTRITION_INTERVENTIONS,
  getNutritionInterventionOutcome,
  getNutritionWeightGainRiskPct,
  type NutritionInterventionCode,
} from "@/lib/game/health-center";

export type NutritionistInterventionOption = {
  contractId: string;
  name: string;
  level: number;
  remainingCapacity: number;
  additionalFormBonus?: number;
  interventionPrices?: Partial<Record<NutritionInterventionCode, number>> | null;
};

export function canReserveNutritionistForDraft({
  nutritionist,
  interventionCode,
  usage,
  currentNutritionistContractId,
  hasCurrentIntervention,
}: {
  nutritionist: NutritionistInterventionOption;
  interventionCode: NutritionInterventionCode;
  usage: number;
  currentNutritionistContractId: string | null;
  hasCurrentIntervention: boolean;
}) {
  if (
    nutritionist.level <
    NUTRITION_INTERVENTIONS[interventionCode].minimumNutritionistLevel
  ) {
    return false;
  }

  const keepsCurrentReservation =
    hasCurrentIntervention &&
    nutritionist.contractId === currentNutritionistContractId;

  return keepsCurrentReservation || usage < nutritionist.remainingCapacity;
}

type NutritionInterventionDraft = {
  riderId: string;
  nutritionistContractId: string | null;
  interventionCode: NutritionInterventionCode | null;
};

type EditorContextValue = {
  weightDrafts: Record<string, number>;
  weightRiders: WeightProgramRider[];
  setWeightDraft: (riderId: string, delta: number) => void;
  supplementFormGain: (riderId: string) => number;
  draftsByRiderId: Record<string, NutritionInterventionDraft>;
  usageByNutritionist: Record<string, number>;
  nutritionists: NutritionistInterventionOption[];
  updateDraft: (
    riderId: string,
    patch: Partial<Omit<NutritionInterventionDraft, "riderId">>,
  ) => void;
};

const INTERVENTION_CODES = Object.keys(
  NUTRITION_INTERVENTIONS,
) as NutritionInterventionCode[];

const NutritionEditorContext = createContext<EditorContextValue | null>(null);

export function NutritionInterventionsEditor({
  riderIds,
  nutritionists,
  balance,
  currency,
  weightRiders = [],
  children,
}: {
  riderIds: string[];
  nutritionists: NutritionistInterventionOption[];
  balance: number;
  currency: string;
  weightRiders?: WeightProgramRider[];
  children: ReactNode;
}) {
  const initialDrafts = useMemo(
    () =>
      Object.fromEntries(
        riderIds.map((riderId) => [
          riderId,
          {
            riderId,
            nutritionistContractId: null,
            interventionCode: null,
          } satisfies NutritionInterventionDraft,
        ]),
      ) as Record<string, NutritionInterventionDraft>,
    [riderIds],
  );
  const [draftsByRiderId, setDraftsByRiderId] = useState(
    () => initialDrafts,
  );
  const [weightDrafts, setWeightDrafts] = useState<Record<string, number>>({});
  const weightPrograms: WeightProgramDraft[] = Object.entries(weightDrafts)
    .filter(([, delta]) => delta !== 0).map(([riderId, weightDeltaKg]) => ({ riderId, weightDeltaKg }));
  const supplementFormGain = useCallback((riderId: string) => {
    const draft = draftsByRiderId[riderId];
    const specialist = nutritionists.find(option => option.contractId === draft?.nutritionistContractId);
    if (!specialist || !draft?.interventionCode) return 0;
    return getNutritionInterventionOutcome({code: draft.interventionCode, nutritionistLevel: specialist.level,
      additionalFormBonus: specialist.additionalFormBonus,
      effectivePrice: specialist.interventionPrices?.[draft.interventionCode]}).formGain;
  }, [draftsByRiderId, nutritionists]);
  const hasWeightError = weightPrograms.some(program => {
    const rider = weightRiders.find(candidate => candidate.riderId === program.riderId);
    return !rider || !getWeightProgramQuote(rider, program.weightDeltaKg, supplementFormGain(program.riderId)).allowed;
  });
  const totalFormCost = weightPrograms.reduce((sum, program) => sum + Math.round(Math.abs(program.weightDeltaKg) * 20), 0);
  const activeDrafts = useMemo(
    () =>
      riderIds
        .map((riderId) => draftsByRiderId[riderId])
        .filter(
          (draft): draft is NutritionInterventionDraft =>
            Boolean(draft?.interventionCode),
        ),
    [draftsByRiderId, riderIds],
  );
  const completeDrafts = useMemo(
    () =>
      activeDrafts.filter(
        (draft) => Boolean(draft.nutritionistContractId),
      ),
    [activeDrafts],
  );
  const usageByNutritionist = useMemo(() => {
    const usage: Record<string, number> = {};
    for (const draft of completeDrafts) {
      const contractId = draft.nutritionistContractId;
      if (!contractId) continue;
      usage[contractId] = (usage[contractId] ?? 0) + 1;
    }
    return usage;
  }, [completeDrafts]);
  const totalPrice = useMemo(
    () =>
      completeDrafts.reduce((total, draft) => {
        const nutritionist = nutritionists.find(
          (option) => option.contractId === draft.nutritionistContractId,
        );
        if (!nutritionist || !draft.interventionCode) return total;
        return (
          total +
          getNutritionInterventionOutcome({
            code: draft.interventionCode,
            nutritionistLevel: nutritionist.level,
            additionalFormBonus: nutritionist.additionalFormBonus,
            effectivePrice:
              nutritionist.interventionPrices?.[draft.interventionCode],
          }).price
        );
      }, 0),
    [completeDrafts, nutritionists],
  );
  const hasCapacityError = nutritionists.some(
    (nutritionist) =>
      (usageByNutritionist[nutritionist.contractId] ?? 0) >
      nutritionist.remainingCapacity,
  );
  const cannotSubmit =
    completeDrafts.length !== activeDrafts.length ||
    hasCapacityError ||
    hasWeightError ||
    totalPrice > balance;
  const updateDraft = useCallback(
    (
      riderId: string,
      patch: Partial<Omit<NutritionInterventionDraft, "riderId">>,
    ) => {
      setDraftsByRiderId((current) => {
        const draft = current[riderId];
        if (!draft) return current;
        const nextDraft = { ...draft, ...patch };

        if (
          nextDraft.interventionCode &&
          nextDraft.nutritionistContractId
        ) {
          const nutritionist = nutritionists.find(
            (option) =>
              option.contractId === nextDraft.nutritionistContractId,
          );
          if (!nutritionist) return current;

          const usage = Object.values(current).filter(
            (candidate) =>
              Boolean(candidate.interventionCode) &&
              candidate.nutritionistContractId === nutritionist.contractId,
          ).length;
          if (
            !canReserveNutritionistForDraft({
              nutritionist,
              interventionCode: nextDraft.interventionCode,
              usage,
              currentNutritionistContractId: draft.nutritionistContractId,
              hasCurrentIntervention: Boolean(draft.interventionCode),
            })
          ) {
            return current;
          }
        }

        return { ...current, [riderId]: nextDraft };
      });
    },
    [nutritionists],
  );
  const context = useMemo(
    () => ({
      draftsByRiderId,
      usageByNutritionist,
      nutritionists,
      updateDraft,
      weightDrafts, weightRiders, supplementFormGain,
      setWeightDraft: (riderId: string, delta: number) => setWeightDrafts(current => ({...current, [riderId]: delta})),
    }),
    [draftsByRiderId, nutritionists, updateDraft, usageByNutritionist, weightDrafts, weightRiders, supplementFormGain],
  );

  return (
    <NutritionEditorContext.Provider value={context}>
      {/* One atomic payload, no nested forms or independent weight submissions. */}
      {children}
      <form
        action={applyNutritionPlanAction}
        data-financial-expense={totalPrice}
        data-financial-label="ces interventions nutritionnelles"
      >
        <input
          type="hidden"
          name="interventions"
          value={JSON.stringify(completeDrafts)}
        />
        <input type="hidden" name="weightPrograms" value={JSON.stringify(weightPrograms)} />
        {activeDrafts.length + weightPrograms.length > 0 ? (
          <>
            <div aria-hidden="true" className="h-32 sm:h-24" />
            <div className="mobile-dock-clearance fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] mx-auto max-w-3xl sm:inset-x-6">
              <div className="flex flex-col gap-3 rounded-[1.35rem] border border-white/20 bg-[#0B302B]/95 p-3 text-white shadow-[0_22px_65px_rgba(7,26,23,0.38)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-4">
                <div className="flex min-w-0 items-center gap-3 px-1">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2C94C] text-sm font-black text-[#0B302B]">
                    {activeDrafts.length + weightPrograms.length}
                  </span>
                  <div className="min-w-0" aria-live="polite">
                    <p className="text-sm font-black">
                      {formatCurrency(totalPrice, currency)}{totalFormCost > 0 ? ` · −${totalFormCost} forme au total` : ""} à valider
                    </p>
                    <p className="text-[11px] font-semibold text-[#CDE2DA]">
                      {cannotSubmit
                        ? totalPrice > balance
                          ? "Trésorerie insuffisante pour cette sélection."
                          : hasWeightError ? "Vérifiez la forme ou le délai des ajustements de poids."
                          : "Complétez les choix ou libérez une place nutritionniste."
                        : `${activeDrafts.length} complément${activeDrafts.length > 1 ? "s" : ""}${weightPrograms.length ? ` · ${weightPrograms.length} ajustement${weightPrograms.length > 1 ? "s" : ""} de poids` : ""}, une seule validation.`}
                    </p>
                  </div>
                </div>
                <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => { setDraftsByRiderId({ ...initialDrafts }); setWeightDrafts({}); }}
                    className="min-h-11 rounded-xl px-3 text-xs font-black uppercase tracking-[0.08em] text-[#CDE2DA] transition hover:bg-white/10 hover:text-white"
                  >
                    Annuler
                  </button>
                  <NutritionBulkSubmitButton
                    count={activeDrafts.length + weightPrograms.length}
                    disabled={cannotSubmit}
                  />
                </div>
              </div>
            </div>
          </>
        ) : null}
      </form>
    </NutritionEditorContext.Provider>
  );
}

export function NutritionInterventionFields({
  riderId,
  riderForm,
  riderWeightKg,
  recentInterventionCount,
  currency,
}: {
  riderId: string;
  riderForm: number;
  riderWeightKg: number | null;
  recentInterventionCount: number;
  currency: string;
}) {
  const editor = useNutritionEditor();
  const draft = editor.draftsByRiderId[riderId];
  if (!draft) {
    throw new Error(`Paramétrage nutrition introuvable pour ${riderId}.`);
  }

  const selectedNutritionist =
    editor.nutritionists.find(
      (nutritionist) =>
        nutritionist.contractId === draft.nutritionistContractId,
    ) ?? null;
  const outcome =
    selectedNutritionist && draft.interventionCode
      ? getNutritionInterventionOutcome({
          code: draft.interventionCode,
          nutritionistLevel: selectedNutritionist.level,
          additionalFormBonus: selectedNutritionist.additionalFormBonus,
          effectivePrice:
            selectedNutritionist.interventionPrices?.[draft.interventionCode],
        })
      : null;
  const actualFormGain = outcome
    ? Math.min(outcome.formGain, Math.max(0, 100 - riderForm))
    : 0;
  const weightImpact =
    selectedNutritionist && draft.interventionCode
      ? {
          gainKg:
            NUTRITION_INTERVENTIONS[draft.interventionCode]
              .possibleWeightGainKg,
          riskPct: getNutritionWeightGainRiskPct({
            code: draft.interventionCode,
            nutritionistLevel: selectedNutritionist.level,
            recentInterventionCount,
          }),
        }
      : null;
  const canSelectIntervention = (code: NutritionInterventionCode) =>
    editor.nutritionists.some((nutritionist) =>
      canReserveNutritionistForDraft({
        nutritionist,
        interventionCode: code,
        usage:
          editor.usageByNutritionist[nutritionist.contractId] ?? 0,
        currentNutritionistContractId: draft.nutritionistContractId,
        hasCurrentIntervention: Boolean(draft.interventionCode),
      }),
    );
  const hasAvailableIntervention = INTERVENTION_CODES.some(
    canSelectIntervention,
  );

  function selectIntervention(code: NutritionInterventionCode | null) {
    if (!code) {
      editor.updateDraft(riderId, {
        interventionCode: null,
        nutritionistContractId: null,
      });
      return;
    }

    const nutritionist =
      editor.nutritionists.find((option) =>
        canReserveNutritionistForDraft({
          nutritionist: option,
          interventionCode: code,
          usage: editor.usageByNutritionist[option.contractId] ?? 0,
          currentNutritionistContractId: draft.nutritionistContractId,
          hasCurrentIntervention: Boolean(draft.interventionCode),
        }),
      ) ?? null;

    if (!nutritionist) return;

    editor.updateDraft(riderId, {
      interventionCode: code,
      nutritionistContractId: nutritionist.contractId,
    });
  }

  return (
    <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-[minmax(190px,1fr)_minmax(220px,1.15fr)_minmax(150px,0.7fr)] md:items-end">
      <label className="grid gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#658F42]">
          Complément
        </span>
        <select
          name={`nutrition-intervention-${riderId}`}
          value={draft.interventionCode ?? ""}
          disabled={riderForm >= 100 || !hasAvailableIntervention}
          onChange={(event) =>
            selectIntervention(
              (event.target.value || null) as NutritionInterventionCode | null,
            )
          }
          className="min-h-11 min-w-0 rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-black text-[#183F37] outline-none focus:border-[#78A94E] disabled:cursor-not-allowed disabled:bg-[#F4F7F5] disabled:text-[#809189]"
        >
          <option value="">Aucun complément</option>
          {INTERVENTION_CODES.map((code) => {
            const isAvailable = canSelectIntervention(code);
            return (
              <option key={code} value={code} disabled={!isAvailable}>
                {NUTRITION_INTERVENTIONS[code].label}
                {isAvailable ? "" : " · contingent épuisé"}
              </option>
            );
          })}
        </select>
      </label>

      <label className="grid gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#658F42]">
          Nutritionniste
        </span>
        <select
          name={`nutritionist-${riderId}`}
          value={draft.nutritionistContractId ?? ""}
          disabled={!draft.interventionCode}
          onChange={(event) => {
            const nextContractId = event.target.value || null;
            if (!nextContractId) {
              editor.updateDraft(riderId, {
                nutritionistContractId: null,
              });
              return;
            }

            const nutritionist = editor.nutritionists.find(
              (option) => option.contractId === nextContractId,
            );
            if (
              !nutritionist ||
              !draft.interventionCode ||
              !canReserveNutritionistForDraft({
                nutritionist,
                interventionCode: draft.interventionCode,
                usage:
                  editor.usageByNutritionist[nutritionist.contractId] ?? 0,
                currentNutritionistContractId:
                  draft.nutritionistContractId,
                hasCurrentIntervention: Boolean(draft.interventionCode),
              })
            ) {
              return;
            }

            editor.updateDraft(riderId, {
              nutritionistContractId: nextContractId,
            });
          }}
          className="min-h-11 min-w-0 rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-black text-[#183F37] outline-none focus:border-[#78A94E] disabled:cursor-not-allowed disabled:bg-[#F4F7F5] disabled:text-[#809189]"
        >
          <option value="">Choisir un nutritionniste</option>
          {editor.nutritionists.map((nutritionist) => {
            const usage =
              editor.usageByNutritionist[nutritionist.contractId] ?? 0;
            const isLocked = draft.interventionCode
              ? nutritionist.level <
                NUTRITION_INTERVENTIONS[draft.interventionCode]
                  .minimumNutritionistLevel
              : false;
            const canReserve = draft.interventionCode
              ? canReserveNutritionistForDraft({
                  nutritionist,
                  interventionCode: draft.interventionCode,
                  usage,
                  currentNutritionistContractId:
                    draft.nutritionistContractId,
                  hasCurrentIntervention: Boolean(draft.interventionCode),
                })
              : false;
            const isFull = !isLocked && !canReserve;

            return (
              <option
                key={nutritionist.contractId}
                value={nutritionist.contractId}
                disabled={!canReserve}
              >
                {nutritionist.name} · niv. {nutritionist.level} · {usage}/
                {nutritionist.remainingCapacity} nouvelles places
                {isLocked ? " · niveau insuffisant" : isFull ? " · complet" : ""}
              </option>
            );
          })}
        </select>
      </label>

      <div className="min-h-11 rounded-xl bg-[#EEF7E8] px-3 py-2.5 text-xs font-bold text-[#527633]">
        {outcome ? (
          <>
            <span className="block font-black">
              +{actualFormGain} forme · {formatCurrency(outcome.price, currency)}
            </span>
            <span className="mt-0.5 block text-[10px] text-[#6E805F]">
              {weightImpact ? (
                <>
                  Impact poids · {formatPercentage(weightImpact.riskPct)} de
                  risque · +{formatWeight(weightImpact.gainKg)} kg si déclenché
                  {recentInterventionCount > 0
                    ? ` · ${recentInterventionCount} prise${recentInterventionCount > 1 ? "s" : ""} récente${recentInterventionCount > 1 ? "s" : ""}`
                    : ""}
                  {riderWeightKg !== null
                    ? ` · poids actuel ${formatWeight(riderWeightKg)} kg`
                    : ""}
                </>
              ) : (
                "Maximum d’un complément aujourd’hui"
              )}
            </span>
          </>
        ) : riderForm >= 100 ? (
          "Forme déjà au maximum"
        ) : !hasAvailableIntervention ? (
          "Contingent des nutritionnistes épuisé"
        ) : (
          "Aucun coût programmé"
        )}
      </div>
    </div>
  );
}

export function NutritionWeightProgramFields({ riderId, isUnderweight = false, isOverweight = false }: {
  riderId: string; isUnderweight?: boolean; isOverweight?: boolean;
}) {
  const editor = useNutritionEditor();
  const rider = editor.weightRiders.find(candidate => candidate.riderId === riderId);
  const [direction, setDirection] = useState(isUnderweight ? 1 : -1);
  if (!rider || rider.heightCm === null || rider.weightKg === null) return null;
  const delta = editor.weightDrafts[riderId] ?? 0;
  const gain = editor.supplementFormGain(riderId);
  const quote = delta ? getWeightProgramQuote(rider, delta, gain) : null;
  return <details className="group mt-3 border-t border-[#315B3E]/10 pt-2">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1 text-[11px] font-semibold text-[#60756E] marker:content-none [&::-webkit-details-marker]:hidden">
      <span>Ajuster le poids <span className="font-normal text-[#809189]">· optionnel</span></span>
      <span className="text-[10px] text-[#658F42]">{delta ? `${delta > 0 ? "+" : "−"}${formatWeight(Math.abs(delta))} kg sélectionné` : isUnderweight ? "Sous-poids" : isOverweight ? "Surpoids" : "Affûtage / athlétisation"} <span className="inline-block transition group-open:rotate-180">⌄</span></span>
    </summary>
    <div className="mt-2 rounded-xl bg-[#F4F7F5] p-3 text-xs text-[#60756E]">
      <p className="text-[11px]">±0,2 à 1 kg · −4 forme par 0,2 kg · un programme tous les 5 jours, dans les deux sens.</p>
      {rider.cooldownDays > 0 ? <p className="mt-2 font-bold">Prochain programme dans {rider.cooldownDays} j.</p> : <>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1"><span className="text-[10px] font-bold">Programme</span>
            <select aria-label="Programme de poids" value={delta === 0 ? "" : direction > 0 ? "gain" : "cut"}
              onChange={event => { const sign = event.target.value === "gain" ? 1 : -1; setDirection(sign); editor.setWeightDraft(riderId, event.target.value ? sign * 0.2 : 0); }}
              className="min-h-10 min-w-0 rounded-lg border border-[#315B3E]/15 bg-white px-2 text-xs">
              <option value="">Aucun programme</option><option value="cut">Affûtage · alléger</option><option value="gain">Athlétisation · renforcer</option>
            </select>
          </label>
          <label className="grid gap-1"><span className="text-[10px] font-bold">Poids / coût en forme</span>
            <select aria-label="Variation de poids et coût en forme" disabled={!delta} value={Math.abs(delta) || 0.2}
              onChange={event => editor.setWeightDraft(riderId, direction * Number(event.target.value))}
              className="min-h-10 min-w-0 rounded-lg border border-[#315B3E]/15 bg-white px-2 text-xs disabled:opacity-50">
              {WEIGHT_PROGRAM_STEPS.map(step => <option key={step} value={step}
                disabled={!getWeightProgramQuote(rider, direction * step, gain).allowed}>
                {direction > 0 ? "+" : "−"}{formatWeight(step)} kg · −{step * 20} forme
              </option>)}
            </select>
          </label>
        </div>
        {quote ? <p className={`mt-2 text-[11px] font-bold ${quote.allowed ? "text-[#527633]" : "text-[#C5483D]"}`} role="status">
          {quote.allowed ? `Poids prévu ${formatWeight(quote.weightAfterKg!)} kg · forme prévue ${quote.formAfter}/100. À valider avec les compléments.` : "Forme insuffisante ou limite de poids atteinte : ajustez la sélection."}
        </p> : null}
      </>}
      {(isUnderweight || isOverweight) ? <p className="mt-2 text-[10px]">{isUnderweight ? "Un poids trop faible réduit la puissance de ce profil. L’athlétisation peut aider." : "L’affûtage peut réduire le surpoids. Évitez de descendre sous le poids adapté au profil."}</p> : null}
    </div>
  </details>;
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
  }).format(value) + " %";
}

function formatWeight(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function useNutritionEditor() {
  const editor = useContext(NutritionEditorContext);
  if (!editor) {
    throw new Error(
      "NutritionInterventionFields doit être rendu dans NutritionInterventionsEditor.",
    );
  }
  return editor;
}

function NutritionBulkSubmitButton({
  count,
  disabled,
}: {
  count: number;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F2C94C] px-4 text-center text-xs font-black uppercase tracking-[0.08em] text-[#0B302B] transition hover:bg-[#FFE071] disabled:cursor-not-allowed disabled:bg-[#91A59D] disabled:text-white sm:min-w-56"
    >
      {pending
        ? count === 1
          ? "Application du choix…"
          : `Application des ${count} choix…`
        : count === 1
          ? "Valider le choix"
          : "Tout valider"}
    </button>
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
