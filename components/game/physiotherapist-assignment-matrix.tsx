"use client";

import { useMemo, useState } from "react";

import { assignPhysiotherapistMatrixAction } from "@/app/jeu/centre-de-soin/actions";
import { HealthCenterSubmitButton } from "@/components/game/health-center-submit-button";
import { RiderAvatar } from "@/components/game/rider-avatar";
import Link from "@/components/ui/app-link";
import {
  countPhysiotherapistAssignments,
  serializePhysiotherapistAssignments,
  togglePhysiotherapistAssignment,
  type PhysiotherapistAssignment,
} from "@/lib/game/physiotherapist-matrix";
import {
  RIDER_PRIMARY_RATING_KEYS,
  RIDER_RATING_AXES,
} from "@/lib/game/rider-profile";
import { getPhysiotherapistRiderCapacity } from "@/lib/game/staff";
import type {
  TeamHealthRider,
  TeamMedicalStaffMember,
} from "@/services/team-health";

type PhysiotherapistAssignmentMatrixProps = {
  riders: TeamHealthRider[];
  physiotherapists: TeamMedicalStaffMember[];
  jersey: Parameters<typeof RiderAvatar>[0]["jersey"];
};

export function PhysiotherapistAssignmentMatrix({
  riders,
  physiotherapists,
  jersey,
}: PhysiotherapistAssignmentMatrixProps) {
  const initialAssignments = useMemo(
    () => createInitialAssignments(riders, physiotherapists),
    [riders, physiotherapists],
  );
  const [assignments, setAssignments] =
    useState<PhysiotherapistAssignment>(initialAssignments);
  const hasChanges = riders.some(
    (rider) =>
      (assignments[rider.id] ?? null) !==
      (initialAssignments[rider.id] ?? null),
  );

  return (
    <form action={assignPhysiotherapistMatrixAction} className="mt-5">
      <input
        type="hidden"
        name="assignments"
        value={JSON.stringify(serializePhysiotherapistAssignments(assignments))}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#8B6FB6]/20 bg-[#FAF7FD] px-4 py-3">
        <div>
          <p className="text-sm font-black text-[#3F285D]">
            Une case cochée = un coureur suivi par ce kiné
          </p>
          <p className="mt-1 text-xs font-semibold text-[#725F81]">
            Cocher une autre colonne déplace automatiquement le coureur. Les
            cases se bloquent lorsque le quota du kiné est atteint. Un malus
            conserve toujours au moins 1 point.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
            hasChanges
              ? "bg-[#F2C94C]/25 text-[#71580A]"
              : "bg-[#E5F4ED] text-[#176951]"
          }`}
        >
          {hasChanges ? "Modifications à enregistrer" : "Affectations à jour"}
        </span>
      </div>

      <div
        data-mobile-physiotherapist-assignments
        className="grid gap-3 lg:hidden"
      >
        {riders.map((rider) => {
          const assignedContractId = assignments[rider.id] ?? null;
          const assignedPhysio = physiotherapists.find(
            (physio) => physio.contractId === assignedContractId,
          );

          return (
            <article
              key={rider.id}
              className="min-w-0 rounded-2xl border border-[#315B3E]/12 bg-white p-4 shadow-[0_10px_28px_rgba(19,60,46,0.07)]"
            >
              <RiderSummary rider={rider} jersey={jersey} />

              <div className="mt-4 rounded-xl bg-[#F3F8F5] px-3 py-3">
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#60756E]">
                  Effet sur le coureur
                </p>
                <PhysiotherapistEffect physio={assignedPhysio ?? null} />
              </div>

              <fieldset className="mt-4">
                <legend className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#3F285D]">
                  Kiné
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {physiotherapists.map((physio) => {
                    const capacity = getPhysiotherapistRiderCapacity(
                      physio.level,
                    );
                    const assignedCount = countPhysiotherapistAssignments(
                      assignments,
                      physio.contractId,
                    );
                    const checked = assignedContractId === physio.contractId;
                    const capacityReached =
                      !checked && assignedCount >= capacity;

                    return (
                      <label
                        key={physio.contractId}
                        className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                          checked
                            ? "cursor-pointer border-[#7856A4] bg-[#EFE6F8] shadow-[0_0_0_3px_rgba(120,86,164,0.1)]"
                            : capacityReached
                              ? "cursor-not-allowed border-[#315B3E]/8 bg-[#EEF1EF] opacity-50"
                              : "cursor-pointer border-[#315B3E]/12 bg-white active:border-[#8B6FB6] active:bg-[#FAF7FD]"
                        }`}
                        title={
                          capacityReached
                            ? `Capacité atteinte : ${capacity} coureur(s)`
                            : `${checked ? "Retirer" : "Affecter"} ${rider.firstName} ${rider.lastName} ${checked ? "de" : "à"} ${physio.firstName} ${physio.lastName}`
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={capacityReached}
                          onChange={() =>
                            setAssignments((current) =>
                              togglePhysiotherapistAssignment({
                                assignments: current,
                                riderId: rider.id,
                                staffContractId: physio.contractId,
                                capacity,
                              }),
                            )
                          }
                          aria-label={`${checked ? "Retirer" : "Affecter"} ${rider.firstName} ${rider.lastName} ${checked ? "de" : "à"} ${physio.firstName} ${physio.lastName}`}
                          className="h-5 w-5 shrink-0 accent-[#7856A4]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-[#183F37]">
                            {physio.firstName} {physio.lastName}
                          </span>
                          <span className="mt-0.5 block text-[10px] font-bold text-[#725F81]">
                            Niveau {physio.level} · {assignedCount}/{capacity}{" "}
                            suivis
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto overscroll-x-contain rounded-[1.75rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_44px_rgba(19,60,46,0.08)] lg:block">
        <table className="w-full min-w-max border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-[#0B302B] text-white">
              <th
                scope="col"
                className="sticky left-0 z-20 min-w-[320px] border-b border-r border-white/10 bg-[#0B302B] px-4 py-4 sm:min-w-[430px] sm:px-5"
              >
                <span className="text-xs font-black uppercase tracking-[0.16em] text-[#9BE0BC]">
                  Coureurs · forme et statistiques
                </span>
              </th>
              {physiotherapists.map((physio) => {
                const capacity = getPhysiotherapistRiderCapacity(physio.level);
                const assignedCount = countPhysiotherapistAssignments(
                  assignments,
                  physio.contractId,
                );

                return (
                  <th
                    key={physio.contractId}
                    scope="col"
                    className="min-w-[150px] border-b border-r border-white/10 px-3 py-4 text-center sm:min-w-[178px] sm:px-4"
                  >
                    <span className="block text-sm font-black">
                      {physio.firstName} {physio.lastName}
                    </span>
                    <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.12em] text-[#BDA9D5]">
                      Kiné · N{physio.level}
                    </span>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${
                        assignedCount >= capacity
                          ? "bg-[#F2C94C] text-[#3D2D00]"
                          : "bg-white/10 text-white"
                      }`}
                    >
                      {assignedCount}/{capacity} suivis
                    </span>
                  </th>
                );
              })}
              <th
                scope="col"
                className="min-w-[220px] border-b border-white/10 bg-[#123E37] px-5 py-4"
              >
                <span className="text-xs font-black uppercase tracking-[0.16em] text-[#9BE0BC]">
                  Effet sur le coureur
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {riders.map((rider, riderIndex) => {
              const assignedContractId = assignments[rider.id] ?? null;
              const assignedPhysio = physiotherapists.find(
                (physio) => physio.contractId === assignedContractId,
              );

              return (
                <tr
                  key={rider.id}
                  className={riderIndex % 2 === 0 ? "bg-white" : "bg-[#F7FAF8]"}
                >
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 border-b border-r border-[#315B3E]/10 px-4 py-3 ${
                      riderIndex % 2 === 0 ? "bg-white" : "bg-[#F7FAF8]"
                    }`}
                  >
                    <RiderSummary rider={rider} jersey={jersey} />
                  </th>
                  {physiotherapists.map((physio) => {
                    const capacity = getPhysiotherapistRiderCapacity(
                      physio.level,
                    );
                    const checked = assignedContractId === physio.contractId;
                    const capacityReached =
                      !checked &&
                      countPhysiotherapistAssignments(
                        assignments,
                        physio.contractId,
                      ) >= capacity;

                    return (
                      <td
                        key={physio.contractId}
                        className="border-b border-r border-[#315B3E]/10 p-3 text-center"
                      >
                        <label
                          className={`mx-auto flex min-h-16 w-full max-w-[142px] items-center justify-center rounded-xl border transition ${
                            checked
                              ? "cursor-pointer border-[#7856A4] bg-[#EFE6F8] shadow-[0_0_0_3px_rgba(120,86,164,0.12)]"
                              : capacityReached
                                ? "cursor-not-allowed border-[#315B3E]/8 bg-[#EEF1EF] opacity-45"
                                : "cursor-pointer border-[#315B3E]/12 bg-white hover:border-[#8B6FB6]/55 hover:bg-[#FAF7FD]"
                          }`}
                          title={
                            capacityReached
                              ? `Capacité atteinte : ${capacity} coureur(s)`
                              : `${checked ? "Retirer" : "Affecter"} ${rider.firstName} ${rider.lastName} ${checked ? "de" : "à"} ${physio.firstName} ${physio.lastName}`
                          }
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={capacityReached}
                            onChange={() =>
                              setAssignments((current) =>
                                togglePhysiotherapistAssignment({
                                  assignments: current,
                                  riderId: rider.id,
                                  staffContractId: physio.contractId,
                                  capacity,
                                }),
                              )
                            }
                            aria-label={`${checked ? "Retirer" : "Affecter"} ${rider.firstName} ${rider.lastName} ${checked ? "de" : "à"} ${physio.firstName} ${physio.lastName}`}
                            className="h-6 w-6 accent-[#7856A4]"
                          />
                        </label>
                      </td>
                    );
                  })}
                  <td className="border-b border-[#315B3E]/10 bg-[#FBFDFB] px-5 py-3">
                    <PhysiotherapistEffect physio={assignedPhysio ?? null} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {hasChanges ? (
          <button
            type="button"
            onClick={() => setAssignments(initialAssignments)}
            className="min-h-11 rounded-xl border border-[#315B3E]/15 bg-white px-4 text-sm font-black text-[#48665F] hover:bg-[#F2F6F4]"
          >
            Annuler les modifications
          </button>
        ) : null}
        <div className="min-w-[240px]">
          <HealthCenterSubmitButton pendingLabel="Enregistrement…">
            Enregistrer toutes les affectations
          </HealthCenterSubmitButton>
        </div>
      </div>
    </form>
  );
}

function RiderSummary({
  rider,
  jersey,
}: {
  rider: TeamHealthRider;
  jersey: Parameters<typeof RiderAvatar>[0]["jersey"];
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 text-left">
      <RiderAvatar
        profileKey={rider.avatarProfileKey}
        seed={rider.avatarSeed}
        riderId={rider.id}
        age={rider.age}
        jersey={jersey}
        label={`Portrait de ${rider.firstName} ${rider.lastName}`}
        className="h-12 w-12 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/jeu/coureurs/${rider.id}`}
            target="_blank"
            className="truncate text-sm font-black text-[#183F37] hover:text-[#176951]"
          >
            {rider.firstName} {rider.lastName} ↗
          </Link>
          <span
            className={`fi fi-${rider.countryCode.toLowerCase()} h-3.5 w-5 rounded-sm shadow-sm`}
            aria-label={rider.countryName}
          />
          <span className="text-[10px] font-bold text-[#60756E]">
            {rider.age} ans · MOY {rider.averageRating}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${getFormClasses(rider.form)}`}
          >
            Forme {rider.form}/100
          </span>
          {rider.injury ? (
            <span className="rounded-full bg-[#FFF0EE] px-2 py-0.5 text-[9px] font-black text-[#B54242]">
              Blessé
            </span>
          ) : rider.formCamp ? (
            <span className="rounded-full bg-[#FFF6D8] px-2 py-0.5 text-[9px] font-black text-[#755A0B]">
              En stage
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {RIDER_PRIMARY_RATING_KEYS.map((key) => {
            const axis = RIDER_RATING_AXES.find((candidate) => candidate.key === key)!;
            return (
              <span
                key={key}
                title={axis.label}
                className="rounded-md border border-[#315B3E]/10 bg-[#EEF4F1] px-1.5 py-0.5 text-[9px] font-black text-[#48665F]"
              >
                {axis.shortLabel} {rider.ratings[key]}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PhysiotherapistEffect({
  physio,
}: {
  physio: TeamMedicalStaffMember | null;
}) {
  if (!physio) {
    return (
      <div>
        <p className="text-sm font-black text-[#7A8883]">Non protégé</p>
        <p className="mt-1 text-[10px] font-semibold text-[#88958F]">
          Aucun point de forme économisé
        </p>
      </div>
    );
  }

  const hasRaceRecovery = physio.talents.some(
    (talent) => talent.code === "physio_race_recovery",
  );
  const hasTrainingRecovery = physio.talents.some(
    (talent) => talent.code === "physio_training_recovery",
  );

  return (
    <div>
      <p className="text-sm font-black text-[#176951]">
        Forme économisée : jusqu’à {physio.level} pt
      </p>
      <p className="mt-0.5 text-[10px] font-bold text-[#48665F]">
        Par effort ou jour de blessure
      </p>
      {hasRaceRecovery || hasTrainingRecovery ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {hasRaceRecovery ? (
            <span className="rounded-full bg-[#E8F0FF] px-2 py-0.5 text-[9px] font-black text-[#315A8A]">
              +1 après course
            </span>
          ) : null}
          {hasTrainingRecovery ? (
            <span className="rounded-full bg-[#E8F0FF] px-2 py-0.5 text-[9px] font-black text-[#315A8A]">
              +1 après entraînement
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function createInitialAssignments(
  riders: TeamHealthRider[],
  physiotherapists: TeamMedicalStaffMember[],
): PhysiotherapistAssignment {
  return Object.fromEntries(
    riders.map((rider) => [
      rider.id,
      physiotherapists.find((physio) =>
        physio.assignedRiderIds.includes(rider.id),
      )?.contractId ?? null,
    ]),
  );
}

function getFormClasses(form: number) {
  if (form >= 85) return "bg-[#DDF3E7] text-[#176951]";
  if (form >= 65) return "bg-[#FFF6D8] text-[#755A0B]";
  return "bg-[#FFF0EE] text-[#B54242]";
}
