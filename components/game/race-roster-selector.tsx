"use client";

import Link from "@/components/ui/app-link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { RiderAvatar } from "@/components/game/rider-avatar";
import { RaceRoleGuide } from "@/components/game/race-role-guide";
import {
  RIDER_CLIMATE_LABELS,
  RiderClimateIcon,
} from "@/components/game/rider-climate-profile-card";
import { isRosterSelectionValid } from "@/lib/game/race-calendar";
import type { RiderClimateProfile } from "@/lib/game/race-weather";
import {
  isRaceProtectedRiderRole,
  isRaceSprinterRole,
  RACE_ROLES,
  RACE_ROLE_LABELS,
  type RaceRole,
} from "@/lib/game/race-simulation";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";
import type { RaceRosterOption } from "@/services/race-calendar";

type RaceRosterSelectorProps = {
  riders: RaceRosterOption[];
  minimum: number;
  maximum: number;
  jersey: RiderJerseyAppearance;
  isStageRace: boolean;
  lockInitiallySelected?: boolean;
  submitLabel?: string;
  showRoleGuide?: boolean;
  tutorialIds?: {
    selection?: string;
    roleGuide?: string;
    roleAssignment?: string;
    submit?: string;
  };
};

export type RaceRosterSortKey =
  | "roster"
  | "form"
  | "mountain"
  | "hills"
  | "flat"
  | "timeTrial"
  | "cobbles"
  | "sprint"
  | "breakaway";

export type RaceRosterSortDirection = "descending" | "ascending";

const RACE_ROSTER_SORT_OPTIONS: ReadonlyArray<{
  value: RaceRosterSortKey;
  label: string;
}> = [
  { value: "roster", label: "Ordre de l’effectif" },
  { value: "form", label: "Forme" },
  { value: "mountain", label: "Montagne (MON)" },
  { value: "hills", label: "Vallons (VAL)" },
  { value: "flat", label: "Plaine (PLA)" },
  { value: "timeTrial", label: "Contre-la-montre (CLM)" },
  { value: "cobbles", label: "Pavés (PAV)" },
  { value: "sprint", label: "Sprint (SPR)" },
  { value: "breakaway", label: "Baroudeur (BAR)" },
];

const RACE_ROSTER_SORT_ACCESSORS: Record<
  Exclude<RaceRosterSortKey, "roster">,
  (rider: RaceRosterOption) => number
> = {
  form: (rider) => rider.form,
  mountain: (rider) => rider.mountain,
  hills: (rider) => rider.hills,
  flat: (rider) => rider.flat,
  timeTrial: (rider) => rider.timeTrial,
  cobbles: (rider) => rider.cobbles,
  sprint: (rider) => rider.sprint,
  breakaway: (rider) => rider.breakaway,
};

export function sortAndFilterRaceRosterOptions({
  riders,
  sortKey,
  sortDirection,
  hideConflicting,
  selectedRiderIds = new Set<string>(),
}: {
  riders: readonly RaceRosterOption[];
  sortKey: RaceRosterSortKey;
  sortDirection: RaceRosterSortDirection;
  hideConflicting: boolean;
  selectedRiderIds?: ReadonlySet<string>;
}): RaceRosterOption[] {
  const visibleRiders = riders
    .map((rider, originalIndex) => ({ rider, originalIndex }))
    .filter(
      ({ rider }) =>
        !hideConflicting ||
        !rider.conflict ||
        selectedRiderIds.has(rider.riderId),
    );

  if (sortKey === "roster") {
    return visibleRiders.map(({ rider }) => rider);
  }

  const getSortValue = RACE_ROSTER_SORT_ACCESSORS[sortKey];
  const directionMultiplier = sortDirection === "descending" ? -1 : 1;

  return visibleRiders
    .sort((left, right) => {
      const ratingDifference =
        (getSortValue(left.rider) - getSortValue(right.rider)) *
        directionMultiplier;

      return ratingDifference || left.originalIndex - right.originalIndex;
    })
    .map(({ rider }) => rider);
}

export function RaceRosterSelector({
  riders,
  minimum,
  maximum,
  jersey,
  isStageRace,
  lockInitiallySelected = false,
  submitLabel,
  showRoleGuide = false,
  tutorialIds,
}: RaceRosterSelectorProps) {
  const initiallySelectedIds = useMemo(
    () => riders.filter((rider) => rider.isSelected).map((rider) => rider.riderId),
    [riders]
  );
  const initiallySelectedSet = useMemo(
    () => new Set(initiallySelectedIds),
    [initiallySelectedIds]
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(initiallySelectedIds);
  const [roles, setRoles] = useState<Record<string, RaceRole>>({});
  const [sortKey, setSortKey] = useState<RaceRosterSortKey>("roster");
  const [sortDirection, setSortDirection] =
    useState<RaceRosterSortDirection>("descending");
  const [hideConflicting, setHideConflicting] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const conflictingRiderCount = useMemo(
    () =>
      riders.filter(
        (rider) => rider.conflict && !selectedSet.has(rider.riderId),
      ).length,
    [riders, selectedSet],
  );
  const visibleRiders = useMemo(
    () =>
      sortAndFilterRaceRosterOptions({
        riders,
        sortKey,
        sortDirection,
        hideConflicting,
        selectedRiderIds: selectedSet,
      }),
    [hideConflicting, riders, selectedSet, sortDirection, sortKey],
  );
  const rosterSizeIsValid = isRosterSelectionValid({
    selectedCount: selectedIds.length,
    minimum,
    maximum,
  });
  const uniqueRolesAreValid =
    selectedIds.filter(
      (riderId) => (roles[riderId] ?? "auto") === "leader",
    ).length <= 1 &&
    selectedIds.filter((riderId) =>
      isRaceProtectedRiderRole(roles[riderId] ?? "auto"),
    ).length <= 1 &&
    selectedIds.filter((riderId) =>
      isRaceSprinterRole(roles[riderId] ?? "auto"),
    ).length <= 1;
  const selectionIsValid = rosterSizeIsValid && uniqueRolesAreValid;

  function toggleRider(riderId: string) {
    if (lockInitiallySelected && initiallySelectedSet.has(riderId)) return;
    setSelectedIds((current) =>
      current.includes(riderId)
        ? current.filter((id) => id !== riderId)
        : current.length < maximum
          ? [...current, riderId]
          : current
    );
  }

  return (
    <div
      className="mt-5"
      data-tutorial-id={tutorialIds?.selection}
    >
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

      <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-black/15 p-2.5">
        <label
          htmlFor="race-roster-sort"
          className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3"
        >
          <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-[#9FB5A8]">
            Trier par
          </span>
          <select
            id="race-roster-sort"
            value={sortKey}
            onChange={(event) =>
              setSortKey(event.target.value as RaceRosterSortKey)
            }
            className="min-w-0 flex-1 bg-transparent py-2 text-xs font-bold text-white outline-none"
          >
            {RACE_ROSTER_SORT_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-[#102A25] text-white"
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={sortKey === "roster"}
          onClick={() =>
            setSortDirection((current) =>
              current === "descending" ? "ascending" : "descending",
            )
          }
          aria-label={
            sortDirection === "descending"
              ? "Afficher les notes les plus faibles d’abord"
              : "Afficher les meilleures notes d’abord"
          }
          className="min-h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-[11px] font-black text-[#D6DFD2] transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sortDirection === "descending"
            ? "↓ Meilleurs d’abord"
            : "↑ Plus faibles d’abord"}
        </button>

        <label
          className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 text-[11px] font-bold transition ${
            conflictingRiderCount > 0
              ? "cursor-pointer border-amber-200/20 bg-amber-200/5 text-amber-100 hover:border-amber-200/35"
              : "cursor-not-allowed border-white/5 bg-white/[0.03] text-[#71897C]"
          }`}
        >
          <input
            type="checkbox"
            checked={hideConflicting}
            disabled={conflictingRiderCount === 0}
            onChange={(event) => setHideConflicting(event.target.checked)}
            className="h-4 w-4 shrink-0 accent-amber-300"
          />
          <span>
            Masquer les coureurs déjà engagés
            {conflictingRiderCount > 0 ? ` (${conflictingRiderCount})` : ""}
          </span>
        </label>
      </div>

      <div
        data-tutorial-id={tutorialIds?.roleAssignment}
      >
        <div
          id="race-roster-list"
          className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1"
        >
          {visibleRiders.map((rider) => {
          const isSelected = selectedSet.has(rider.riderId);
          const isLockedSelection =
            lockInitiallySelected && initiallySelectedSet.has(rider.riderId);
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
                    <span className="flex flex-wrap items-center gap-2 text-sm font-black text-white">
                      <span
                        className={`fi fi-${rider.countryCode.toLowerCase()} shrink-0 rounded`}
                        role="img"
                        aria-label={`Drapeau ${rider.countryName}`}
                      />
                      <span>
                        {rider.firstName} {rider.lastName}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${getRosterFormClasses(rider.form)}`}
                      >
                        Forme {formatRosterForm(rider.form)}/100
                      </span>
                      <RiderWeatherAffinities profile={rider.climateProfile} />
                    </span>
                    <span className="mt-1 block text-[11px] font-semibold text-[#9FB5A8]">
                      {rider.age} ans · MON {rider.mountain} · VAL {rider.hills} · PLA {rider.flat} · CLM {rider.timeTrial} · PAV {rider.cobbles} · SPR {rider.sprint} · BAR {rider.breakaway}
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

              {!rider.conflict && rider.unavailability ? (
                <div
                  className={`ml-7 mt-2 flex items-center gap-2 text-[11px] font-bold leading-4 ${
                    rider.unavailability.type === "injury"
                      ? "text-[#FF9EA6]"
                      : "text-amber-200"
                  }`}
                >
                  <MedicalCrossIcon />
                  <span>
                    {rider.unavailability.label}
                    {rider.unavailability.until
                      ? ` · jusqu’au ${formatAvailabilityDate(
                          rider.unavailability.until
                        )}`
                      : ""}
                  </span>
                </div>
              ) : null}

              {isSelected ? (
                <div className="ml-7 mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
                  {isLockedSelection ? (
                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#BFD1C6]">
                      Rôle de course conservé
                    </span>
                  ) : (
                    <>
                      <label
                        htmlFor={`role-${rider.riderId}`}
                        className="text-[10px] font-black uppercase tracking-widest text-[#9FB5A8]"
                      >
                        Rôle en course
                      </label>
                      <select
                        id={`role-${rider.riderId}`}
                        name="riderRoles"
                        value={`${rider.riderId}:${roles[rider.riderId] ?? "auto"}`}
                        onChange={(event) => {
                          const nextRole = event.target.value.split(":").at(-1) as RaceRole;
                          setRoles((current) => ({ ...current, [rider.riderId]: nextRole }));
                        }}
                        className="min-h-9 flex-1 rounded-lg border border-white/15 bg-[#102A25] px-3 text-xs font-bold text-white outline-none focus:border-emerald-300"
                      >
                        {RACE_ROLES.filter(
                          (role) => isStageRace || role !== "mountain_classification"
                        ).map((role) => {
                          const isTakenByAnother = selectedIds.some(
                            (selectedId) => {
                              if (selectedId === rider.riderId) return false;
                              const selectedRole = roles[selectedId] ?? "auto";
                              if (role === "leader") {
                                return selectedRole === "leader";
                              }
                              if (role === "protected_rider") {
                                return selectedRole === "protected_rider";
                              }
                              return (
                                isRaceSprinterRole(role) &&
                                isRaceSprinterRole(selectedRole)
                              );
                            },
                          );

                          return (
                            <option key={role} value={`${rider.riderId}:${role}`} disabled={isTakenByAnother}>
                              {RACE_ROLE_LABELS[role]}
                            </option>
                          );
                        })}
                      </select>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          );
          })}

          {visibleRiders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center">
              <p className="text-xs font-bold text-[#BFD1C6]">
                Tous les coureurs sont déjà engagés sur une autre course.
              </p>
              <button
                type="button"
                onClick={() => setHideConflicting(false)}
                className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-black text-white transition hover:bg-white/10"
              >
                Réafficher l’effectif
              </button>
            </div>
          ) : null}
        </div>

        <RaceRoleGuide tone="dark" />
      </div>

      {showRoleGuide ? (
        <CriteriumRoleGuide tutorialId={tutorialIds?.roleGuide} />
      ) : null}

      <div
        data-tutorial-id={tutorialIds?.submit}
      >
        <SubmitRosterButton
          disabled={!selectionIsValid}
          count={selectedIds.length}
          label={submitLabel}
        />
      </div>
      <p className="mt-3 text-center text-[11px] font-semibold leading-5 text-[#9FB5A8]">
        {lockInitiallySelected
          ? "Les coureurs toujours engagés restent verrouillés ; seuls les renforts nécessaires sont ajoutés."
          : "Après validation, la composition ne pourra plus être modifiée directement."}
      </p>
    </div>
  );
}

function RiderWeatherAffinities({
  profile,
}: {
  profile: RiderClimateProfile;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-black">
      <span
        title={`Condition favorite : ${RIDER_CLIMATE_LABELS[profile.strength]} (+1,5)`}
        aria-label={`Condition météo favorite : ${RIDER_CLIMATE_LABELS[profile.strength]}, bonus de 1,5 point`}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-1.5 py-0.5 text-[#9BE0BC]"
      >
        <RiderClimateIcon
          preference={profile.strength}
          className="h-3 w-3"
        />
        <span>+ {RIDER_CLIMATE_LABELS[profile.strength]}</span>
      </span>
      <span
        title={`Condition difficile : ${RIDER_CLIMATE_LABELS[profile.weakness]} (−1,25)`}
        aria-label={`Condition météo difficile : ${RIDER_CLIMATE_LABELS[profile.weakness]}, malus de 1,25 point`}
        className="inline-flex items-center gap-1 rounded-full border border-rose-300/30 bg-rose-300/10 px-1.5 py-0.5 text-[#FFB5BB]"
      >
        <RiderClimateIcon
          preference={profile.weakness}
          className="h-3 w-3"
        />
        <span>− {RIDER_CLIMATE_LABELS[profile.weakness]}</span>
      </span>
    </span>
  );
}

function CriteriumRoleGuide({
  tutorialId,
}: {
  tutorialId?: string;
}) {
  const roles = [
    {
      label: "Automatique",
      detail:
        "Analyse le profil et les notes pour distribuer les rôles encore vacants, puis affecte les autres coureurs comme équipiers.",
    },
    {
      label: "Leader",
      detail:
        "Est protégé par les équipiers et économise son énergie, sans avantage particulier au sprint.",
    },
    {
      label: "Sprinteur",
      detail:
        "Pousse son équipe à contrôler et devient prioritaire pour le train et l’arrivée groupée, sans protection énergétique.",
    },
    {
      label: "Leader / sprinteur",
      detail:
        "Cumule la protection du leader et tous les avantages du sprinteur ; l’IA le choisit pour le meilleur sprinteur sur le plat.",
    },
    {
      label: "Coureur protégé",
      detail:
        "Préserve ses chances sans travailler pour le leader. Il reçoit un abri plus léger et peut jouer sa propre carte dans le final.",
    },
    {
      label: "Poisson pilote",
      detail:
        "Travaille dans le peloton et augmente la qualité du train qui lance le sprinteur.",
    },
    {
      label: "Électron libre",
      detail:
        "Reçoit une forte priorité pour intégrer l’échappée et courir de manière offensive.",
    },
    {
      label: "Équipier",
      detail:
        "Dépense davantage d’énergie dans la poursuite et le travail collectif avant le final.",
    },
  ] as const;

  return (
    <section
      data-tutorial-id={tutorialId}
      className="mt-4 rounded-xl border border-[#F2C94C]/30 bg-[#F2C94C]/10 p-4"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#F7DA73]">
        Décisions de l’IA
      </p>
      <div className="mt-3 grid gap-2">
        {roles.map((role) => (
          <p
            key={role.label}
            className="text-[11px] font-semibold leading-5 text-[#D6DFD2]"
          >
            <span className="font-black text-white">
              {role.label}
            </span>{" "}
            — {role.detail}
          </p>
        ))}
      </div>
    </section>
  );
}

function MedicalCrossIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0"
      fill="currentColor"
    >
      <path d="M7.5 2.5h5v5h5v5h-5v5h-5v-5h-5v-5h5v-5Z" />
    </svg>
  );
}

function formatAvailabilityDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export function formatRosterForm(value: number) {
  return Math.max(0, Math.min(100, value)).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  });
}

export function getRosterFormClasses(form: number) {
  if (form >= 85) {
    return "border-emerald-300/35 bg-emerald-300/15 text-[#9BE0BC]";
  }

  if (form >= 65) {
    return "border-amber-200/35 bg-amber-200/15 text-amber-100";
  }

  return "border-rose-300/35 bg-rose-300/15 text-[#FFB5BB]";
}

function SubmitRosterButton({
  disabled,
  count,
  label,
}: {
  disabled: boolean;
  count: number;
  label?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#F2C94C] px-5 py-3 text-sm font-black text-[#17261E] transition hover:-translate-y-0.5 hover:bg-[#F7D96C] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
    >
      {pending
        ? "Validation en cours…"
        : `${label ?? "Valider l’inscription"} (${count})`}
    </button>
  );
}
