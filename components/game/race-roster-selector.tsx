"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { RiderAvatar } from "@/components/game/rider-avatar";
import { isRosterSelectionValid } from "@/lib/game/race-calendar";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";
import type { RaceRosterOption } from "@/services/race-calendar";

type RaceRosterSelectorProps = {
  riders: RaceRosterOption[];
  minimum: number;
  maximum: number;
  jersey: RiderJerseyAppearance;
};

export function RaceRosterSelector({
  riders,
  minimum,
  maximum,
  jersey,
}: RaceRosterSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    riders.filter((rider) => rider.isSelected).map((rider) => rider.riderId)
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectionIsValid = isRosterSelectionValid({
    selectedCount: selectedIds.length,
    minimum,
    maximum,
  });

  function toggleRider(riderId: string) {
    setSelectedIds((current) =>
      current.includes(riderId)
        ? current.filter((id) => id !== riderId)
        : current.length < maximum
          ? [...current, riderId]
          : current
    );
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-[#BFD1C6]">
          Sélectionnez {minimum} à {maximum} coureurs
        </p>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${
            selectionIsValid
              ? "bg-emerald-400/20 text-[#9BE0BC]"
              : "bg-amber-300/15 text-amber-100"
          }`}
        >
          {selectedIds.length} / {maximum}
        </span>
      </div>

      <div className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
        {riders.map((rider) => {
          const isSelected = selectedSet.has(rider.riderId);
          const isDisabled =
            !rider.isAvailable ||
            (!isSelected && selectedIds.length >= maximum);
          const inputId = `rider-${rider.riderId}`;

          return (
            <div
              key={rider.riderId}
              className={`rounded-xl border px-3 py-3 transition ${
                rider.isAvailable
                  ? isSelected
                    ? "border-emerald-300/55 bg-emerald-300/10"
                    : "border-white/10 bg-white/5 hover:border-white/25"
                  : "border-white/5 bg-black/15 opacity-60"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  id={inputId}
                  type="checkbox"
                  name="riderIds"
                  value={rider.riderId}
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => toggleRider(rider.riderId)}
                  className="mt-1 h-4 w-4 accent-emerald-400"
                />

                <label
                  htmlFor={inputId}
                  className={`flex min-w-0 flex-1 items-start gap-3 ${
                    isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <RiderAvatar
                    profileKey={rider.avatarProfileKey}
                    seed={rider.avatarSeed}
                    riderId={rider.riderId}
                    age={rider.age}
                    jersey={jersey}
                    label={`Portrait généré de ${rider.firstName} ${rider.lastName}`}
                    className="h-11 w-11"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-black text-white">
                      <span
                        className={`fi fi-${rider.countryCode.toLowerCase()} shrink-0 rounded`}
                        role="img"
                        aria-label={`Drapeau ${rider.countryName}`}
                      />
                      <span>
                        {rider.firstName} {rider.lastName}
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px] font-semibold text-[#9FB5A8]">
                      {rider.age} ans · MON {rider.mountain} · VAL {rider.hills} · PLA {rider.flat} · CLM {rider.timeTrial} · PAV {rider.cobbles} · SPR {rider.sprint}
                    </span>
                  </span>
                </label>

                <Link
                  href={`/jeu/coureurs/${rider.riderId}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Ouvrir la fiche de ${rider.firstName} ${rider.lastName} dans un nouvel onglet`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-sm font-black text-[#9BE0BC] transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9BE0BC]"
                >
                  ↗
                </Link>
              </div>

              {rider.conflict ? (
                <div className="ml-7 mt-2 flex flex-wrap items-center gap-1 text-[11px] font-bold leading-4 text-amber-200">
                  <span>
                    Indisponible J{rider.conflict.startDay}
                    {rider.conflict.endDay > rider.conflict.startDay
                      ? `–J${rider.conflict.endDay}`
                      : ""}{" "}
                    ·
                  </span>
                  <Link
                    href={`/jeu/courses/${rider.conflict.raceSlug}`}
                    className="underline underline-offset-2"
                  >
                    {rider.conflict.raceName}
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <SubmitRosterButton
        disabled={!selectionIsValid}
        count={selectedIds.length}
      />
      <p className="mt-3 text-center text-[11px] font-semibold leading-5 text-[#9FB5A8]">
        Après validation, la composition ne pourra plus être modifiée directement.
      </p>
    </div>
  );
}

function SubmitRosterButton({
  disabled,
  count,
}: {
  disabled: boolean;
  count: number;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#F2C94C] px-5 py-3 text-sm font-black text-[#17261E] transition hover:-translate-y-0.5 hover:bg-[#F7D96C] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
    >
      {pending ? "Validation en cours…" : `Valider l’inscription (${count})`}
    </button>
  );
}
