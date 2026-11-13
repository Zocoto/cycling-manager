"use client";

import type { AmateurJerseyConfig } from "@/lib/amateur-team";
import {
  createAmateurRiderJersey,
  createNationalChampionRiderJersey,
  createWorldChampionRiderJersey,
} from "@/lib/rider-jersey";
import type { DevelopmentRider } from "@/services/development-team";

import { DevelopmentRaceRatingSort } from "./development-race-rating-sort";
import { useDevelopmentRaceRegistrationDrafts } from "./development-race-registration-editor";
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
  const { drafts, pending, setDraft } = useDevelopmentRaceRegistrationDrafts();
  const draft = drafts[raceEditionId];
  const initialSelection = initialSelectedRiderIds.slice(0, selectionMaximum);
  const selectedRiderIds = new Set(draft?.riderIds ?? initialSelection);
  const quotaReached = selectedRiderIds.size >= selectionMaximum;

  function updateSelection(riderId: string, checked: boolean) {
    if (pending || (checked && quotaReached)) return;
    const next = new Set(selectedRiderIds);
    if (checked) next.add(riderId);
    else next.delete(riderId);
    const unchanged =
      next.size === initialSelection.length &&
      initialSelection.every((id) => next.has(id));
    setDraft(raceEditionId, unchanged ? null : {
      riderIds: [...next],
      complete: next.size >= selectionMinimum,
    });
  }

  return (
    <div className="border-t border-[#315B3E]/8 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black text-[#183F37]">
          {selectedRiderIds.size}/{selectionMaximum} coureurs sélectionnés
        </p>
        {quotaReached ? (
          <p className="rounded-full bg-[#FFF3BC] px-3 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-[#705400]">
            Quota atteint · désélectionnez un coureur pour en choisir un autre
          </p>
        ) : null}
        {draft ? (
          <div className="flex flex-wrap items-center gap-2">
            {!draft.complete ? (
              <p className="text-xs font-bold text-[#875313]">Sélection incomplète</p>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => setDraft(raceEditionId, null)}
              className="min-h-10 rounded-lg px-2 text-xs font-bold text-[#176951] hover:bg-[#E5F4ED] disabled:opacity-50"
            >
              Rétablir la sélection
            </button>
          </div>
        ) : null}
      </div>
      <DevelopmentRaceRatingSort riders={riders}>
        {(rider) => {
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
                value={rider.id}
                checked={selected}
                disabled={disabled || pending}
                onChange={(event) =>
                  updateSelection(rider.id, event.currentTarget.checked)
                }
                className="absolute right-4 top-4 z-10 h-5 w-5 accent-[#176951] disabled:cursor-not-allowed"
              />
              <DevelopmentRiderVisibleProfile
                rider={rider}
                jersey={getDevelopmentRiderJersey(rider, teamJersey)}
                avatarClassName="h-12 w-12"
                seasonRaceDays={rider.seasonRaceDays}
                projectedSeasonRaceDays={rider.projectedSeasonRaceDays}
              />
            </label>
          );
        }}
      </DevelopmentRaceRatingSort>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#60756E]">
          Entre {selectionMinimum} et {selectionMaximum} coureurs · clôture au
          début de J{startDayNumber}
        </p>
      </div>
    </div>
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
      nationalDesign: rider.championshipTitle.nationalDesign,
    });
  }
  return createAmateurRiderJersey(teamJersey);
}
