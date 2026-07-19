"use client";

import { useState } from "react";

import { SponsorJerseyPreview } from "@/components/game/sponsor-jersey-preview";
import type { Sponsor } from "@/types/sponsor";

import { validateSponsorJerseyAction } from "./actions";

type SponsorJersey =
  Sponsor["jerseys"][number];

type ConfirmSponsorButtonProps = {
  sponsorName: string;
  budgetLabel: string;
  durationLabel: string;
  objectives: readonly string[];
};

export function ConfirmSponsorButton({
  sponsorName,
  budgetLabel,
  durationLabel,
  objectives,
}: ConfirmSponsorButtonProps) {
  function confirmSignature(
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    const objectivesSummary = objectives
      .map(
        (objective, index) =>
          `${index + 1}. ${objective}`
      )
      .join("\n");

    const confirmed = window.confirm(
      [
        `Signer le contrat avec ${sponsorName} ?`,
        "",
        `Budget annuel : ${budgetLabel}`,
        `Durée : ${durationLabel}`,
        "",
        "Objectifs saisonniers :",
        objectivesSummary,
        "",
        "Cette décision est définitive.",
        "Les deux autres offres seront retirées.",
        "Vous choisirez ensuite votre maillot parmi les trois modèles proposés.",
      ].join("\n")
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <button
      type="submit"
      onClick={confirmSignature}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#0B4A3B] px-5 py-3 text-sm font-extrabold uppercase tracking-widest text-white transition hover:bg-[#07382E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2"
    >
      Choisir ce sponsor
    </button>
  );
}

type SponsorJerseySelectorProps = {
  contractId: string;
  sponsor: Sponsor;
};

export function SponsorJerseySelector({
  contractId,
  sponsor,
}: SponsorJerseySelectorProps) {
  const [selectedJerseyId, setSelectedJerseyId] =
    useState<string>("");

  const selectedJersey =
    sponsor.jerseys.find(
      (jersey) =>
        jersey.id === selectedJerseyId
    ) ?? null;

  function confirmJerseySelection(
    event: React.FormEvent<HTMLFormElement>
  ) {
    if (!selectedJersey) {
      event.preventDefault();
      return;
    }

    const confirmed = window.confirm(
      [
        `Valider le maillot « ${selectedJersey.name} » ?`,
        "",
        `Sponsor : ${sponsor.name}`,
        `Style : ${formatJerseyStyle(selectedJersey.style)}`,
        "",
        "Le contrat sera activé et le budget sponsor sera versé à votre équipe.",
        "Le maillot ne pourra plus être modifié pendant ce contrat.",
      ].join("\n")
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={validateSponsorJerseyAction}
      onSubmit={confirmJerseySelection}
      className="mt-8"
    >
      <input
        type="hidden"
        name="contractId"
        value={contractId}
      />

      <input
        type="hidden"
        name="jerseyId"
        value={selectedJersey?.id ?? ""}
      />

      <input
        type="hidden"
        name="jerseyStyle"
        value={selectedJersey?.style ?? ""}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {sponsor.jerseys.map((jersey) => {
          const isSelected =
            jersey.id === selectedJerseyId;

          return (
            <label
              key={jersey.id}
              className={[
                "relative cursor-pointer overflow-hidden rounded-2xl border-2 bg-white p-5 shadow-[0_18px_44px_rgba(19,60,46,0.09)] transition",
                isSelected
                  ? "scale-[1.015]"
                  : "hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(19,60,46,0.14)]",
              ].join(" ")}
              style={{
                borderColor: isSelected
                  ? sponsor.colors.accent
                  : `${sponsor.colors.primary}30`,
                boxShadow: isSelected
                  ? `0 0 0 4px ${sponsor.colors.accent}22, 0 22px 50px ${sponsor.colors.primary}20`
                  : undefined,
              }}
            >
              <input
                type="radio"
                name="jerseyChoice"
                value={jersey.id}
                checked={isSelected}
                onChange={() =>
                  setSelectedJerseyId(jersey.id)
                }
                className="sr-only"
              />

              <span
                className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white"
                style={{
                  borderColor: isSelected
                    ? sponsor.colors.accent
                    : `${sponsor.colors.primary}55`,
                }}
              >
                {isSelected ? (
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{
                      backgroundColor:
                        sponsor.colors.accent,
                    }}
                  />
                ) : null}
              </span>

              <div
                className="flex min-h-72 items-center justify-center overflow-hidden rounded-xl"
                style={{
                  background: `linear-gradient(145deg, ${sponsor.colors.background}, #FFFFFF)`,
                }}
              >
                <SponsorJerseyPreview
                  jersey={jersey}
                  sponsor={sponsor}
                  className="h-64 w-56 drop-shadow-xl"
                />
              </div>

              <div className="mt-5 text-center">
                <p
                  className="text-xs font-extrabold uppercase tracking-[0.18em]"
                  style={{
                    color:
                      sponsor.colors.primary,
                  }}
                >
                  {formatJerseyStyle(
                    jersey.style
                  )}
                </p>

                <h3
                  className="mt-2 text-xl font-black"
                  style={{
                    color: sponsor.colors.text,
                  }}
                >
                  {jersey.name}
                </h3>

                <p className="mt-2 text-sm font-semibold text-[#60756E]">
                  Modèle {jersey.style}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="submit"
          disabled={!selectedJersey}
          className="inline-flex min-h-13 w-full max-w-xl items-center justify-center rounded-xl bg-[#0B4A3B] px-6 py-4 text-sm font-extrabold uppercase tracking-widest text-white transition hover:bg-[#07382E] disabled:cursor-not-allowed disabled:bg-[#B6C5C0] disabled:text-[#657972] sm:text-base"
        >
          {selectedJersey
            ? `Valider le maillot ${selectedJersey.name}`
            : "Sélectionnez un maillot"}
        </button>
      </div>
    </form>
  );
}


type TerminateSponsorContractButtonProps = {
  sponsorName: string;
  reputationPenalty: number;
};

export function TerminateSponsorContractButton({
  sponsorName,
  reputationPenalty,
}: TerminateSponsorContractButtonProps) {
  function confirmTermination(
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    const confirmed = window.confirm(
      [
        `Rompre le contrat avec ${sponsorName} ?`,
        "",
        `Pénalité : -${reputationPenalty} points de réputation`,
        "",
        "Le sponsor et son maillot seront immédiatement retirés de votre équipe.",
        "Les objectifs encore en cours seront considérés comme échoués.",
        "Le budget déjà versé ne sera pas retiré.",
        "Aucune nouvelle offre ne sera proposée avant la saison suivante.",
        "",
        "Cette décision est définitive.",
      ].join("\n")
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <button
      type="submit"
      onClick={confirmTermination}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-red-300 bg-red-700 px-5 py-3 text-sm font-extrabold uppercase tracking-widest text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
    >
      Rompre le contrat
    </button>
  );
}

function formatJerseyStyle(
  style: SponsorJersey["style"]
): string {
  const labels: Record<
    SponsorJersey["style"],
    string
  > = {
    classic: "Classique",
    modern: "Moderne",
    bold: "Audacieux",
  };

  return labels[style];
}