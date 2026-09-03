"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import {
  SPONSOR_OBJECTIVE_DIFFICULTIES,
  SPONSOR_OBJECTIVE_DIFFICULTY_CONFIG,
  calculateSponsorNegotiatedBudget,
  type SponsorObjectiveDifficulty,
} from "@/lib/game/sponsor-negotiation";

import { negotiateSponsorOfferAction } from "./actions";

type SponsorNegotiationControlProps = {
  offerId: string;
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
  sponsorName,
  targetSeasonName,
  baseBudget,
  budgetCeiling,
  currentDifficulty,
  primaryColor,
  textColor,
  backgroundColor,
}: SponsorNegotiationControlProps) {
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<SponsorObjectiveDifficulty>(currentDifficulty);
  const selectedBudget = calculateSponsorNegotiatedBudget({
    baseBudget,
    budgetCeiling,
    difficulty: selectedDifficulty,
  });

  function confirmNegotiation(event: React.FormEvent<HTMLFormElement>) {
    if (selectedDifficulty === currentDifficulty) {
      event.preventDefault();
      return;
    }

    const selectedConfig =
      SPONSOR_OBJECTIVE_DIFFICULTY_CONFIG[selectedDifficulty];
    const confirmed = window.confirm(
      [
        `Négocier l’offre de ${sponsorName} pour ${targetSeasonName} ?`,
        "",
        `Difficulté : ${selectedConfig.label}`,
        `Nouvel apport annuel : ${formatMoney(selectedBudget)}`,
        "",
        "Les dix objectifs seront recalculés immédiatement.",
        "Vous pourrez encore modifier ce réglage avant la signature.",
      ].join("\n"),
    );

    if (!confirmed) event.preventDefault();
  }

  return (
    <form
      action={negotiateSponsorOfferAction}
      onSubmit={confirmNegotiation}
      className="mt-5 rounded-xl border bg-white/85 p-4"
      style={{ borderColor: `${primaryColor}30` }}
    >
      <input type="hidden" name="offerId" value={offerId} />
      <input
        type="hidden"
        name="objectiveDifficulty"
        value={selectedDifficulty}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-extrabold uppercase tracking-[0.14em]"
            style={{ color: primaryColor }}
          >
            Négociation des objectifs
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#60756E]">
            Plus les attentes montent, plus l’apport augmente.
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
        aria-label="Difficulté des objectifs sponsor"
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
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedDifficulty(difficulty)}
              className="min-h-16 rounded-md px-2 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
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
        {selectedDifficulty === "ambitious" && selectedBudget >= budgetCeiling
          ? ` Plafond du palier atteint à ${formatMoney(budgetCeiling)}.`
          : ""}
      </p>

      <NegotiationSubmitButton
        disabled={selectedDifficulty === currentDifficulty}
        primaryColor={primaryColor}
      />
    </form>
  );
}

function NegotiationSubmitButton({
  disabled,
  primaryColor,
}: {
  disabled: boolean;
  primaryColor: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-white transition enabled:hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
      style={{ backgroundColor: primaryColor }}
    >
      {pending ? "Négociation…" : "Valider cette négociation"}
    </button>
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
