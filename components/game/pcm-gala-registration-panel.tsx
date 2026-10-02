"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  savePcmGalaRegistrationAction,
  withdrawPcmGalaRegistrationAction,
} from "@/app/jeu/inscriptions-gala/actions";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import { RiderAvatar } from "@/components/game/rider-avatar";
import {
  PCM_GALA_RACES,
  type PcmGalaRaceKey,
  type PcmGalaRatingKey,
} from "@/lib/game/pcm-gala-races";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";
import type {
  PcmGalaRegistrationContext,
  PcmGalaRider,
} from "@/services/pcm-gala-registration";

type PcmGalaRegistrationPanelProps = PcmGalaRegistrationContext & {
  jersey: RiderJerseyAppearance;
  successMessage?: string;
  errorMessage?: string;
};

const ratingLabels: Record<PcmGalaRatingKey, string> = {
  mountain: "MO",
  hills: "VAL",
  sprint: "SPR",
};

export function PcmGalaRegistrationPanel({
  riders,
  eventStatuses,
  rosterSize,
  selectedEventKey,
  selectedRiderIds,
  jersey,
  successMessage,
  errorMessage,
}: PcmGalaRegistrationPanelProps) {
  const firstOpenRace = PCM_GALA_RACES.find(
    (race) => eventStatuses[race.key] === "open",
  );
  const [activeRaceKey, setActiveRaceKey] = useState<PcmGalaRaceKey>(
    selectedEventKey ?? firstOpenRace?.key ?? PCM_GALA_RACES[0].key,
  );
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(selectedRiderIds),
  );
  const activeRace =
    PCM_GALA_RACES.find((race) => race.key === activeRaceKey) ??
    PCM_GALA_RACES[0];
  const sortedRiders = useMemo(
    () => sortRidersForRace(riders, activeRace.primaryRating),
    [activeRace.primaryRating, riders],
  );
  const isOpen = eventStatuses[activeRaceKey] === "open";
  const hasCompleteSelection = selectedIds.size === rosterSize;

  function toggleRider(riderId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(riderId)) {
        next.delete(riderId);
      } else if (next.size < rosterSize) {
        next.add(riderId);
      }
      return next;
    });
  }

  return (
    <div className="mt-8 space-y-7">
      {successMessage ? (
        <MessageBanner tone="success" message={successMessage} />
      ) : null}
      {errorMessage ? <MessageBanner tone="error" message={errorMessage} /> : null}

      <section aria-labelledby="gala-race-choice">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
              Étape 1
            </p>
            <h2 id="gala-race-choice" className="mt-1 text-2xl font-black">
              Choisissez votre course
            </h2>
          </div>
          <p className="text-sm font-bold text-[#668078]">Une seule course par équipe</p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {PCM_GALA_RACES.map((race) => {
            const status = eventStatuses[race.key];
            const selected = race.key === activeRaceKey;
            const disabled = status !== "open";

            return (
              <button
                key={race.key}
                type="button"
                disabled={disabled}
                onClick={() => setActiveRaceKey(race.key)}
                aria-pressed={selected}
                className={`group overflow-hidden rounded-[22px] border-2 bg-white p-4 text-left shadow-sm transition ${
                  selected
                    ? "border-[#176951] shadow-[0_14px_35px_rgba(23,105,81,0.14)]"
                    : "border-[#CFE1DC] hover:-translate-y-0.5 hover:border-[#7FB7A7]"
                } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white"
                      style={{ backgroundColor: race.accentColor }}
                    >
                      {race.profileLabel}
                    </span>
                    <h3 className="mt-2 text-xl font-black text-[#0B302B]">
                      {race.name}
                    </h3>
                  </div>
                  <span
                    aria-hidden="true"
                    className={`mt-1 grid h-6 w-6 place-items-center rounded-full border-2 ${
                      selected
                        ? "border-[#176951] bg-[#176951] text-white"
                        : "border-[#B9CFC8] text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </div>

                <div className="mt-3 rounded-2xl bg-[#F3F8F6] px-2 py-3">
                  <RaceStageProfile segments={race.segments} compact />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs font-black text-[#557068]">
                  <span>{race.distanceKm} km</span>
                  <span>Profil PCM26 adapté</span>
                </div>
                <p className="mt-3 text-sm font-medium leading-5 text-[#60776F]">
                  {race.shortDescription}
                </p>
                <p className="mt-3 text-[11px] font-bold text-[#83978F]">
                  Base PCM26 : {race.pcmSource.raceName}
                </p>
                {disabled ? (
                  <p className="mt-3 text-xs font-black text-[#9B554C]">
                    Inscriptions closes
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="gala-roster-choice"
        className="rounded-[26px] border border-[#CFE1DC] bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
              Étape 2 · {activeRace.name}
            </p>
            <h2 id="gala-roster-choice" className="mt-1 text-2xl font-black">
              Composez votre sélection
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#60776F]">
              Les coureurs sont classés par note {ratingLabels[activeRace.primaryRating]}.
              Seules leurs notes natives sont utilisées pour préparer la startlist PCM26.
            </p>
          </div>
          <div
            className={`rounded-2xl px-4 py-3 text-center ${
              hasCompleteSelection
                ? "bg-[#DDF3EA] text-[#176951]"
                : "bg-[#FFF4D7] text-[#8A6418]"
            }`}
          >
            <strong className="block text-2xl font-black">
              {selectedIds.size}/{rosterSize}
            </strong>
            <span className="text-[10px] font-black uppercase tracking-[0.12em]">
              coureurs
            </span>
          </div>
        </div>

        <form action={savePcmGalaRegistrationAction} className="mt-5">
          <input type="hidden" name="eventKey" value={activeRaceKey} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sortedRiders.map((rider) => {
              const selected = selectedIds.has(rider.riderId);
              const selectionFull = selectedIds.size >= rosterSize && !selected;

              return (
                <label
                  key={rider.riderId}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                    selected
                      ? "border-[#278B70] bg-[#ECF8F4] shadow-sm"
                      : "border-[#D8E5E1] bg-white hover:border-[#A6C8BE]"
                  } ${selectionFull ? "opacity-55" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    name="riderIds"
                    value={rider.riderId}
                    checked={selected}
                    disabled={selectionFull}
                    onChange={() => toggleRider(rider.riderId)}
                    className="h-4 w-4 shrink-0 accent-[#176951]"
                  />
                  <RiderAvatar
                    riderId={rider.riderId}
                    profileKey={rider.avatarProfileKey}
                    seed={rider.avatarSeed}
                    age={rider.age}
                    jersey={jersey}
                    label={`Portrait de ${rider.firstName} ${rider.lastName}`}
                    className="h-12 w-12 shrink-0"
                    renderMode="compact"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#153A34]">
                      {rider.firstName} {rider.lastName}
                    </p>
                    <p className="mt-0.5 text-[11px] font-bold text-[#789088]">
                      {rider.countryCode.toUpperCase()} · {rider.age} ans
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <RatingPill
                        label={ratingLabels[activeRace.primaryRating]}
                        value={rider[activeRace.primaryRating]}
                        primary
                      />
                      <RatingPill label="END" value={rider.endurance} />
                      <RatingPill label="RES" value={rider.resistance} />
                      <RatingPill label="ACC" value={rider.acceleration} />
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {riders.length < rosterSize ? (
            <p className="mt-5 rounded-xl bg-[#FCE9E6] px-4 py-3 text-sm font-bold text-[#963F36]">
              Votre effectif actif ne compte pas assez de coureurs pour former une sélection de {rosterSize}.
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E0EBE7] pt-5">
            <p className="max-w-xl text-xs font-semibold leading-5 text-[#71877F]">
              Cette inscription est isolée du calendrier officiel : aucune forme,
              récompense, préparation, usure d’équipement ou donnée de classement ne sera modifiée.
            </p>
            <SubmitButton
              disabled={!isOpen || !hasCompleteSelection || riders.length < rosterSize}
              hasRegistration={Boolean(selectedEventKey)}
            />
          </div>
        </form>

        {selectedEventKey && eventStatuses[selectedEventKey] === "open" ? (
          <form action={withdrawPcmGalaRegistrationAction} className="mt-3 text-right">
            <WithdrawButton />
          </form>
        ) : null}
      </section>
    </div>
  );
}
function sortRidersForRace(
  riders: readonly PcmGalaRider[],
  primaryRating: PcmGalaRatingKey,
) {
  return [...riders].sort(
    (left, right) =>
      right[primaryRating] - left[primaryRating] ||
      right.endurance - left.endurance ||
      left.lastName.localeCompare(right.lastName, "fr"),
  );
}

function RatingPill({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: number;
  primary?: boolean;
}) {
  return (
    <span
      className={`rounded-md px-1.5 py-1 text-[10px] font-black ${
        primary
          ? "bg-[#176951] text-white"
          : "bg-[#EAF2EF] text-[#47665D]"
      }`}
    >
      {label} {value}
    </span>
  );
}

function SubmitButton({
  disabled,
  hasRegistration,
}: {
  disabled: boolean;
  hasRegistration: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#105744] disabled:cursor-not-allowed disabled:bg-[#A9BDB7]"
    >
      {pending
        ? "Enregistrement…"
        : hasRegistration
          ? "Mettre à jour l’inscription"
          : "Valider l’inscription gala"}
    </button>
  );
}

function WithdrawButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs font-black text-[#8D544B] underline decoration-[#D3A9A2] underline-offset-4 hover:text-[#6F352D] disabled:opacity-50"
    >
      {pending ? "Retrait…" : "Retirer mon inscription"}
    </button>
  );
}

function MessageBanner({
  tone,
  message,
}: {
  tone: "success" | "error";
  message: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
        tone === "success"
          ? "border-[#B6DDCF] bg-[#E8F7F1] text-[#176951]"
          : "border-[#E8C1BA] bg-[#FCEDEA] text-[#8D3F35]"
      }`}
    >
      {message}
    </div>
  );
}
