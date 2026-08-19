"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { updateDevelopmentTeamRosterAction } from "@/app/jeu/centre-de-formation/development-actions";
import type { DevelopmentRider } from "@/services/development-team";

import { RiderAvatar } from "./rider-avatar";

const MAXIMUM_ROSTER_SIZE = 11;

export function DevelopmentTeamRosterEditor({
  riders,
  selectedRiderIds,
}: {
  riders: DevelopmentRider[];
  selectedRiderIds: string[];
}) {
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(selectedRiderIds),
  );

  function toggleRider(riderId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(riderId)) {
        next.delete(riderId);
      } else if (next.size < MAXIMUM_ROSTER_SIZE) {
        next.add(riderId);
      }
      return next;
    });
  }

  return (
    <details className="mt-4 overflow-hidden rounded-2xl border border-[#278B70]/25 bg-[#F4FBF8] shadow-sm">
      <summary className="cursor-pointer px-5 py-4 text-sm font-black text-[#176951] sm:px-6">
        Modifier l’effectif jusqu’à la fin de J7
      </summary>
      <form
        action={updateDevelopmentTeamRosterAction}
        className="border-t border-[#278B70]/15 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold leading-6 text-[#60756E]">
              Ajoutez ou retirez librement des juniors. À partir de J8, cette
              composition sera figée pour le reste de la saison.
            </p>
            <p className="mt-1 text-xs font-semibold text-[#789087]">
              Une inscription devenue incomplète sera retirée afin de pouvoir être
              recomposée depuis le calendrier.
            </p>
          </div>
          <span className="rounded-full bg-[#0B302B] px-4 py-2 text-sm font-black text-white">
            {selectedIds.size}/{MAXIMUM_ROSTER_SIZE}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {riders.map((rider) => {
            const selected = selectedIds.has(rider.id);
            const disabled =
              !selected && selectedIds.size >= MAXIMUM_ROSTER_SIZE;
            return (
              <label
                key={rider.id}
                className={`relative flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
                  selected
                    ? "border-[#176951] bg-[#E5F4ED] shadow-[inset_0_0_0_1px_#176951]"
                    : disabled
                      ? "cursor-not-allowed border-[#315B3E]/8 bg-[#F4F7F5] opacity-55"
                      : "border-[#315B3E]/12 bg-white hover:border-[#176951]/45"
                }`}
              >
                <input
                  type="checkbox"
                  name="riderIds"
                  value={rider.id}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => toggleRider(rider.id)}
                  className="sr-only"
                />
                <RiderAvatar
                  riderId={rider.id}
                  profileKey={rider.profileKey}
                  seed={rider.avatarSeed}
                  age={rider.age}
                  label={`${rider.firstName} ${rider.lastName}`}
                  className="h-12 w-12 shrink-0 border-2 border-white"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-[#183F37]">
                    {rider.firstName} {rider.lastName}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-bold text-[#60756E]">
                    {rider.countryCode} · {rider.age} ans · {rider.sportingProfile}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${
                    selected
                      ? "bg-[#176951] text-white"
                      : "border border-[#315B3E]/20 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold text-[#60756E]">
            Au moins un junior est requis, onze au maximum.
          </p>
          <SaveRosterButton disabled={selectedIds.size === 0} />
        </div>
      </form>
    </details>
  );
}

function SaveRosterButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="min-h-12 rounded-xl bg-[#176951] px-6 text-sm font-black text-white shadow-sm transition hover:bg-[#0F5743] disabled:cursor-not-allowed disabled:bg-[#B8C5BE]"
    >
      {pending ? "Enregistrement…" : "Enregistrer l’effectif"}
    </button>
  );
}
