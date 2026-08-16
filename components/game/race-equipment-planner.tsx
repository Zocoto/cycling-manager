"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { saveRaceEquipmentPlanAction } from "@/app/jeu/preparation-course/actions";
import { EQUIPMENT_CATEGORIES, type EquipmentSlot } from "@/lib/game/equipment";
import {
  RACE_EQUIPMENT_EMPTY,
  RACE_EQUIPMENT_INHERIT,
  countRaceEquipmentOverrides,
  formatRaceEquipmentOptionLabel,
  getRaceEquipmentPlanKey,
  getRaceEquipmentStockConflicts,
  isRaceEquipmentItemSelectable,
  resolvePlannedEquipmentItemId,
  serializeRaceEquipmentPlanEntry,
  type RaceEquipmentPlanSelection,
} from "@/lib/game/race-equipment-planning";
import { RACE_PROFILE_LABELS } from "@/lib/game/race-calendar";
import type { RaceEquipmentPlanningData } from "@/services/race-equipment-planning";

export type RaceEquipmentPlannerRider = {
  riderId: string;
  firstName: string;
  lastName: string;
};

const WEAR_SLOTS = [
  "helmet",
  "glasses",
  "gloves",
  "bib_shorts",
  "shoes",
] as const satisfies readonly EquipmentSlot[];
const BIKE_SLOTS = [
  "frame",
  "front_wheel",
  "rear_wheel",
] as const satisfies readonly EquipmentSlot[];
const ALL_SLOTS = [...WEAR_SLOTS, ...BIKE_SLOTS];

type EquipmentGroup = "wear" | "bike";

export function RaceEquipmentPlanner({
  editionId,
  slug,
  isStageRace,
  riders,
  planning,
  savedStageId,
  saveStatus,
}: {
  editionId: string;
  slug: string;
  isStageRace: boolean;
  riders: RaceEquipmentPlannerRider[];
  planning: RaceEquipmentPlanningData;
  savedStageId: string | null;
  saveStatus: string | null;
}) {
  const firstEditable =
    planning.stages.find((stage) => stage.isEditable) ?? planning.stages[0];
  const initialStageId = planning.stages.some(
    (stage) => stage.id === savedStageId,
  )
    ? (savedStageId ?? firstEditable?.id ?? "")
    : (firstEditable?.id ?? "");
  const [selectedStageId, setSelectedStageId] = useState(initialStageId);
  const [selectedRiderId, setSelectedRiderId] = useState(
    riders[0]?.riderId ?? "",
  );
  const [group, setGroup] = useState<EquipmentGroup>("bike");
  const [selections, setSelections] = useState(() => {
    const initial = new Map<string, RaceEquipmentPlanSelection>();
    for (const assignment of planning.plannedAssignments) {
      initial.set(
        getRaceEquipmentPlanKey(
          assignment.stageId,
          assignment.riderId,
          assignment.slot,
        ),
        assignment.equipmentItemId ?? RACE_EQUIPMENT_EMPTY,
      );
    }
    return initial;
  });

  const selectedStage = planning.stages.find(
    (stage) => stage.id === selectedStageId,
  );
  const selectedRider = riders.find(
    (rider) => rider.riderId === selectedRiderId,
  );
  const itemById = useMemo(
    () => new Map(planning.catalog.map((item) => [item.id, item])),
    [planning.catalog],
  );
  const permanentByKey = useMemo(
    () =>
      new Map(
        planning.permanentAssignments.map((assignment) => [
          assignment.riderId + ":" + assignment.slot,
          assignment.equipmentItemId,
        ]),
      ),
    [planning.permanentAssignments],
  );
  const slots = group === "wear" ? WEAR_SLOTS : BIKE_SLOTS;
  const stageSelections = riders.flatMap((rider) =>
    ALL_SLOTS.map((slot) =>
      getSelection(selections, selectedStageId, rider.riderId, slot),
    ),
  );
  const overrideCount = countRaceEquipmentOverrides(stageSelections);
  const usageByItemId = getEquipmentUsageByItemId({
    stageId: selectedStageId,
    riders,
    selections,
    permanentByKey,
  });
  const conflicts = getRaceEquipmentStockConflicts({
    catalog: planning.catalog,
    usageByItemId,
  });
  const canSave = Boolean(selectedStage?.isEditable) && conflicts.length === 0;

  function updateSelection(slot: EquipmentSlot, value: string) {
    setSelections((current) => {
      const next = new Map(current);
      const key = getRaceEquipmentPlanKey(
        selectedStageId,
        selectedRiderId,
        slot,
      );
      if (value === RACE_EQUIPMENT_INHERIT) next.delete(key);
      else next.set(key, value);
      return next;
    });
  }

  if (!selectedStage || !selectedRider || riders.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-white/15 bg-black/10 p-4">
      <div className="rounded-xl border border-[#F2C94C]/35 bg-[#F2C94C]/10 px-4 py-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#F7DA72]">
          Montage de course uniquement
        </p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#F6EBC2]">
          Les choix faits ici valent seulement pour cette étape ou cette
          classique. Ils ne modifient jamais l’équipement permanent du coureur.
        </p>
      </div>

      {saveStatus === "enregistre" ? (
        <SaveNotice>
          Montage enregistré pour {isStageRace ? "l’étape" : "la classique"}.
        </SaveNotice>
      ) : saveStatus === "tour" ? (
        <SaveNotice>
          Montage appliqué à toutes les étapes encore modifiables du tour.
        </SaveNotice>
      ) : null}

      <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.16em] text-[#9BE0BC]">
        {isStageRace ? "Étape préparée" : "Épreuve préparée"}
        <select
          value={selectedStageId}
          onChange={(event) => setSelectedStageId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-white/15 bg-[#102F2B] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-[#9BE0BC]"
        >
          {planning.stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {isStageRace ? "E" + stage.stageNumber + " · " : ""}
              {stage.name} · {RACE_PROFILE_LABELS[stage.profileType]}
              {stage.isEditable ? "" : " · figée"}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-[#176951] text-xs font-black text-white"
        >
          {getRiderInitials(selectedRider)}
        </span>
        <label className="min-w-0 text-[10px] font-black uppercase tracking-[0.14em] text-[#9BE0BC]">
          Coureur
          <select
            value={selectedRiderId}
            onChange={(event) => setSelectedRiderId(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#102F2B] px-2.5 py-2 text-xs font-bold normal-case tracking-normal text-white outline-none focus:border-[#9BE0BC]"
          >
            {riders.map((rider) => (
              <option key={rider.riderId} value={rider.riderId}>
                {rider.firstName} {rider.lastName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-black/15 p-1"
        role="tablist"
        aria-label="Famille de matériel"
      >
        <GroupButton
          active={group === "bike"}
          onClick={() => setGroup("bike")}
          label="Vélo"
        />
        <GroupButton
          active={group === "wear"}
          onClick={() => setGroup("wear")}
          label="Tenue"
        />
      </div>

      <div className="mt-3 space-y-3">
        {slots.map((slot) => {
          const permanentId =
            permanentByKey.get(selectedRiderId + ":" + slot) ?? null;
          const permanentItem = permanentId ? itemById.get(permanentId) : null;
          const selection = getSelection(
            selections,
            selectedStageId,
            selectedRiderId,
            slot,
          );
          const effectiveId = resolvePlannedEquipmentItemId({
            permanentItemId: permanentId,
            selection,
          });
          const effectiveItem = effectiveId ? itemById.get(effectiveId) : null;

          return (
            <label key={slot} className="block">
              <span className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#D6DFD2]">
                {getSlotLabel(slot)}
                {selection !== RACE_EQUIPMENT_INHERIT ? (
                  <span className="rounded-full bg-[#F2C94C]/15 px-2 py-0.5 text-[9px] text-[#F7DA72]">
                    Spécifique
                  </span>
                ) : null}
              </span>
              <select
                value={selection}
                disabled={!selectedStage.isEditable}
                onChange={(event) => updateSelection(slot, event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#102F2B] px-3 py-2.5 text-xs font-bold text-white outline-none disabled:cursor-not-allowed disabled:opacity-55 focus:border-[#9BE0BC]"
              >
                <option value={RACE_EQUIPMENT_INHERIT}>
                  Permanent · {permanentItem?.name ?? "aucun matériel"}
                </option>
                <option value={RACE_EQUIPMENT_EMPTY}>Sans matériel</option>
                {planning.catalog
                  .filter((item) => item.slot === slot)
                  .map((item) => {
                    const isAvailable = isRaceEquipmentItemSelectable({
                      item,
                      usedQuantity: usageByItemId.get(item.id) ?? 0,
                      isCurrentSelection: effectiveId === item.id,
                    });

                    return (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={!isAvailable}
                      >
                        {formatRaceEquipmentOptionLabel({
                          name: item.name,
                          supplierName: item.supplierName,
                          effectSummary: item.effectSummary,
                          isAvailable,
                        })}
                      </option>
                    );
                  })}
              </select>
              <span className="mt-1 block text-[10px] font-semibold leading-4 text-[#AFC2BA]">
                {effectiveItem?.effectSummary ||
                  (effectiveItem
                    ? effectiveItem.supplierName
                    : "Emplacement laissé vide pour cette course.")}
              </span>
            </label>
          );
        })}
      </div>

      {conflicts.length > 0 ? (
        <div className="mt-4 rounded-xl border border-[#EF5B65]/40 bg-[#EF5B65]/10 px-3 py-2 text-xs font-bold leading-5 text-[#FFD1D4]">
          Stock insuffisant :{" "}
          {conflicts.map((conflict) => conflict.label).join(", ")}.
        </div>
      ) : null}

      {!selectedStage.isEditable ? (
        <p className="mt-4 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold leading-5 text-[#D6DFD2]">
          Le montage est figé cinq minutes avant le départ de cette étape.
        </p>
      ) : null}

      <form action={saveRaceEquipmentPlanAction} className="mt-4">
        <input type="hidden" name="editionId" value={editionId} />
        <input type="hidden" name="stageId" value={selectedStageId} />
        <input type="hidden" name="slug" value={slug} />
        {riders.flatMap((rider) =>
          ALL_SLOTS.map((slot) => (
            <input
              key={rider.riderId + ":" + slot}
              type="hidden"
              name="loadouts"
              value={serializeRaceEquipmentPlanEntry({
                riderId: rider.riderId,
                slot,
                selection: getSelection(
                  selections,
                  selectedStageId,
                  rider.riderId,
                  slot,
                ),
              })}
            />
          )),
        )}
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9BE0BC]">
          {overrideCount === 0
            ? "Montage permanent hérité pour toute l’équipe"
            : overrideCount +
              " réglage" +
              (overrideCount > 1 ? "s" : "") +
              " spécifique" +
              (overrideCount > 1 ? "s" : "")}
        </p>
        <div className="grid gap-2">
          <SaveButton
            name="applyToTour"
            value="false"
            disabled={!canSave}
            label={
              isStageRace
                ? "Enregistrer cette étape"
                : "Enregistrer la classique"
            }
          />
          {isStageRace && planning.stages.length > 1 ? (
            <SaveButton
              name="applyToTour"
              value="true"
              disabled={!canSave}
              label="Appliquer au tour entier"
              secondary
            />
          ) : null}
        </div>
        {isStageRace && planning.stages.length > 1 ? (
          <p className="mt-2 text-center text-[10px] font-semibold leading-4 text-[#AFC2BA]">
            Le second bouton copie ce montage sur toutes les étapes encore
            modifiables.
          </p>
        ) : null}
      </form>
    </div>
  );
}

function SaveNotice({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-[#B9EACF]">
      {children}
    </p>
  );
}

function GroupButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "rounded-lg px-3 py-2 text-xs font-black transition " +
        (active
          ? "bg-[#D7EEE8] text-[#0B302B] shadow-sm"
          : "text-[#D6DFD2] hover:bg-white/5")
      }
    >
      {label}
    </button>
  );
}

function SaveButton({
  name,
  value,
  disabled,
  label,
  secondary = false,
}: {
  name: string;
  value: string;
  disabled: boolean;
  label: string;
  secondary?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled || pending}
      className={
        "rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-45 " +
        (secondary
          ? "border border-[#9BE0BC]/35 bg-transparent text-[#B9EACF] hover:bg-white/5"
          : "bg-[#62BFA7] text-[#082A2A] hover:bg-[#78CEB6]")
      }
    >
      {pending ? "Enregistrement…" : label}
    </button>
  );
}

function getSelection(
  selections: ReadonlyMap<string, RaceEquipmentPlanSelection>,
  stageId: string,
  riderId: string,
  slot: EquipmentSlot,
) {
  return (
    selections.get(getRaceEquipmentPlanKey(stageId, riderId, slot)) ??
    RACE_EQUIPMENT_INHERIT
  );
}

function getSlotLabel(slot: EquipmentSlot) {
  return (
    EQUIPMENT_CATEGORIES.find((category) => category.slot === slot)
      ?.shortLabel ?? slot
  );
}

function getEquipmentUsageByItemId({
  stageId,
  riders,
  selections,
  permanentByKey,
}: {
  stageId: string;
  riders: RaceEquipmentPlannerRider[];
  selections: ReadonlyMap<string, RaceEquipmentPlanSelection>;
  permanentByKey: ReadonlyMap<string, string>;
}) {
  const usageByItemId = new Map<string, number>();
  for (const rider of riders) {
    for (const slot of ALL_SLOTS) {
      const itemId = resolvePlannedEquipmentItemId({
        permanentItemId: permanentByKey.get(rider.riderId + ":" + slot) ?? null,
        selection: getSelection(selections, stageId, rider.riderId, slot),
      });
      if (itemId) {
        usageByItemId.set(itemId, (usageByItemId.get(itemId) ?? 0) + 1);
      }
    }
  }

  return usageByItemId;
}

function getRiderInitials(rider: RaceEquipmentPlannerRider) {
  return `${rider.firstName.charAt(0)}${rider.lastName.charAt(0)}`.toUpperCase();
}
