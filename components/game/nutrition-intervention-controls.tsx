"use client";

import { useState } from "react";

import { HealthCenterSubmitButton } from "@/components/game/health-center-submit-button";
import {
  NUTRITION_INTERVENTIONS,
  getNutritionInterventionOutcome,
  type NutritionInterventionCode,
} from "@/lib/game/health-center";

export type NutritionistInterventionOption = {
  contractId: string;
  name: string;
  level: number;
  remainingCapacity: number;
};

const INTERVENTION_CODES = Object.keys(
  NUTRITION_INTERVENTIONS,
) as NutritionInterventionCode[];

export function NutritionInterventionControls({
  nutritionists,
  riderForm,
  balance,
  currency,
  disabled = false,
}: {
  nutritionists: NutritionistInterventionOption[];
  riderForm: number;
  balance: number;
  currency: string;
  disabled?: boolean;
}) {
  const defaultNutritionist =
    nutritionists.find((nutritionist) => nutritionist.remainingCapacity > 0) ??
    null;
  const [nutritionistContractId, setNutritionistContractId] = useState(
    defaultNutritionist?.contractId ?? "",
  );
  const [interventionCode, setInterventionCode] =
    useState<NutritionInterventionCode>(() =>
      getCompatibleNutritionInterventionCode(
        "recovery_snack",
        defaultNutritionist?.level ?? 0,
      ),
    );
  const selectedNutritionist =
    nutritionists.find(
      (nutritionist) => nutritionist.contractId === nutritionistContractId,
    ) ?? null;
  const outcome = selectedNutritionist
    ? getNutritionInterventionOutcome({
        code: interventionCode,
        nutritionistLevel: selectedNutritionist.level,
      })
    : null;
  const actualFormGain = outcome
    ? Math.min(outcome.formGain, Math.max(0, 100 - riderForm))
    : 0;
  const cannotSubmit =
    disabled ||
    !selectedNutritionist ||
    selectedNutritionist.remainingCapacity <= 0 ||
    !outcome?.isUnlocked ||
    balance < (outcome?.price ?? Number.POSITIVE_INFINITY);

  return (
    <div className="mt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#658F42]">
            Nutritionniste
          </span>
          <select
            name="nutritionistContractId"
            value={nutritionistContractId}
            disabled={disabled || !defaultNutritionist}
            onChange={(event) => {
              const nextContractId = event.target.value;
              const nextNutritionist = nutritionists.find(
                (nutritionist) =>
                  nutritionist.contractId === nextContractId,
              );
              setNutritionistContractId(nextContractId);
              setInterventionCode((current) =>
                getCompatibleNutritionInterventionCode(
                  current,
                  nextNutritionist?.level ?? 0,
                ),
              );
            }}
            className="min-h-11 min-w-0 rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-black text-[#183F37] outline-none focus:border-[#78A94E] disabled:cursor-not-allowed disabled:bg-[#F4F7F5] disabled:text-[#809189]"
          >
            {nutritionists.map((nutritionist) => (
              <option
                key={nutritionist.contractId}
                value={nutritionist.contractId}
                disabled={nutritionist.remainingCapacity <= 0}
              >
                {nutritionist.name} · niv. {nutritionist.level} ·{" "}
                {nutritionist.remainingCapacity > 0
                  ? `${nutritionist.remainingCapacity} place${nutritionist.remainingCapacity > 1 ? "s" : ""}`
                  : "complet"}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#658F42]">
            Complément
          </span>
          <select
            name="interventionCode"
            value={interventionCode}
            disabled={disabled || !selectedNutritionist}
            onChange={(event) =>
              setInterventionCode(
                event.target.value as NutritionInterventionCode,
              )
            }
            className="min-h-11 min-w-0 rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-black text-[#183F37] outline-none focus:border-[#78A94E] disabled:cursor-not-allowed disabled:bg-[#F4F7F5] disabled:text-[#809189]"
          >
            {INTERVENTION_CODES.map((code) => {
              const intervention = NUTRITION_INTERVENTIONS[code];
              const unlocked =
                (selectedNutritionist?.level ?? 0) >=
                intervention.minimumNutritionistLevel;

              return (
                <option key={code} value={code} disabled={!unlocked}>
                  {intervention.label}
                  {unlocked
                    ? ""
                    : ` · niveau ${intervention.minimumNutritionistLevel} requis`}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p
          aria-live="polite"
          className="min-w-0 text-xs font-bold text-[#60756E]"
        >
          {selectedNutritionist && outcome ? (
            <>
              <span className="text-[#527633]">
                {selectedNutritionist.name}
              </span>{" "}
              · +{actualFormGain} forme ·{" "}
              {formatCurrency(outcome.price, currency)}
            </>
          ) : (
            "Aucun nutritionniste disponible aujourd’hui."
          )}
        </p>
        <HealthCenterSubmitButton
          pendingLabel="Application…"
          disabled={cannotSubmit}
        >
          Appliquer
        </HealthCenterSubmitButton>
      </div>

      {outcome && balance < outcome.price ? (
        <p className="mt-2 text-[11px] font-bold text-red-700">
          Trésorerie insuffisante pour ce complément.
        </p>
      ) : null}
    </div>
  );
}

export function getCompatibleNutritionInterventionCode(
  requestedCode: NutritionInterventionCode,
  nutritionistLevel: number,
): NutritionInterventionCode {
  if (
    nutritionistLevel >=
    NUTRITION_INTERVENTIONS[requestedCode].minimumNutritionistLevel
  ) {
    return requestedCode;
  }

  return (
    INTERVENTION_CODES.find(
      (code) =>
        nutritionistLevel >=
        NUTRITION_INTERVENTIONS[code].minimumNutritionistLevel,
    ) ?? "recovery_snack"
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
