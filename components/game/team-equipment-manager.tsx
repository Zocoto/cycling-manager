"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import {
  equipRiderAction,
  unequipRiderAction,
} from "@/app/jeu/materiel/actions";
import { EquipmentSubmitButton } from "@/components/game/equipment-submit-button";
import { RiderAvatar } from "@/components/game/rider-avatar";
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

const SLOT_SYMBOLS: Record<EquipmentSlot, string> = {
  helmet: "CS",
  glasses: "LU",
  gloves: "GA",
  bib_shorts: "CU",
  shoes: "CH",
  frame: "CA",
  front_wheel: "AV",
  rear_wheel: "AR",
};

type StatusFilter = "all" | "incomplete" | "complete";
type Selection = { riderId: string; slot: EquipmentSlot };

type TeamEquipmentManagerProps = {
  teamName: string;
  riders: TeamEquipmentRider[];
  catalog: TeamEquipmentCatalogItem[];
  assignments: TeamEquipmentAssignment[];
  pendingAssignments: TeamEquipmentPendingAssignment[];
  jersey: RiderJerseyAppearance;
  initialRiderId?: string | null;
  initialSlot?: EquipmentSlot | null;
};

export function TeamEquipmentManager({
  teamName,
  riders,
  catalog,
  assignments,
  pendingAssignments,
  jersey,
  initialRiderId,
  initialSlot,
}: TeamEquipmentManagerProps) {
  const initialSelection =
    initialRiderId &&
    initialSlot &&
    riders.some((rider) => rider.id === initialRiderId)
      ? { riderId: initialRiderId, slot: initialSlot }
      : null;
  const [selection, setSelection] = useState<Selection | null>(initialSelection);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [focusedSlot, setFocusedSlot] = useState<EquipmentSlot | null>(null);
  const itemById = useMemo(
    () => new Map(catalog.map((item) => [item.id, item])),
    [catalog],
  );
  const assignmentByKey = useMemo(
    () =>
      new Map(
        assignments.map((assignment) => [
          riderSlotKey(assignment.riderId, assignment.slot),
          assignment,
        ]),
      ),
    [assignments],
  );
  const pendingByKey = useMemo(
    () =>
      new Map(
        pendingAssignments.map((assignment) => [
          riderSlotKey(assignment.riderId, assignment.slot),
          assignment,
        ]),
      ),
    [pendingAssignments],
  );
  const equippedCountByRiderId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const assignment of assignments) {
      counts.set(
        assignment.riderId,
        (counts.get(assignment.riderId) ?? 0) + 1,
      );
    }
    return counts;
  }, [assignments]);
  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const visibleRiders = riders.filter((rider) => {
    const equippedCount = equippedCountByRiderId.get(rider.id) ?? 0;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "complete"
        ? equippedCount === EQUIPMENT_SLOTS.length
        : equippedCount < EQUIPMENT_SLOTS.length);
    if (!matchesStatus) return false;
    if (!normalizedSearch) return true;

    const equippedNames = assignments
      .filter((assignment) => assignment.riderId === rider.id)
      .map((assignment) => itemById.get(assignment.equipmentItemId)?.name ?? "")
      .join(" ");
    return `${rider.firstName} ${rider.lastName} ${equippedNames}`
      .toLocaleLowerCase("fr")
      .includes(normalizedSearch);
  });
  const visibleSlots = focusedSlot ? [focusedSlot] : SLOT_ORDER;
  const selectedRider = selection
    ? riders.find((rider) => rider.id === selection.riderId) ?? null
    : null;
  const selectedKey = selection
    ? riderSlotKey(selection.riderId, selection.slot)
    : null;
  const selectedAssignment = selectedKey
    ? assignmentByKey.get(selectedKey) ?? null
    : null;
  const selectedPending = selectedKey
    ? pendingByKey.get(selectedKey) ?? null
    : null;
  const selectedCurrentItem = selectedAssignment
    ? itemById.get(selectedAssignment.equipmentItemId) ?? null
    : null;
  const selectedPendingItem = selectedPending
    ? itemById.get(selectedPending.equipmentItemId) ?? null
    : null;
  const compatibleItems = selection
    ? catalog.filter(
        (item) =>
          item.slot === selection.slot &&
          (item.availableQuantity > 0 ||
            item.id === selectedAssignment?.equipmentItemId ||
            item.id === selectedPending?.equipmentItemId),
      )
    : [];
  const totalEquipped = assignments.length;
  const totalSlots = riders.length * EQUIPMENT_SLOTS.length;
  const completeRiders = riders.filter(
    (rider) =>
      (equippedCountByRiderId.get(rider.id) ?? 0) === EQUIPMENT_SLOTS.length,
  ).length;

  function focusSlot(slot: EquipmentSlot | null) {
    setFocusedSlot(slot);
    if (slot && selection?.slot !== slot) setSelection(null);
  }

  return (
    <section className="mt-6">
      <div className="rounded-[1.6rem] border border-[#315B3E]/12 bg-white p-4 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
              Pilotage de l’effectif
            </p>
            <h2 className="mt-1 text-xl font-black text-[#183F37] sm:text-2xl">
              Une seule vue pour équiper {teamName}
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#60756E]">
              Cliquez sur un emplacement, choisissez une pièce, puis passez au
              coureur suivant sans quitter cette page.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[390px]">
            <ManagerMetric label="Équipés" value={`${totalEquipped}/${totalSlots}`} />
            <ManagerMetric label="Coureurs complets" value={`${completeRiders}/${riders.length}`} />
            <ManagerMetric
              label="Pièces libres"
              value={String(
                catalog.reduce((total, item) => total + item.availableQuantity, 0),
              )}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto]">
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[#315B3E]/15 bg-[#F8FBF9] px-4">
            <span aria-hidden="true" className="text-[#278B70]">⌕</span>
            <span className="sr-only">Rechercher un coureur ou un matériel</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un coureur ou une pièce…"
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

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Afficher une catégorie de matériel">
          <SlotFocusButton active={focusedSlot === null} label="Tous les slots" onClick={() => focusSlot(null)} />
          {SLOT_ORDER.map((slot) => (
            <SlotFocusButton
              key={slot}
              active={focusedSlot === slot}
              label={slotLabel(slot)}
              count={catalog.filter((item) => item.slot === slot).reduce((total, item) => total + item.availableQuantity, 0)}
              onClick={() => focusSlot(slot)}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-[1.6rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
          <div className="hidden overflow-x-auto lg:block">
            <div
              className={`grid ${focusedSlot ? "min-w-[540px]" : "min-w-[840px]"} items-center gap-2 border-b border-[#315B3E]/12 bg-[#F2F8F5] px-3 py-2`}
              style={{ gridTemplateColumns: `minmax(190px,1.35fr) repeat(${visibleSlots.length}, minmax(${focusedSlot ? 210 : 78}px, 1fr))` }}
            >
              <span className="pl-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#60756E]">Coureur</span>
              {visibleSlots.map((slot) => <span key={slot} className="text-center text-[9px] font-black uppercase tracking-wide text-[#60756E]">{slotLabel(slot)}</span>)}
            </div>
            <div className="max-h-[66vh] min-h-[320px] overflow-y-auto">
              {visibleRiders.map((rider) => (
                <DesktopRiderRow
                  key={rider.id}
                  rider={rider}
                  jersey={jersey}
                  slots={visibleSlots}
                  itemById={itemById}
                  assignmentByKey={assignmentByKey}
                  pendingByKey={pendingByKey}
                  equippedCount={equippedCountByRiderId.get(rider.id) ?? 0}
                  selection={selection}
                  onSelect={setSelection}
                  focused={Boolean(focusedSlot)}
                />
              ))}
            </div>
          </div>

          <div className="max-h-[66vh] min-h-[320px] space-y-2 overflow-y-auto bg-[#F2F8F5] p-2 lg:hidden">
            {visibleRiders.map((rider) => (
              <MobileRiderCard
                key={rider.id}
                rider={rider}
                jersey={jersey}
                slots={visibleSlots}
                itemById={itemById}
                assignmentByKey={assignmentByKey}
                pendingByKey={pendingByKey}
                equippedCount={equippedCountByRiderId.get(rider.id) ?? 0}
                selection={selection}
                onSelect={setSelection}
              />
            ))}
          </div>

          {visibleRiders.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-black text-[#183F37]">Aucun coureur ne correspond aux filtres.</p>
              <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); }} className="mt-3 text-xs font-black text-[#176951] hover:underline">Réinitialiser les filtres</button>
            </div>
          ) : null}
        </div>

        <EquipmentSelectionPanel
          selection={selection}
          rider={selectedRider}
          currentItem={selectedCurrentItem}
          pendingItem={selectedPendingItem}
          compatibleItems={compatibleItems}
          onClose={() => setSelection(null)}
        />
      </div>
    </section>
  );
}

function DesktopRiderRow({ rider, jersey, slots, itemById, assignmentByKey, pendingByKey, equippedCount, selection, onSelect, focused }: {
  rider: TeamEquipmentRider;
  jersey: RiderJerseyAppearance;
  slots: EquipmentSlot[];
  itemById: Map<string, TeamEquipmentCatalogItem>;
  assignmentByKey: Map<string, TeamEquipmentAssignment>;
  pendingByKey: Map<string, TeamEquipmentPendingAssignment>;
  equippedCount: number;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
  focused: boolean;
}) {
  return (
    <div className={`grid ${focused ? "min-w-[540px]" : "min-w-[840px]"} items-center gap-2 border-b border-[#315B3E]/10 px-3 py-2 last:border-b-0 hover:bg-[#F8FBF9]`} style={{ gridTemplateColumns: `minmax(190px,1.35fr) repeat(${slots.length}, minmax(${focused ? 210 : 78}px, 1fr))` }}>
      <RiderIdentity rider={rider} jersey={jersey} equippedCount={equippedCount} />
      {slots.map((slot) => {
        const key = riderSlotKey(rider.id, slot);
        const assignment = assignmentByKey.get(key);
        const pending = pendingByKey.get(key);
        return <EquipmentSlotButton key={slot} slot={slot} currentItem={assignment ? itemById.get(assignment.equipmentItemId) ?? null : null} pendingItem={pending ? itemById.get(pending.equipmentItemId) ?? null : null} selected={selection?.riderId === rider.id && selection.slot === slot} onClick={() => onSelect({ riderId: rider.id, slot })} expanded={focused} />;
      })}
    </div>
  );
}

function MobileRiderCard({ rider, jersey, slots, itemById, assignmentByKey, pendingByKey, equippedCount, selection, onSelect }: {
  rider: TeamEquipmentRider;
  jersey: RiderJerseyAppearance;
  slots: EquipmentSlot[];
  itemById: Map<string, TeamEquipmentCatalogItem>;
  assignmentByKey: Map<string, TeamEquipmentAssignment>;
  pendingByKey: Map<string, TeamEquipmentPendingAssignment>;
  equippedCount: number;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/12 bg-white p-3">
      <RiderIdentity rider={rider} jersey={jersey} equippedCount={equippedCount} />
      <div className={slots.length === 1 ? "mt-3" : "mt-3 grid grid-cols-4 gap-1.5"}>
        {slots.map((slot) => {
          const key = riderSlotKey(rider.id, slot);
          const assignment = assignmentByKey.get(key);
          const pending = pendingByKey.get(key);
          return <EquipmentSlotButton key={slot} slot={slot} currentItem={assignment ? itemById.get(assignment.equipmentItemId) ?? null : null} pendingItem={pending ? itemById.get(pending.equipmentItemId) ?? null : null} selected={selection?.riderId === rider.id && selection.slot === slot} onClick={() => onSelect({ riderId: rider.id, slot })} expanded={slots.length === 1} />;
        })}
      </div>
    </article>
  );
}

function RiderIdentity({ rider, jersey, equippedCount }: { rider: TeamEquipmentRider; jersey: RiderJerseyAppearance; equippedCount: number }) {
  const complete = equippedCount === EQUIPMENT_SLOTS.length;
  return (
    <div className="flex min-w-0 items-center gap-3 px-1">
      <RiderAvatar profileKey={rider.avatarProfileKey} seed={rider.avatarSeed} riderId={rider.id} jersey={jersey} label={`Portrait de ${rider.firstName} ${rider.lastName}`} className="h-11 w-11" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-[#183F37]">{rider.firstName} {rider.lastName}</p>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-[#DDE9E4]">
            <span className={complete ? "block h-full bg-[#42B99A]" : "block h-full bg-[#F2C94C]"} style={{ width: `${(equippedCount / EQUIPMENT_SLOTS.length) * 100}%` }} />
          </div>
          <span className={complete ? "text-[9px] font-black text-[#176951]" : "text-[9px] font-black text-[#8A6516]"}>{equippedCount}/8</span>
        </div>
      </div>
    </div>
  );
}

function EquipmentSlotButton({ slot, currentItem, pendingItem, selected, onClick, expanded }: {
  slot: EquipmentSlot;
  currentItem: TeamEquipmentCatalogItem | null;
  pendingItem: TeamEquipmentCatalogItem | null;
  selected: boolean;
  onClick: () => void;
  expanded: boolean;
}) {
  const occupied = Boolean(currentItem || pendingItem);
  return (
    <button type="button" onClick={onClick} aria-label={`${slotLabel(slot)} · ${currentItem?.name ?? "emplacement vide"}`} aria-pressed={selected} title={pendingItem ? `${currentItem?.name ?? "Vide"} → ${pendingItem.name}` : currentItem?.name ?? "Emplacement vide"} className={["group relative flex min-h-14 min-w-0 items-center rounded-xl border px-2 py-2 text-left transition", selected ? "border-[#D29F32] bg-[#FFF4D6] ring-2 ring-[#F2C94C]/25" : occupied ? "border-[#42B99A]/30 bg-[#EAF5F3] hover:border-[#278B70]/55" : "border-dashed border-[#315B3E]/18 bg-[#F8FBF9] hover:border-[#42B99A]/55 hover:bg-[#F2F8F5]", expanded ? "gap-3" : "justify-center"].join(" ")}>
      <span className={occupied ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#176951] text-[9px] font-black text-white" : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#DDE9E4] text-[9px] font-black text-[#60756E]"}>{SLOT_SYMBOLS[slot]}</span>
      {expanded ? <span className="min-w-0"><span className="block text-[9px] font-black uppercase tracking-wider text-[#60756E]">{slotLabel(slot)}</span><span className="mt-0.5 block truncate text-xs font-black text-[#183F37]">{currentItem?.name ?? "Emplacement vide"}</span>{pendingItem ? <span className="mt-0.5 block truncate text-[9px] font-bold text-[#9A6B17]">Puis {pendingItem.name}</span> : null}</span> : null}
      {pendingItem ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#F2C94C] ring-2 ring-white" title="Changement programmé" /> : null}
    </button>
  );
}

function EquipmentSelectionPanel({ selection, rider, currentItem, pendingItem, compatibleItems, onClose }: {
  selection: Selection | null;
  rider: TeamEquipmentRider | null;
  currentItem: TeamEquipmentCatalogItem | null;
  pendingItem: TeamEquipmentCatalogItem | null;
  compatibleItems: TeamEquipmentCatalogItem[];
  onClose: () => void;
}) {
  const panelClass = selection
    ? "fixed inset-x-3 bottom-3 z-50 flex max-h-[72vh] flex-col overflow-hidden rounded-[1.6rem] border border-[#315B3E]/20 bg-[#0B302B] text-white shadow-[0_24px_80px_rgba(7,26,23,0.42)] xl:sticky xl:inset-auto xl:top-24 xl:z-10 xl:max-h-[74vh]"
    : "hidden rounded-[1.6rem] border border-[#315B3E]/15 bg-[#0B302B] p-6 text-white shadow-[0_16px_45px_rgba(7,26,23,0.14)] xl:sticky xl:top-24 xl:block";

  if (!selection || !rider) {
    return <aside className={panelClass}><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9BE0BC]">Attribution rapide</p><h3 className="mt-2 text-xl font-black">Sélectionnez un slot</h3><p className="mt-3 text-sm font-semibold leading-6 text-[#D6DFD2]">Le stock compatible apparaîtra ici. Le panneau reste en place pendant que vous passez d’un coureur à l’autre.</p><div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs font-bold leading-5 text-[#B9C9C3]">Astuce : choisissez une catégorie au-dessus du tableau pour équiper tous les casques, cadres ou roues à la chaîne.</div></aside>;
  }

  return (
    <aside className={panelClass} aria-label={`Équiper ${rider.firstName} ${rider.lastName}`}>
      <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9BE0BC]">{slotLabel(selection.slot)}</p><h3 className="mt-1 text-lg font-black">{rider.firstName} {rider.lastName}</h3><p className="mt-1 text-[11px] font-bold text-[#B9C9C3]">{currentItem ? `Actuellement · ${currentItem.name}` : "Emplacement actuellement vide"}</p>{pendingItem ? <p className="mt-1 text-[10px] font-black text-[#F2C94C]">Programmé · {pendingItem.name}</p> : null}</div>
        <button type="button" onClick={onClose} aria-label="Fermer le panneau" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-black hover:bg-white/10">×</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {currentItem || pendingItem ? <form action={unequipRiderAction} className="mb-3 rounded-xl border border-[#EF5B65]/25 bg-[#EF5B65]/10 p-3"><input type="hidden" name="riderId" value={rider.id} /><input type="hidden" name="slot" value={selection.slot} /><input type="hidden" name="origin" value="team-equipment" /><EquipmentSubmitButton mode="remove" label="Libérer cet emplacement" /></form> : null}
        <p className="px-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#9BE0BC]">{compatibleItems.length} référence{compatibleItems.length > 1 ? "s" : ""} compatible{compatibleItems.length > 1 ? "s" : ""}</p>
        <div className="mt-2 space-y-2">
          {compatibleItems.map((item) => {
            const isCurrent = item.id === currentItem?.id;
            const isPending = item.id === pendingItem?.id;
            return (
              <form key={item.id} action={equipRiderAction} className={isPending ? "rounded-xl border border-[#F2C94C]/45 bg-[#F2C94C]/10 p-3" : isCurrent ? "rounded-xl border border-[#42B99A]/35 bg-[#42B99A]/10 p-3" : "rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-[#42B99A]/35 hover:bg-white/10"}>
                <input type="hidden" name="riderId" value={rider.id} /><input type="hidden" name="slot" value={selection.slot} /><input type="hidden" name="equipmentItemId" value={item.id} /><input type="hidden" name="origin" value="team-equipment" />
                <div className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/90 p-1"><Image src={item.imagePath} alt="" width={44} height={44} className="h-full w-full object-contain" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{item.name}</span><span className="mt-0.5 block truncate text-[10px] font-bold text-[#B9C9C3]">{item.effectSummary}</span><span className="mt-1 block text-[9px] font-black uppercase tracking-wide text-[#9BE0BC]">{isCurrent ? "Déjà équipé" : isPending ? "Changement programmé" : `${item.availableQuantity} libre${item.availableQuantity > 1 ? "s" : ""}`}</span></span>{!isCurrent && !isPending ? <EquipmentSubmitButton mode="equip" label={currentItem ? "Remplacer" : "Équiper"} /> : <span className="rounded-lg bg-white/10 px-2.5 py-2 text-[9px] font-black uppercase text-[#D6DFD2]">{isPending ? "Programmé" : "Actif"}</span>}</div>
              </form>
            );
          })}
        </div>
        {compatibleItems.length === 0 ? <div className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center"><p className="text-sm font-black">Aucune pièce libre</p><p className="mt-1 text-xs font-semibold leading-5 text-[#B9C9C3]">Achetez une référence ou libérez-en une sur un autre coureur.</p></div> : null}
      </div>
    </aside>
  );
}

function SlotFocusButton({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={active ? "shrink-0 rounded-full bg-[#176951] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white" : "shrink-0 rounded-full border border-[#315B3E]/15 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#60756E] hover:border-[#42B99A]/45 hover:text-[#176951]"}>{label}{typeof count === "number" ? ` · ${count}` : ""}</button>;
}

function ManagerMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#EAF5F3] px-2 py-3"><span className="block text-base font-black tabular-nums text-[#176951] sm:text-lg">{value}</span><span className="mt-0.5 block text-[8px] font-black uppercase tracking-wide text-[#60756E]">{label}</span></div>;
}

function riderSlotKey(riderId: string, slot: EquipmentSlot) {
  return `${riderId}:${slot}`;
}

function slotLabel(slot: EquipmentSlot) {
  return EQUIPMENT_CATEGORIES.find((category) => category.slot === slot)?.shortLabel ?? slot;
}
