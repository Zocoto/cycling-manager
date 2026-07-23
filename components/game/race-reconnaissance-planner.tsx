"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { bookRaceReconnaissanceAction } from "@/app/jeu/entrainement/actions";
import { RiderAvatar } from "@/components/game/rider-avatar";
import type { RaceProfileType } from "@/lib/game/race-calendar";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";
import type {
  RaceReconnaissanceStage,
  TeamRaceReconnaissanceOverview,
} from "@/services/team-race-reconnaissance";

const PROFILE_LABELS: Record<RaceProfileType, string> = {
  flat: "Plat",
  sprint: "Sprint",
  hilly: "Vallons",
  mountain: "Montagne",
  cobbles: "Pavés",
  time_trial: "Chrono",
  mixed: "Mixte",
};

const CATEGORY_COLORS = {
  elite: "border-[#3157C8] bg-[#E8EDFF] text-[#233F9C]",
  world: "border-[#B8543E] bg-[#FCEAE5] text-[#8C3E2E]",
  continental: "border-[#36855A] bg-[#E6F4EB] text-[#246744]",
  national: "border-[#D1A41A] bg-[#FFF5C9] text-[#735A08]",
} as const;

export function RaceReconnaissancePlanner({
  overview,
  jersey,
}: {
  overview: TeamRaceReconnaissanceOverview;
  jersey: RiderJerseyAppearance;
}) {
  const [selectedRiderIds, setSelectedRiderIds] = useState<string[]>([]);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [preparerContractId, setPreparerContractId] = useState("");
  const selectedStage = overview.stages.find(
    (stage) => stage.id === selectedStageId,
  );
  const selectedPreparer = overview.preparers.find(
    (preparer) => preparer.contractId === preparerContractId,
  );
  const resultingBonus = selectedPreparer?.resultingBonus ?? 2;
  const canAfford =
    !selectedStage || overview.balance >= selectedStage.cost;
  const canSubmit =
    selectedRiderIds.length > 0 && Boolean(selectedStage) && canAfford;
  const stagesByDay = useMemo(() => {
    const grouped = new Map<number, RaceReconnaissanceStage[]>();
    for (const stage of overview.stages) {
      const stages = grouped.get(stage.dayNumber) ?? [];
      stages.push(stage);
      grouped.set(stage.dayNumber, stages);
    }
    return grouped;
  }, [overview.stages]);

  function toggleRider(riderId: string, checked: boolean) {
    setSelectedRiderIds((current) =>
      checked
        ? [...new Set([...current, riderId])]
        : current.filter((id) => id !== riderId),
    );
  }

  return (
    <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_18px_55px_rgba(19,60,46,0.09)]">
      <header className="bg-[#0B302B] px-6 py-6 text-white sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
              Nouvelle rubrique · Entraînement
            </p>
            <h2 className="mt-2 text-3xl font-black">
              Stage de reconnaissance
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
              Deux jours pour étudier une étape ou une classique. Les coureurs
              sont indisponibles de J{overview.startDayNumber} à J
              {overview.endDayNumber}, ne s’entraînent pas et ne récupèrent pas
              les +2 points de forme quotidiens.
            </p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/8 px-5 py-4 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9BE0BC]">
              Trésorerie
            </p>
            <p className="mt-1 text-xl font-black">
              {formatMoney(overview.balance, overview.currency)}
            </p>
          </div>
        </div>
      </header>

      <form action={bookRaceReconnaissanceAction}>
        <div className="grid gap-0 xl:grid-cols-[minmax(420px,0.82fr)_minmax(0,1.18fr)]">
          <div className="border-b border-[#315B3E]/10 p-5 sm:p-7 xl:border-b-0 xl:border-r">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
                  1 · Délégation
                </p>
                <h3 className="mt-1 text-xl font-black text-[#183F37]">
                  Coureurs et préparateur
                </h3>
              </div>
              <span className="rounded-full bg-[#FFF2C7] px-3 py-1.5 text-xs font-black text-[#725407]">
                {selectedRiderIds.length} sélectionné
                {selectedRiderIds.length > 1 ? "s" : ""}
              </span>
            </div>

            <label className="mt-5 block">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#60756E]">
                Préparateur de parcours
              </span>
              <select
                name="preparerContractId"
                value={preparerContractId}
                onChange={(event) =>
                  setPreparerContractId(event.target.value)
                }
                className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/15 bg-white px-4 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/15"
              >
                <option value="">Sans préparateur · bonus +2,00</option>
                {overview.preparers.map((preparer) => (
                  <option
                    key={preparer.contractId}
                    value={preparer.contractId}
                  >
                    {preparer.firstName} {preparer.lastName} · N
                    {preparer.level} · +{preparer.efficiencyPercentage}% ·
                    bonus +{formatBonus(preparer.resultingBonus)}
                  </option>
                ))}
              </select>
            </label>
            {overview.preparers.length === 0 ? (
              <p className="mt-2 text-xs font-bold leading-5 text-[#7A5B09]">
                Aucun préparateur sous contrat. La reconnaissance reste
                possible avec son bonus de base.
              </p>
            ) : null}

            <div className="mt-5 max-h-[540px] space-y-2 overflow-y-auto pr-1">
              {overview.riders.map((rider) => {
                const checked = selectedRiderIds.includes(rider.id);
                return (
                  <label
                    key={rider.id}
                    className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                      rider.isAvailable
                        ? checked
                          ? "border-[#278B70] bg-[#E5F5EF]"
                          : "cursor-pointer border-[#315B3E]/12 bg-[#F9FBFA] hover:border-[#278B70]/45"
                        : "cursor-not-allowed border-[#315B3E]/8 bg-[#EEF2F0] opacity-60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="riderIds"
                      value={rider.id}
                      checked={checked}
                      disabled={!rider.isAvailable}
                      onChange={(event) =>
                        toggleRider(rider.id, event.target.checked)
                      }
                      className="h-5 w-5 shrink-0 accent-[#176951]"
                    />
                    <RiderAvatar
                      profileKey={rider.avatarProfileKey}
                      seed={rider.avatarSeed}
                      riderId={rider.id}
                      jersey={jersey}
                      label={`Portrait de ${rider.firstName} ${rider.lastName}`}
                      className="h-11 w-11"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-[#183F37]">
                        {rider.firstName} {rider.lastName}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-bold text-[#60756E]">
                        <span
                          className={`fi fi-${rider.countryCode.toLowerCase()} mr-1.5 rounded-sm`}
                          aria-hidden="true"
                        />
                        {rider.countryName} · Forme {rider.form}%
                      </span>
                      {rider.unavailableReason ? (
                        <span className="mt-1 block text-[10px] font-black text-[#9A4940]">
                          {rider.unavailableReason}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 p-5 sm:p-7">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
                2 · Objectif
              </p>
              <h3 className="mt-1 text-xl font-black text-[#183F37]">
                Étape ou classique à reconnaître
              </h3>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
                Une étape d’un tour coûte moins cher qu’une classique de même
                catégorie. Le prix est fixe pour le groupe sélectionné.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {Array.from({ length: 28 }, (_, index) => index + 1).map(
                (dayNumber) => {
                  const dayStages = stagesByDay.get(dayNumber) ?? [];
                  const isMissionDay =
                    dayNumber >= overview.startDayNumber &&
                    dayNumber <= overview.endDayNumber;
                  return (
                    <div
                      key={dayNumber}
                      className={`min-h-24 rounded-xl border p-2 ${
                        isMissionDay
                          ? "border-[#F2C94C]/50 bg-[#FFF9DC]"
                          : "border-[#315B3E]/10 bg-[#F8FAF9]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-black text-[#60756E]">
                          J{dayNumber}
                        </span>
                        {isMissionDay ? (
                          <span className="text-[8px] font-black uppercase text-[#8A6714]">
                            stage
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {dayStages.map((stage) => (
                          <label
                            key={stage.id}
                            title={`${stage.raceName} · ${stage.stageName}`}
                            className={`block cursor-pointer rounded-lg border px-2 py-2 text-[9px] font-black leading-3 transition ${
                              selectedStageId === stage.id
                                ? "ring-2 ring-[#071A17] ring-offset-1"
                                : "hover:-translate-y-px"
                            } ${CATEGORY_COLORS[stage.categoryCode]}`}
                          >
                            <input
                              type="radio"
                              name="stageId"
                              value={stage.id}
                              checked={selectedStageId === stage.id}
                              onChange={() => setSelectedStageId(stage.id)}
                              className="sr-only"
                            />
                            <span className="line-clamp-2">
                              {stage.raceName}
                            </span>
                            {stage.raceFormat === "stage_race" ? (
                              <span className="mt-1 block opacity-75">
                                Ét. {stage.stageNumber}
                              </span>
                            ) : null}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                },
              )}
            </div>

            {overview.stages.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-dashed border-[#315B3E]/20 bg-[#F7FAF8] px-5 py-5 text-sm font-semibold text-[#60756E]">
                Aucune course suffisamment éloignée n’est encore disponible
                pour une reconnaissance de deux jours.
              </p>
            ) : null}
          </div>
        </div>

        <footer className="grid gap-4 border-t border-[#315B3E]/10 bg-[#F4F8F6] px-5 py-5 sm:px-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            {selectedStage ? (
              <>
                <p className="font-black text-[#183F37]">
                  {selectedStage.raceName}
                  {selectedStage.raceFormat === "stage_race"
                    ? ` · étape ${selectedStage.stageNumber}`
                    : ""}
                  {" · "}J{selectedStage.dayNumber}
                </p>
                <p className="mt-1 text-xs font-bold text-[#60756E]">
                  {PROFILE_LABELS[selectedStage.profileType]} ·{" "}
                  {selectedStage.distanceKm.toLocaleString("fr-FR", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  km · bonus +{formatBonus(resultingBonus)} sur les 13
                  statistiques · coût{" "}
                  {formatMoney(selectedStage.cost, overview.currency)}
                </p>
                {!canAfford ? (
                  <p className="mt-1 text-xs font-black text-[#A13F37]">
                    Trésorerie insuffisante.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm font-bold text-[#60756E]">
                Sélectionnez les coureurs, puis une course dans le calendrier.
              </p>
            )}
          </div>
          <ReconnaissanceSubmitButton disabled={!canSubmit} />
        </footer>
      </form>

      {overview.missions.length > 0 ? (
        <div className="border-t border-[#315B3E]/10 px-5 py-6 sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
            Reconnaissances programmées et terminées
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {overview.missions.map((mission) => (
              <article
                key={mission.id}
                className="rounded-2xl border border-[#315B3E]/12 bg-[#F9FBFA] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-[#183F37]">
                      {mission.raceName} · {mission.stageName}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#60756E]">
                      J{mission.startDayNumber}–J{mission.endDayNumber} · course
                      J{mission.targetDayNumber} · bonus +
                      {formatBonus(mission.bonusPoints)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#D7EEE8] px-3 py-1 text-[10px] font-black uppercase text-[#176951]">
                    {missionStatusLabel(mission.status)}
                  </span>
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-[#60756E]">
                  {mission.riderNames.join(", ") || "Participants enregistrés"}
                  {mission.preparerName
                    ? ` · ${mission.preparerName}`
                    : " · sans préparateur"}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReconnaissanceSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#F2C94C] px-6 text-xs font-black uppercase tracking-[0.12em] text-[#173B32] transition hover:bg-[#E4B82F] disabled:cursor-not-allowed disabled:bg-[#C8D3CF] disabled:text-[#6A7B75]"
    >
      {pending ? "Programmation…" : "Valider la reconnaissance"}
    </button>
  );
}

function formatBonus(value: number) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function missionStatusLabel(
  status: TeamRaceReconnaissanceOverview["missions"][number]["status"],
) {
  switch (status) {
    case "planned":
      return "Planifiée";
    case "active":
      return "En cours";
    case "completed":
      return "Terminée";
    case "cancelled":
      return "Annulée";
  }
}
