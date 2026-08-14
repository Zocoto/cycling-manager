"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { saveTeamEquipmentAssignmentsAction } from "@/app/jeu/materiel/actions";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { TeamEquipmentDesktopTable } from "@/components/game/team-equipment-desktop-table";
import Link from "@/components/ui/app-link";
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_SLOTS,
  type EquipmentSlot,
} from "@/lib/game/equipment";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";
import type {
  TeamEquipmentAssignment,
  TeamEquipmentCatalogItem,
  TeamEquipmentPendingAssignment,
  TeamEquipmentRider,
} from "@/services/team-equipment";

type StatusFilter = "all" | "incomplete" | "complete";

const SLOT_ORDER: EquipmentSlot[] = [
  "helmet",
  "glasses",
  "gloves",
  "bib_shorts",
  "shoes",
  "frame",
  "front_wheel",
  "rear_wheel",
];

export function TeamEquipmentBulkEditor({
  riders,
  catalog,
  assignments,
  pendingAssignments,
  jersey,
}: {
  riders: TeamEquipmentRider[];
  catalog: TeamEquipmentCatalogItem[];
  assignments: TeamEquipmentAssignment[];
  pendingAssignments: TeamEquipmentPendingAssignment[];
  jersey: RiderJerseyAppearance;
}) {
  const initialValues = useMemo(
    () =>
      buildInitialEquipmentValues({
        riders,
        assignments,
        pendingAssignments,
      }),
    [assignments, pendingAssignments, riders],
  );
  const [valuesByKey, setValuesByKey] = useState(() => initialValues);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const itemById = useMemo(
    () => new Map(catalog.map((item) => [item.id, item])),
    [catalog],
  );
  const itemsBySlot = useMemo(
    () =>
      Object.fromEntries(
        EQUIPMENT_SLOTS.map((slot) => [
          slot,
          getSelectableEquipmentItemsForSlot(catalog, slot),
        ]),
      ) as Record<EquipmentSlot, TeamEquipmentCatalogItem[]>,
    [catalog],
  );
  const usageByItemId = useMemo(() => {
    const usage: Record<string, number> = {};
    for (const equipmentItemId of Object.values(valuesByKey)) {
      if (!equipmentItemId) continue;
      usage[equipmentItemId] = (usage[equipmentItemId] ?? 0) + 1;
    }

    const currentItemByKey = new Map(
      assignments.map((assignment) => [
        riderSlotKey(assignment.riderId, assignment.slot),
        assignment.equipmentItemId,
      ]),
    );
    for (const pending of pendingAssignments) {
      const key = riderSlotKey(pending.riderId, pending.slot);
      const currentItemId = currentItemByKey.get(key);
      const desiredItemId = valuesByKey[key];
      if (
        currentItemId &&
        desiredItemId &&
        currentItemId !== desiredItemId
      ) {
        usage[currentItemId] = (usage[currentItemId] ?? 0) + 1;
      }
    }

    return usage;
  }, [assignments, pendingAssignments, valuesByKey]);
  const changedAssignments = useMemo(
    () =>
      riders.flatMap((rider) =>
        SLOT_ORDER.flatMap((slot) => {
          const key = riderSlotKey(rider.id, slot);
          const value = valuesByKey[key] ?? "";
          if (value === (initialValues[key] ?? "")) return [];
          return [
            {
              riderId: rider.id,
              slot,
              equipmentItemId: value || null,
            },
          ];
        }),
      ),
    [initialValues, riders, valuesByKey],
  );
  const affectedRiderCount = new Set(
    changedAssignments.map((assignment) => assignment.riderId),
  ).size;
  const hasStockError = hasEquipmentStockError(catalog, usageByItemId);
  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const visibleRiders = riders.filter((rider) => {
    const equippedCount = SLOT_ORDER.filter(
      (slot) => valuesByKey[riderSlotKey(rider.id, slot)],
    ).length;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "complete"
        ? equippedCount === SLOT_ORDER.length
        : equippedCount < SLOT_ORDER.length);
    const matchesSearch = `${rider.firstName} ${rider.lastName}`
      .toLocaleLowerCase("fr")
      .includes(normalizedSearch);
    return matchesStatus && matchesSearch;
  });
  const totalEquipped = Object.values(valuesByKey).filter(Boolean).length;
  const totalSlots = riders.length * SLOT_ORDER.length;
  const pendingKeys = useMemo(
    () =>
      new Set(
        pendingAssignments.map((assignment) =>
          riderSlotKey(assignment.riderId, assignment.slot),
        ),
      ),
    [pendingAssignments],
  );

  function updateValue(
    riderId: string,
    slot: EquipmentSlot,
    equipmentItemId: string,
  ) {
    setValuesByKey((current) => ({
      ...current,
      [riderSlotKey(riderId, slot)]: equipmentItemId,
    }));
  }

  return (
    <form action={saveTeamEquipmentAssignmentsAction} className="mt-6">
      <input
        type="hidden"
        name="assignments"
        value={JSON.stringify(changedAssignments)}
      />

      <section className="rounded-[1.6rem] border border-[#315B3E]/12 bg-white p-4 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
              Affectation groupée
            </p>
            <h2 className="mt-1 text-xl font-black text-[#183F37] sm:text-2xl">
              Tout l’effectif, tous les emplacements
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#60756E]">
              Réglez plusieurs coureurs, puis validez toutes les modifications en une seule fois.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[390px]">
            <ManagerMetric label="Équipés" value={`${totalEquipped}/${totalSlots}`} />
            <ManagerMetric
              label="Coureurs"
              value={String(riders.length)}
            />
            <ManagerMetric
              label="Pièces libres"
              value={String(
                catalog.reduce(
                  (total, item) =>
                    total +
                    Math.max(
                      0,
                      getEquipmentItemCapacity(item, riders.length) -
                        (usageByItemId[item.id] ?? 0),
                    ),
                  0,
                ),
              )}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto]">
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[#315B3E]/15 bg-[#F8FBF9] px-4">
            <span aria-hidden="true" className="text-[#278B70]">⌕</span>
            <span className="sr-only">Rechercher un coureur</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un coureur…"
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#183F37] outline-none placeholder:text-[#7C918A]"
            />
          </label>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#EAF5F3] p-1">
            {([
              ["all", "Tous"],
              ["incomplete", "À compléter"],
              ["complete", "Complets"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                aria-pressed={statusFilter === value}
                className={
                  statusFilter === value
                    ? "rounded-lg bg-[#0B302B] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
                    : "rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#60756E] hover:text-[#176951]"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-4 space-y-3 lg:hidden">
        {visibleRiders.map((rider) => {
          const equippedCount = SLOT_ORDER.filter(
            (slot) => valuesByKey[riderSlotKey(rider.id, slot)],
          ).length;

          return (
            <article
              key={rider.id}
              className="rounded-[1.6rem] border border-[#315B3E]/12 bg-white p-4 shadow-[0_12px_34px_rgba(19,60,46,0.06)] sm:p-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <RiderAvatar
                  profileKey={rider.avatarProfileKey}
                  seed={rider.avatarSeed}
                  riderId={rider.id}
                  jersey={jersey}
                  label={`Portrait de ${rider.firstName} ${rider.lastName}`}
                  className="h-12 w-12"
                />
                <div className="min-w-0 flex-1">
                  <Link href={`/jeu/coureurs/${rider.id}`} target="_blank" rel="noreferrer" className="block truncate text-base font-black text-[#183F37] transition hover:text-[#176951] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]">
                    {rider.firstName} {rider.lastName} <span aria-hidden="true">↗</span>
                  </Link>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#60756E]">
                    {equippedCount}/{SLOT_ORDER.length} emplacements équipés
                  </p>
                </div>
                <span
                  className={
                    equippedCount === SLOT_ORDER.length
                      ? "rounded-full bg-[#DDF3E7] px-3 py-2 text-[10px] font-black uppercase text-[#176951]"
                      : "rounded-full bg-[#FFF4D6] px-3 py-2 text-[10px] font-black uppercase text-[#8A6516]"
                  }
                >
                  {equippedCount === SLOT_ORDER.length ? "Complet" : "À compléter"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {SLOT_ORDER.map((slot) => {
                  const key = riderSlotKey(rider.id, slot);
                  const selectedItemId = valuesByKey[key] ?? "";
                  const slotItems = itemsBySlot[slot];
                  const selectedItem = selectedItemId
                    ? itemById.get(selectedItemId) ?? null
                    : null;

                  return (
                    <label key={slot} className="grid min-w-0 gap-1.5">
                      <span className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
                        {slotLabel(slot)}
                        {pendingKeys.has(key) ? (
                          <span className="text-[#9A6B17]">Programmé</span>
                        ) : null}
                      </span>
                      <select
                        name={`equipment-${rider.id}-${slot}`}
                        value={selectedItemId}
                        onChange={(event) =>
                          updateValue(rider.id, slot, event.target.value)
                        }
                        className="min-h-11 min-w-0 rounded-xl border border-[#315B3E]/15 bg-[#F8FBF9] px-3 text-xs font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/15"
                      >
                        <option value="" disabled={pendingKeys.has(key)}>
                          Emplacement vide
                        </option>
                        {slotItems.map((item) => {
                          const usage = usageByItemId[item.id] ?? 0;
                          const remaining = item.ownedQuantity - usage;
                          const isSelected = item.id === selectedItemId;
                          return (
                            <option
                              key={item.id}
                              value={item.id}
                              disabled={
                                !item.isUnlimited && remaining <= 0 && !isSelected
                              }
                            >
                              {item.name} · {getEquipmentAvailabilityLabel(item, usage)}
                            </option>
                          );
                        })}
                      </select>
                      <span className="min-h-4 truncate text-[9px] font-bold text-[#809189]">
                        {selectedItem?.effectSummary ?? "Aucun bonus"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      <TeamEquipmentDesktopTable
        riders={visibleRiders}
        slots={SLOT_ORDER}
        itemsBySlot={itemsBySlot}
        itemById={itemById}
        valuesByKey={valuesByKey}
        usageByItemId={usageByItemId}
        pendingKeys={pendingKeys}
        jersey={jersey}
        onChange={updateValue}
      />

      {visibleRiders.length === 0 ? (
        <div className="mt-4 rounded-[1.6rem] border border-dashed border-[#315B3E]/20 bg-white px-6 py-12 text-center">
          <p className="text-sm font-black text-[#183F37]">
            Aucun coureur ne correspond aux filtres.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
            }}
            className="mt-3 text-xs font-black text-[#176951] hover:underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : null}

      {changedAssignments.length > 0 ? (
        <>
          <div aria-hidden="true" className="h-32 sm:h-24" />
          <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] mx-auto max-w-3xl sm:inset-x-6">
            <div className="flex flex-col gap-3 rounded-[1.35rem] border border-white/20 bg-[#0B302B]/95 p-3 text-white shadow-[0_22px_65px_rgba(7,26,23,0.38)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-4">
              <div className="flex min-w-0 items-center gap-3 px-1">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2C94C] text-sm font-black text-[#0B302B]">
                  {changedAssignments.length}
                </span>
                <div className="min-w-0" aria-live="polite">
                  <p className="text-sm font-black">
                    {affectedRiderCount} coureur{affectedRiderCount > 1 ? "s" : ""} modifié{affectedRiderCount > 1 ? "s" : ""}
                  </p>
                  <p className="text-[11px] font-semibold text-[#CDE2DA]">
                    {hasStockError
                      ? "Le stock projeté est insuffisant."
                      : "Continuez vos réglages ou validez tout en une fois."}
                  </p>
                </div>
              </div>
              <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => setValuesByKey({ ...initialValues })}
                  className="min-h-11 rounded-xl px-3 text-xs font-black uppercase tracking-[0.08em] text-[#CDE2DA] transition hover:bg-white/10 hover:text-white"
                >
                  Annuler
                </button>
                <EquipmentBulkSubmitButton disabled={hasStockError} />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </form>
  );
}

export function isEquipmentItemSelectable(item: TeamEquipmentCatalogItem) {
  return item.isUnlimited || item.ownedQuantity > 0;
}

export function getSelectableEquipmentItemsForSlot(
  catalog: TeamEquipmentCatalogItem[],
  slot: EquipmentSlot,
) {
  return catalog
    .filter(
      (item) => item.slot === slot && isEquipmentItemSelectable(item),
    )
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name, "fr") || left.price - right.price,
    );
}

export function hasEquipmentStockError(
  catalog: TeamEquipmentCatalogItem[],
  usageByItemId: Record<string, number>,
) {
  return catalog.some(
    (item) =>
      !item.isUnlimited &&
      (usageByItemId[item.id] ?? 0) > item.ownedQuantity,
  );
}

export function getEquipmentItemCapacity(
  item: TeamEquipmentCatalogItem,
  riderCount: number,
) {
  return item.isUnlimited ? riderCount : item.ownedQuantity;
}

export function getEquipmentAvailabilityLabel(
  item: TeamEquipmentCatalogItem,
  usage: number,
) {
  if (item.isUnlimited) return "dotation illimitée";
  const remaining = Math.max(0, item.ownedQuantity - usage);
  return `${remaining} libre${remaining > 1 ? "s" : ""}`;
}
export function buildInitialEquipmentValues({
  riders,
  assignments,
  pendingAssignments,
}: {
  riders: TeamEquipmentRider[];
  assignments: TeamEquipmentAssignment[];
  pendingAssignments: TeamEquipmentPendingAssignment[];
}) {
  const values: Record<string, string> = {};
  for (const rider of riders) {
    for (const slot of SLOT_ORDER) {
      values[riderSlotKey(rider.id, slot)] = "";
    }
  }
  for (const assignment of assignments) {
    values[riderSlotKey(assignment.riderId, assignment.slot)] =
      assignment.equipmentItemId;
  }
  for (const assignment of pendingAssignments) {
    values[riderSlotKey(assignment.riderId, assignment.slot)] =
      assignment.equipmentItemId;
  }
  return values;
}

function EquipmentBulkSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F2C94C] px-4 text-center text-xs font-black uppercase tracking-[0.08em] text-[#0B302B] transition hover:bg-[#FFE071] disabled:cursor-not-allowed disabled:bg-[#91A59D] disabled:text-white sm:min-w-56"
    >
      {pending ? "Validation…" : "Valider les affectations"}
    </button>
  );
}

function ManagerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#EAF5F3] px-2 py-3">
      <span className="block text-base font-black tabular-nums text-[#176951] sm:text-lg">
        {value}
      </span>
      <span className="mt-0.5 block text-[8px] font-black uppercase tracking-wide text-[#60756E]">
        {label}
      </span>
    </div>
  );
}

function riderSlotKey(riderId: string, slot: EquipmentSlot) {
  return `${riderId}:${slot}`;
}

function slotLabel(slot: EquipmentSlot) {
  return (
    EQUIPMENT_CATEGORIES.find((category) => category.slot === slot)
      ?.shortLabel ?? slot
  );
}
