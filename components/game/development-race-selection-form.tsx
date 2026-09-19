"use client";

import { useState } from "react";

import { registerDevelopmentRaceAction } from "@/app/jeu/centre-de-formation/development-actions";
import type { AmateurJerseyConfig } from "@/lib/amateur-team";
import {
  createAmateurRiderJersey,
  createNationalChampionRiderJersey,
  createWorldChampionRiderJersey,
} from "@/lib/rider-jersey";
import type { DevelopmentRider } from "@/services/development-team";

import { DevelopmentRiderVisibleProfile } from "./development-rider-visible-profile";

export function DevelopmentRaceSelectionForm({
  raceEditionId,
  riders,
  initialSelectedRiderIds,
  selectionMinimum,
  selectionMaximum,
  startDayNumber,
  teamJersey,
}: {
  raceEditionId: string;
  riders: DevelopmentRider[];
  initialSelectedRiderIds: string[];
  selectionMinimum: number;
  selectionMaximum: number;
  startDayNumber: number;
  teamJersey: AmateurJerseyConfig;
}) {
  const [selectedRiderIds, setSelectedRiderIds] = useState(
    () => new Set(initialSelectedRiderIds.slice(0, selectionMaximum)),
  );
  const quotaReached = selectedRiderIds.size >= selectionMaximum;
  const selectionComplete = selectedRiderIds.size >= selectionMinimum;

  function updateSelection(riderId: string, checked: boolean) {
    setSelectedRiderIds((current) => {
      const next = new Set(current);
      if (checked) {
        if (next.size >= selectionMaximum && !next.has(riderId)) return current;
        next.add(riderId);
      } else {
        next.delete(riderId);
      }
      return next;
    });
  }

  return (
    <form
      action={registerDevelopmentRaceAction}
      className="border-t border-[#315B3E]/8 p-4 sm:p-5"
    >
      <input type="hidden" name="raceEditionId" value={raceEditionId} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black text-[#183F37]">
          {selectedRiderIds.size}/{selectionMaximum} coureurs sélectionnés
        </p>
        {quotaReached ? (
          <p className="rounded-full bg-[#FFF3BC] px-3 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-[#705400]">
            Quota atteint · désélectionnez un coureur pour en choisir un autre
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {riders.map((rider) => {
          const selected = selectedRiderIds.has(rider.id);
          const disabled = isDevelopmentRaceRiderSelectionDisabled(
            selectedRiderIds,
            rider.id,
            selectionMaximum,
          );
          return (
            <label
              key={rider.id}
              aria-disabled={disabled}
              className={`relative block rounded-2xl border p-4 transition ${
                disabled
                  ? "cursor-not-allowed border-[#315B3E]/8 bg-[#F0F3F1] opacity-50 grayscale"
                  : selected
                    ? "cursor-pointer border-[#176951]/55 bg-[#F4FBF8]"
                    : "cursor-pointer border-[#315B3E]/12 bg-white hover:border-[#176951]/45"
              }`}
            >
              <input
                type="checkbox"
                name="riderIds"
                value={rider.id}
                checked={selected}
                disabled={disabled}
                onChange={(event) =>
                  updateSelection(rider.id, event.currentTarget.checked)
                }
                className="absolute right-4 top-4 z-10 h-5 w-5 accent-[#176951] disabled:cursor-not-allowed"
              />
              <DevelopmentRiderVisibleProfile
                rider={rider}
                jersey={getDevelopmentRiderJersey(rider, teamJersey)}
                avatarClassName="h-12 w-12"
              />
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#60756E]">
          Entre {selectionMinimum} et {selectionMaximum} coureurs · clôture au
          début de J{startDayNumber}
        </p>
        <button
          type="submit"
          disabled={!selectionComplete}
          className="min-h-11 rounded-xl bg-[#176951] px-5 text-xs font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:bg-[#C7D1CD] disabled:text-[#60756E]"
        >
          Enregistrer l’engagement
        </button>
      </div>
    </form>
  );
}

export function isDevelopmentRaceRiderSelectionDisabled(
  selectedRiderIds: ReadonlySet<string>,
  riderId: string,
  selectionMaximum: number,
) {
  return (
    selectedRiderIds.size >= selectionMaximum &&
    !selectedRiderIds.has(riderId)
  );
}

function getDevelopmentRiderJersey(
  rider: DevelopmentRider,
  teamJersey: AmateurJerseyConfig,
) {
  if (rider.championshipTitle?.level === "world") {
    return createWorldChampionRiderJersey({
      championshipType: rider.championshipTitle.discipline,
    });
  }
  if (rider.championshipTitle?.level === "national") {
    return createNationalChampionRiderJersey({
      countryCode: rider.championshipTitle.countryCode,
      championshipType: rider.championshipTitle.discipline,
    });
  }
  return createAmateurRiderJersey(teamJersey);
}
