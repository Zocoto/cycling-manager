"use client";

import { useFormStatus } from "react-dom";

import {
  SPONSOR_OBJECTIVE_DIFFICULTIES,
  SPONSOR_OBJECTIVE_DIFFICULTY_CONFIG,
  calculateSponsorNegotiatedBudget,
  isSponsorObjectiveDifficulty,
  type SponsorObjectiveDifficulty,
} from "@/lib/game/sponsor-negotiation";

import {
  negotiateContinuingSponsorObjectivesAction,
  negotiateSponsorOfferAction,
} from "./actions";

type SponsorNegotiationControlProps = {
  offerId: string;
  contractId?: string;
  negotiationMode?: "offer" | "continuing-contract";
  sponsorName: string;
  targetSeasonName: string;
  baseBudget: number;
  budgetCeiling: number;
  currentDifficulty: SponsorObjectiveDifficulty;
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
};

export function SponsorNegotiationControl({
  offerId,
  contractId,
  negotiationMode = "offer",
  sponsorName,
  targetSeasonName,
  baseBudget,
  budgetCeiling,
  currentDifficulty,
  primaryColor,
  textColor,
  backgroundColor,
}: SponsorNegotiationControlProps) {
  return (
    <form
      id={`negociation-${offerId}`}
      action={
        negotiationMode === "continuing-contract"
          ? negotiateContinuingSponsorObjectivesAction
          : negotiateSponsorOfferAction
      }
      className="mt-5 scroll-mt-24 rounded-xl border bg-white/85 p-4"
      style={{ borderColor: `${primaryColor}30` }}
    >
      <input type="hidden" name="offerId" value={offerId} />
      {contractId ? (
        <input type="hidden" name="contractId" value={contractId} />
      ) : null}
      <NegotiationChoices
        baseBudget={baseBudget}
        budgetCeiling={budgetCeiling}
        currentDifficulty={currentDifficulty}
        primaryColor={primaryColor}
        textColor={textColor}
        backgroundColor={backgroundColor}
        sponsorName={sponsorName}
        targetSeasonName={targetSeasonName}
      />
    </form>
  );
}

function NegotiationChoices({
  baseBudget, budgetCeiling, currentDifficulty, primaryColor,
  textColor, backgroundColor, sponsorName, targetSeasonName,
}: Pick<SponsorNegotiationControlProps,
  "baseBudget" | "budgetCeiling" | "currentDifficulty" | "primaryColor" |
  "textColor" | "backgroundColor" | "sponsorName" | "targetSeasonName"
>) {
  const { pending, data } = useFormStatus();
  const requested = data?.get("objectiveDifficulty");
  // Derive the preview from the submitted form. Once it settles, only the
  // refreshed server value is authoritative, including after a failed save.
  const selectedDifficulty = pending && typeof requested === "string" && isSponsorObjectiveDifficulty(requested)
    ? requested : currentDifficulty;
  const selectedBudget = calculateSponsorNegotiatedBudget({
    baseBudget, budgetCeiling, difficulty: selectedDifficulty,
  });
  return (
    <div aria-busy={pending}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-extrabold uppercase tracking-[0.14em]"
            style={{ color: primaryColor }}
          >
            Négociation des objectifs
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#60756E]">
            Le choix s’enregistre dès le clic et actualise les objectifs.
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-black"
          style={{ backgroundColor, color: textColor }}
        >
          {formatMoney(selectedBudget)} / saison
        </span>
      </div>

      <div
        className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border bg-[#EDF2EF] p-1"
        style={{ borderColor: `${primaryColor}25` }}
        role="radiogroup"
        aria-label={`Difficulté des objectifs sponsor · ${sponsorName} · ${targetSeasonName}`}
      >
        {SPONSOR_OBJECTIVE_DIFFICULTIES.map((difficulty) => {
          const config = SPONSOR_OBJECTIVE_DIFFICULTY_CONFIG[difficulty];
          const isSelected = difficulty === selectedDifficulty;
          const budget = calculateSponsorNegotiatedBudget({
            baseBudget,
            budgetCeiling,
            difficulty,
          });

          return (
            <button
              key={difficulty}
              type="submit"
              name="objectiveDifficulty"
              value={difficulty}
              disabled={pending || difficulty === currentDifficulty}
              role="radio"
              aria-checked={isSelected}
              className="min-h-16 rounded-md px-2 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-default"
              style={
                isSelected
                  ? {
                      backgroundColor: primaryColor,
                      color: "#FFFFFF",
                      boxShadow: `0 7px 18px ${primaryColor}30`,
                    }
                  : { color: textColor }
              }
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.08em] sm:text-xs">
                {config.shortLabel}
              </span>
              <span
                className={`mt-1 block text-[10px] font-bold ${
                  isSelected ? "text-white/80" : "text-[#6A7C76]"
                }`}
              >
                {formatMoney(budget)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-[#60756E]">
        {SPONSOR_OBJECTIVE_DIFFICULTY_CONFIG[selectedDifficulty].description}
        {selectedDifficulty === "ambitious"
          ? " La majoration d’ambition s’applique aussi au-dessus du plafond catalogue."
          : ""}
      </p>

      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs font-semibold text-[#60756E]">
        {pending ? "Actualisation des objectifs…" : ""}
      </p>
    </div>
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
