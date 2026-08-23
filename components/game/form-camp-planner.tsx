"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { bookFormCampsAction } from "@/app/jeu/centre-de-soin/actions";
import {
  FORM_CAMP_TYPES,
  getFormCampGainPerDay,
  type FormCampType,
} from "@/lib/game/health-center";
import {
  findFormCampPlanningConflict,
  getFormCampRangeDuration,
  isDayInFormCampRange,
  selectFormCampDayRange,
  type FormCampDayRange,
} from "@/lib/game/form-camp-planning";
import type {
  RiderPlanningEntry,
  RiderPlanningEvent,
  TeamRiderSeasonPlanning,
} from "@/lib/game/rider-season-planning";

type FormCampPlannerRider = {
  id: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  form: number;
};

const EVENT_LABELS: Record<RiderPlanningEvent["type"], string> = {
  race: "Course",
  form_camp: "Stage",
  reconnaissance: "Reconnaissance",
  injury: "Blessure",
};

export function FormCampPlanner({
  riders,
  planning,
  balance,
  currency,
  doctorBoostPct,
}: {
  riders: FormCampPlannerRider[];
  planning: TeamRiderSeasonPlanning;
  balance: number;
  currency: string;
  doctorBoostPct: number;
}) {
  const [campType, setCampType] = useState<FormCampType>("classic");
  const [range, setRange] = useState<FormCampDayRange | null>(null);
  const [selectedRiderIds, setSelectedRiderIds] = useState<string[]>([]);
  const planningByRiderId = useMemo(
    () => new Map(planning.riders.map((rider) => [rider.id, rider])),
    [planning.riders],
  );
  const visibleDays = useMemo(
    () =>
      planning.days.filter(
        (day) => day.dayNumber >= planning.currentDayNumber,
      ),
    [planning.currentDayNumber, planning.days],
  );
  const availabilityByRiderId = useMemo(() => {
    return new Map(
      riders.map((rider) => {
        const riderPlanning = planningByRiderId.get(rider.id);
        const conflict = riderPlanning
          ? findFormCampPlanningConflict(riderPlanning.events, range)
          : null;
        return [
          rider.id,
          {
            available: Boolean(range && riderPlanning && !conflict),
            conflict,
            missingPlanning: !riderPlanning,
          },
        ] as const;
      }),
    );
  }, [planningByRiderId, range, riders]);
  const availableRiders = riders.filter(
    (rider) => availabilityByRiderId.get(rider.id)?.available,
  );
  const durationDays = getFormCampRangeDuration(range);
  const camp = FORM_CAMP_TYPES[campType];
  const formGainPerDay = getFormCampGainPerDay({
    type: campType,
    doctorBoostPct,
  });
  const totalPrice =
    selectedRiderIds.length * durationDays * camp.pricePerDay;
  const totalGainPerRider = durationDays * formGainPerDay;
  const canAfford = totalPrice <= balance;
  const canSubmit =
    Boolean(range) && selectedRiderIds.length > 0 && canAfford;

  function chooseDay(dayNumber: number) {
    const nextRange = selectFormCampDayRange({
      currentRange: range,
      dayNumber,
      currentDayNumber: planning.currentDayNumber,
    });
    setRange(nextRange);
    setSelectedRiderIds((current) =>
      current.filter((riderId) => {
        const riderPlanning = planningByRiderId.get(riderId);
        return Boolean(
          riderPlanning &&
            !findFormCampPlanningConflict(riderPlanning.events, nextRange),
        );
      }),
    );
  }

  function toggleRider(riderId: string, checked: boolean) {
    if (!availabilityByRiderId.get(riderId)?.available) return;
    setSelectedRiderIds((current) =>
      checked
        ? [...new Set([...current, riderId])]
        : current.filter((id) => id !== riderId),
    );
  }

  function selectAllAvailable() {
    const availableIds = availableRiders.map((rider) => rider.id);
    const everyAvailableSelected = availableIds.every((id) =>
      selectedRiderIds.includes(id),
    );
    setSelectedRiderIds(everyAvailableSelected ? [] : availableIds);
  }

  return (
    <form action={bookFormCampsAction} className="pb-40 sm:pb-32">
      <input type="hidden" name="campType" value={campType} />
      <input
        type="hidden"
        name="startDayNumber"
        value={range?.startDay ?? ""}
      />
      <input
        type="hidden"
        name="endDayNumber"
        value={range?.endDay ?? ""}
      />

      <section className="mt-5 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_18px_55px_rgba(19,60,46,0.09)]">
        <header className="bg-[linear-gradient(135deg,#071A17,#0B302B_55%,#176951)] px-5 py-6 text-white sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
                Préparation groupée · {planning.seasonName}
              </p>
              <h3 className="mt-2 text-2xl font-black sm:text-3xl">
                Planifier une remise en forme
              </h3>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
                Choisissez le niveau de prise en charge, posez une plage de un à
                trois jours, puis retenez uniquement les coureurs réellement
                libres.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <HeaderMetric label="Trésorerie" value={formatMoney(balance, currency)} />
              <HeaderMetric
                label="Bonus médecins"
                value={doctorBoostPct > 0 ? `+${doctorBoostPct} %` : "Aucun"}
              />
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-7">
          <div>
            <StepHeading
              step="1"
              title="Niveau de prise en charge"
              detail="Le tarif reste journalier et s’applique à chaque coureur sélectionné."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(Object.keys(FORM_CAMP_TYPES) as FormCampType[]).map((type) => {
                const definition = FORM_CAMP_TYPES[type];
                const effectiveGain = getFormCampGainPerDay({
                  type,
                  doctorBoostPct,
                });
                const selected = type === campType;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCampType(type)}
                    className={`rounded-2xl border p-4 text-left transition sm:p-5 ${
                      selected
                        ? "border-[#176951] bg-[#E6F5EF] shadow-[0_10px_26px_rgba(23,105,81,0.12)] ring-2 ring-[#176951]/15"
                        : "border-[#315B3E]/12 bg-[#F8FAF9] hover:border-[#278B70]/45"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-base font-black text-[#183F37]">
                          {definition.label}
                        </span>
                        <span className="mt-1 block text-xs font-bold text-[#60756E]">
                          Base +{definition.formGainPerDay}/jour
                          {doctorBoostPct > 0
                            ? ` · gain réel +${effectiveGain}/jour`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#176951] shadow-sm">
                        {formatMoney(definition.pricePerDay, currency)}/j
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8">
            <StepHeading
              step="2"
              title="Plage dans le calendrier"
              detail="Premier clic : début. Second clic : fin, dans la limite de trois jours. Un nouveau clic recommence la sélection."
            />
            <div className="mt-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
              <div className="flex min-w-max gap-2">
                {visibleDays.map((day) => {
                  const isCurrent =
                    day.dayNumber === planning.currentDayNumber;
                  const isSelected = isDayInFormCampRange(
                    day.dayNumber,
                    range,
                  );
                  const isStart = day.dayNumber === range?.startDay;
                  const isEnd = day.dayNumber === range?.endDay;
                  return (
                    <button
                      key={day.id}
                      type="button"
                      disabled={isCurrent}
                      aria-pressed={isSelected}
                      onClick={() => chooseDay(day.dayNumber)}
                      className={`relative min-h-16 w-[4.1rem] shrink-0 rounded-xl border px-2 py-2 text-center transition ${
                        isSelected
                          ? "border-[#D6A93A] bg-[#FFF2B8] text-[#5F4900] shadow-sm"
                          : isCurrent
                            ? "cursor-not-allowed border-[#315B3E]/10 bg-[#EEF3F1] text-[#8A9993]"
                            : "border-[#315B3E]/12 bg-white text-[#183F37] hover:border-[#278B70] hover:bg-[#F0F8F5]"
                      }`}
                    >
                      <span className="block text-xs font-black">
                        J{day.dayNumber}
                      </span>
                      <span className="mt-1 block text-[9px] font-bold uppercase">
                        {formatShortDate(day.calendarDate)}
                      </span>
                      {isCurrent ? (
                        <span className="mt-1 block text-[8px] font-black uppercase">
                          Aujourd’hui
                        </span>
                      ) : isStart || isEnd ? (
                        <span className="mt-1 block text-[8px] font-black uppercase">
                          {isStart && isEnd
                            ? "1 jour"
                            : isStart
                              ? "Début"
                              : "Fin"}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <StepHeading
                step="3"
                title="Coureurs disponibles"
                detail="Le planning reste visible en ligne. Une course, une blessure ou un autre stage bloque automatiquement la sélection."
              />
              <button
                type="button"
                disabled={!range || availableRiders.length === 0}
                onClick={selectAllAvailable}
                className="min-h-10 rounded-xl border border-[#176951]/25 bg-[#EAF5F3] px-4 text-[10px] font-black uppercase tracking-[0.1em] text-[#176951] transition hover:bg-[#DDF1EA] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {availableRiders.length > 0 &&
                availableRiders.every((rider) =>
                  selectedRiderIds.includes(rider.id),
                )
                  ? "Tout désélectionner"
                  : `Sélectionner les ${availableRiders.length} libres`}
              </button>
            </div>

            <PlanningLegend />

            <div className="mt-3 overflow-x-auto rounded-2xl border border-[#315B3E]/12 [scrollbar-width:thin]">
              <div
                className="min-w-max"
                style={{
                  display: "grid",
                  gridTemplateColumns: `minmax(148px, 170px) repeat(${visibleDays.length}, 38px)`,
                }}
              >
                <div className="sticky left-0 z-30 border-b border-r border-[#315B3E]/12 bg-[#F3F8F6] px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
                  Coureur
                </div>
                {visibleDays.map((day) => (
                  <button
                    key={`header-${day.id}`}
                    type="button"
                    disabled={day.dayNumber <= planning.currentDayNumber}
                    onClick={() => chooseDay(day.dayNumber)}
                    className={`border-b border-r border-[#315B3E]/10 py-2 text-[9px] font-black ${
                      isDayInFormCampRange(day.dayNumber, range)
                        ? "bg-[#FFF2B8] text-[#6D5400]"
                        : day.dayNumber === planning.currentDayNumber
                          ? "bg-[#E6ECE9] text-[#7A8983]"
                          : "bg-[#F3F8F6] text-[#315B3E] hover:bg-[#E2F1EC]"
                    }`}
                  >
                    J{day.dayNumber}
                  </button>
                ))}

                {riders.map((rider) => {
                  const riderPlanning = planningByRiderId.get(rider.id);
                  const availability = availabilityByRiderId.get(rider.id);
                  const checked = selectedRiderIds.includes(rider.id);
                  const available = Boolean(availability?.available);
                  return (
                    <PlannerRiderRow
                      key={rider.id}
                      rider={rider}
                      planning={riderPlanning}
                      visibleDays={visibleDays}
                      range={range}
                      checked={checked}
                      available={available}
                      conflict={availability?.conflict ?? null}
                      missingPlanning={Boolean(availability?.missingPlanning)}
                      onToggle={(nextChecked) =>
                        toggleRider(rider.id, nextChecked)
                      }
                    />
                  );
                })}
              </div>
            </div>
            {!range ? (
              <p className="mt-3 text-xs font-bold text-[#7A5B09]">
                Choisissez d’abord une plage pour activer les coureurs libres.
              </p>
            ) : (
              <p className="mt-3 text-xs font-bold text-[#60756E]">
                {availableRiders.length} coureur
                {availableRiders.length > 1 ? "s" : ""} libre
                {availableRiders.length > 1 ? "s" : ""} sur J{range.startDay}
                {range.endDay > range.startDay ? `–J${range.endDay}` : ""}.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="mobile-dock-clearance fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] mx-auto max-w-4xl sm:inset-x-6">
        <div className="rounded-[1.35rem] border border-white/10 bg-[#071A17]/[0.97] p-3 text-white shadow-[0_24px_70px_rgba(7,26,23,0.42)] backdrop-blur-md sm:flex sm:items-center sm:justify-between sm:gap-5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-black">
              {range
                ? `${camp.label} · J${range.startDay}${range.endDay > range.startDay ? `–J${range.endDay}` : ""} · ${selectedRiderIds.length} coureur${selectedRiderIds.length > 1 ? "s" : ""}`
                : "Choisissez une plage puis les coureurs"}
            </p>
            <p className="mt-1 text-[10px] font-bold text-[#BFD1C6] sm:text-xs">
              {range
                ? `+${formGainPerDay}/jour, jusqu’à +${totalGainPerRider} par coureur · ${formatMoney(totalPrice, currency)}`
                : `${camp.label} · +${formGainPerDay} forme/jour`}
            </p>
            {!canAfford ? (
              <p className="mt-1 text-[10px] font-black text-[#FFAA9C]">
                Trésorerie insuffisante.
              </p>
            ) : null}
          </div>
          <FormCampSubmitButton disabled={!canSubmit} />
        </div>
      </div>
    </form>
  );
}

function PlannerRiderRow({
  rider,
  planning,
  visibleDays,
  range,
  checked,
  available,
  conflict,
  missingPlanning,
  onToggle,
}: {
  rider: FormCampPlannerRider;
  planning: RiderPlanningEntry | undefined;
  visibleDays: TeamRiderSeasonPlanning["days"];
  range: FormCampDayRange | null;
  checked: boolean;
  available: boolean;
  conflict: RiderPlanningEvent | null;
  missingPlanning: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const status = !range
    ? "Plage à choisir"
    : conflict
      ? conflict.title
      : missingPlanning
        ? "Planning indisponible"
        : "Libre";

  return (
    <>
      <label
        className={`sticky left-0 z-20 flex min-h-16 items-center gap-2 border-b border-r border-[#315B3E]/12 px-2.5 py-2 transition ${
          checked
            ? "bg-[#DDF3E7]"
            : available
              ? "cursor-pointer bg-white hover:bg-[#F0F8F5]"
              : "bg-[#F6F8F7]"
        }`}
      >
        <input
          type="checkbox"
          name="riderIds"
          value={rider.id}
          checked={checked}
          disabled={!available}
          onChange={(event) => onToggle(event.target.checked)}
          className="h-4 w-4 shrink-0 accent-[#176951]"
        />
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-black text-[#183F37]">
            <span
              className={`fi fi-${rider.countryCode.toLowerCase()} mr-1 rounded-sm`}
              aria-label={rider.countryName}
            />
            {rider.firstName} {rider.lastName}
          </span>
          <span
            className={`mt-1 block truncate text-[9px] font-bold ${
              available ? "text-[#278B70]" : "text-[#8A6B32]"
            }`}
            title={status}
          >
            Forme {rider.form} · {status}
          </span>
        </span>
      </label>
      {visibleDays.map((day) => {
        const event = planning?.events.find(
          (candidate) =>
            candidate.startDay <= day.dayNumber &&
            candidate.endDay >= day.dayNumber,
        );
        const selectedDay = isDayInFormCampRange(day.dayNumber, range);
        return (
          <span
            key={`${rider.id}-${day.id}`}
            title={
              event
                ? `J${day.dayNumber} · ${EVENT_LABELS[event.type]} · ${event.title}`
                : `J${day.dayNumber} · libre`
            }
            aria-label={
              event
                ? `J${day.dayNumber}, ${EVENT_LABELS[event.type]}, ${event.title}`
                : `J${day.dayNumber}, libre`
            }
            className={`relative min-h-16 border-b border-r border-[#315B3E]/10 ${
              event
                ? eventCellClass(event.type)
                : day.dayNumber <= visibleDays[0]?.dayNumber
                  ? "bg-[#EEF3F1]"
                  : "bg-white"
            } ${selectedDay ? "ring-2 ring-inset ring-[#D6A93A]" : ""}`}
          >
            {event ? (
              <span className="absolute inset-x-1 top-1/2 -translate-y-1/2 text-center text-[9px] font-black" aria-hidden="true">
                {eventIcon(event.type)}
              </span>
            ) : selectedDay ? (
              <span className="absolute inset-1 rounded-md bg-[#FFF4C7]" aria-hidden="true" />
            ) : null}
          </span>
        );
      })}
    </>
  );
}

function StepHeading({
  step,
  title,
  detail,
}: {
  step: string;
  title: string;
  detail: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
        {step} · Étape
      </p>
      <h4 className="mt-1 text-xl font-black text-[#183F37]">{title}</h4>
      <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-[#60756E]">
        {detail}
      </p>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-center">
      <p className="text-sm font-black text-[#F2C94C] sm:text-base">{value}</p>
      <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.11em] text-[#BFD1C6]">
        {label}
      </p>
    </div>
  );
}

function PlanningLegend() {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {(
        [
          ["race", "Course"],
          ["form_camp", "Stage"],
          ["reconnaissance", "Reconnaissance"],
          ["injury", "Blessure"],
        ] as const
      ).map(([type, label]) => (
        <span
          key={type}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black ${eventCellClass(type)}`}
        >
          {eventIcon(type)} {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D6A93A]/35 bg-[#FFF4C7] px-2.5 py-1 text-[9px] font-black text-[#6D5400]">
        Plage choisie
      </span>
    </div>
  );
}

function FormCampSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-3 inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-[#F2C94C] px-5 text-[10px] font-black uppercase tracking-[0.11em] text-[#071A17] transition hover:bg-[#F7D96C] disabled:cursor-not-allowed disabled:bg-[#43544F] disabled:text-[#AAB7B2] sm:mt-0 sm:w-auto"
    >
      {pending ? "Programmation…" : "Valider les stages"}
    </button>
  );
}

function eventCellClass(type: RiderPlanningEvent["type"]) {
  switch (type) {
    case "race":
      return "border-[#3157C8]/30 bg-[#E8EDFF] text-[#233F9C]";
    case "form_camp":
      return "border-[#278B70]/30 bg-[#DDF3E7] text-[#176951]";
    case "reconnaissance":
      return "border-[#C77A1B]/30 bg-[#FFF0D9] text-[#8B5311]";
    case "injury":
      return "border-[#D94F4F]/30 bg-[#FFF0EE] text-[#A13F37]";
  }
}

function eventIcon(type: RiderPlanningEvent["type"]) {
  switch (type) {
    case "race":
      return "◆";
    case "form_camp":
      return "+";
    case "reconnaissance":
      return "◎";
    case "injury":
      return "×";
  }
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(date);
}
