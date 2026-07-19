"use client";

import { useState } from "react";

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
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white"
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
                className="flex min-h-72 items-center justify-center rounded-xl"
                style={{
                  background: `linear-gradient(145deg, ${sponsor.colors.background}, #FFFFFF)`,
                }}
              >
                <JerseyPreview
                  jersey={jersey}
                  sponsor={sponsor}
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

function JerseyPreview({
  jersey,
  sponsor,
}: {
  jersey: SponsorJersey;
  sponsor: Sponsor;
}) {
  return (
    <svg
      aria-label={`Aperçu provisoire du maillot ${jersey.name}`}
      role="img"
      viewBox="0 0 260 300"
      className="h-64 w-56 drop-shadow-xl"
    >
      <defs>
        <clipPath id={`body-${jersey.id}`}>
          <path d="M88 42 55 58 22 100 55 126 72 105 72 267 188 267 188 105 205 126 238 100 205 58 172 42 153 62 107 62Z" />
        </clipPath>
      </defs>

      <path
        d="M88 42 55 58 22 100 55 126 72 105 72 267 188 267 188 105 205 126 238 100 205 58 172 42 153 62 107 62Z"
        fill={sponsor.colors.primary}
        stroke={sponsor.colors.text}
        strokeWidth="5"
        strokeLinejoin="round"
      />

      <path
        d="M107 62 117 82H143L153 62"
        fill={sponsor.colors.secondary}
        stroke={sponsor.colors.text}
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {jersey.style === "classic" ? (
        <g clipPath={`url(#body-${jersey.id})`}>
          <rect
            x="0"
            y="112"
            width="260"
            height="62"
            fill={sponsor.colors.secondary}
          />

          <rect
            x="0"
            y="132"
            width="260"
            height="22"
            fill={sponsor.colors.accent}
          />
        </g>
      ) : null}

      {jersey.style === "modern" ? (
        <g clipPath={`url(#body-${jersey.id})`}>
          <path
            d="M-20 250 220 18 282 72 42 310Z"
            fill={sponsor.colors.secondary}
          />

          <path
            d="M-4 270 236 38 258 58 18 290Z"
            fill={sponsor.colors.accent}
          />
        </g>
      ) : null}

      {jersey.style === "bold" ? (
        <g clipPath={`url(#body-${jersey.id})`}>
          <path
            d="M130 0H280V320H130Z"
            fill={sponsor.colors.accent}
          />

          <path
            d="M115 0H145V320H115Z"
            fill={sponsor.colors.secondary}
          />

          <circle
            cx="130"
            cy="164"
            r="68"
            fill="none"
            stroke={sponsor.colors.secondary}
            strokeWidth="14"
            opacity="0.65"
          />
        </g>
      ) : null}

      <text
        x="130"
        y="198"
        textAnchor="middle"
        fill={sponsor.colors.text}
        fontSize="17"
        fontWeight="900"
      >
        {sponsor.shortName.toUpperCase()}
      </text>

      <path
        d="M72 238H188"
        stroke={sponsor.colors.text}
        strokeWidth="4"
        opacity="0.45"
      />

      <path
        d="M72 252H188"
        stroke={sponsor.colors.text}
        strokeWidth="4"
        opacity="0.45"
      />
    </svg>
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