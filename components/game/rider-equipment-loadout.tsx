"use client";

import Image from "next/image";
import { useMemo, useState, useTransition, type DragEvent } from "react";

import Link from "@/components/ui/app-link";

import {
  equipRiderAction,
  unequipRiderAction,
} from "@/app/jeu/materiel/actions";
import { EquipmentSubmitButton } from "@/components/game/equipment-submit-button";
import {
  combineEquipmentEffects,
  getEquipmentCategory,
  type EquipmentEffects,
  type EquipmentSlot,
} from "@/lib/game/equipment";
import {
  RIDER_RATING_AXES,
  type RiderRatingKey,
} from "@/lib/game/rider-profile";
import type { PublicRiderProfile } from "@/services/public-rider-profile";
import type {
  RiderEquipmentManagement,
  TeamEquipmentCatalogItem,
} from "@/services/team-equipment";

type EquipmentItem = {
  id: string;
  name: string;
  catalogKey: string;
  imagePath: string;
  effectSummary: string;
  effects: EquipmentEffects;
};

type RiderEquipmentLoadoutProps = {
  riderId: string;
  equipment: PublicRiderProfile["equipment"];
  canManage: boolean;
  management: RiderEquipmentManagement | null;
};

type SlotDefinition = {
  slot: EquipmentSlot;
  label: string;
  icon: string;
};

const LEFT_SLOTS: SlotDefinition[] = [
  { slot: "helmet", label: "Casque", icon: "CS" },
  { slot: "glasses", label: "Lunettes", icon: "LU" },
  { slot: "gloves", label: "Gants", icon: "GA" },
  { slot: "bib_shorts", label: "Cuissard", icon: "CU" },
];

const RIGHT_SLOTS: SlotDefinition[] = [
  { slot: "frame", label: "Cadre", icon: "CA" },
  { slot: "front_wheel", label: "Roue avant", icon: "AV" },
  { slot: "rear_wheel", label: "Roue arrière", icon: "AR" },
  { slot: "shoes", label: "Chaussures", icon: "CH" },
];

const ALL_SLOTS = [...LEFT_SLOTS, ...RIGHT_SLOTS];

const SILHOUETTE_MARKERS: Array<
  SlotDefinition & { left: string; top: string }
> = [
  { slot: "helmet", label: "Casque", icon: "CS", left: "62%", top: "10%" },
  { slot: "glasses", label: "Lunettes", icon: "LU", left: "70%", top: "18%" },
  { slot: "gloves", label: "Gants", icon: "GA", left: "77%", top: "37%" },
  {
    slot: "bib_shorts",
    label: "Cuissard",
    icon: "CU",
    left: "47%",
    top: "43%",
  },
  { slot: "shoes", label: "Chaussures", icon: "CH", left: "55%", top: "73%" },
  { slot: "frame", label: "Cadre", icon: "CA", left: "53%", top: "61%" },
  {
    slot: "front_wheel",
    label: "Roue avant",
    icon: "AV",
    left: "83%",
    top: "73%",
  },
  {
    slot: "rear_wheel",
    label: "Roue arrière",
    icon: "AR",
    left: "18%",
    top: "73%",
  },
];

export function RiderEquipmentLoadout({
  riderId,
  equipment,
  canManage,
  management,
}: RiderEquipmentLoadoutProps) {
  const activeEquipment = (management?.current ?? equipment) as Partial<
    Record<EquipmentSlot, EquipmentItem>
  >;
  const combinedEffects = combineEquipmentEffects(
    Object.values(activeEquipment)
      .filter((item): item is EquipmentItem => Boolean(item))
      .map((item) => item.effects),
  );
  const availableItems = useMemo(
    () => collectAvailableEquipment(management, activeEquipment),
    [activeEquipment, management],
  );
  const [draggedItem, setDraggedItem] =
    useState<TeamEquipmentCatalogItem | null>(null);
  const [dropTargetSlot, setDropTargetSlot] = useState<EquipmentSlot | null>(
    null,
  );
  const [isApplying, startApplying] = useTransition();
  const isManageable = canManage && Boolean(management);

  function startDragging(
    event: DragEvent<HTMLElement>,
    item: TeamEquipmentCatalogItem,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
    setDraggedItem(item);
  }

  function finishDragging() {
    setDraggedItem(null);
    setDropTargetSlot(null);
  }

  function dropEquipment(event: DragEvent<HTMLElement>, slot: EquipmentSlot) {
    event.preventDefault();

    if (!draggedItem || draggedItem.slot !== slot || isApplying) {
      finishDragging();
      return;
    }

    const formData = new FormData();
    formData.set("riderId", riderId);
    formData.set("slot", slot);
    formData.set("equipmentItemId", draggedItem.id);
    formData.set("origin", "rider");

    finishDragging();
    startApplying(() => {
      void equipRiderAction(formData);
    });
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-[#102D28] text-white shadow-[0_22px_55px_rgba(7,26,23,0.18)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-6 py-5 sm:px-8">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8FD5B6]">
            Équipement
          </p>
          <h2 className="mt-2 text-xl font-black">Configuration du coureur</h2>
          <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-[#9FB5A8]">
            Les zones colorées sur le coureur et son vélo indiquent
            immédiatement les slots équipés.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#BFD1C6]">
          {canManage ? "Modifiable par votre équipe" : "Consultation publique"}
        </span>
      </div>

      <div
        className={`grid gap-5 p-5 sm:p-8 ${isManageable ? "xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.7fr)]" : ""}`}
      >
        <div className="rounded-3xl border border-white/10 bg-black/10 p-4 sm:p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,1.15fr)_minmax(0,1fr)] xl:items-center">
            <div className="space-y-4">
              {LEFT_SLOTS.map((definition) => (
                <EquipmentSlotCard
                  key={definition.slot}
                  {...definition}
                  riderId={riderId}
                  item={activeEquipment[definition.slot]}
                  pending={management?.pending[definition.slot]}
                  options={management?.availableBySlot[definition.slot] ?? []}
                  canManage={isManageable}
                  draggedSlot={draggedItem?.slot ?? null}
                  isDropTarget={dropTargetSlot === definition.slot}
                  isApplying={isApplying}
                  onDragOver={(event) => {
                    if (draggedItem?.slot !== definition.slot) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropTargetSlot(definition.slot);
                  }}
                  onDrop={(event) => dropEquipment(event, definition.slot)}
                />
              ))}
            </div>

            <div className="order-first rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_50%_42%,rgba(89,173,137,0.2),transparent_58%)] p-4 xl:order-none">
              <CyclistEquipmentVisual
                equipment={activeEquipment}
                compatibleDragSlot={draggedItem?.slot ?? null}
                activeDropSlot={dropTargetSlot}
              />
              <EquipmentBonusSummary effects={combinedEffects} />
            </div>

            <div className="space-y-4">
              {RIGHT_SLOTS.map((definition) => (
                <EquipmentSlotCard
                  key={definition.slot}
                  {...definition}
                  riderId={riderId}
                  item={activeEquipment[definition.slot]}
                  pending={management?.pending[definition.slot]}
                  options={management?.availableBySlot[definition.slot] ?? []}
                  canManage={isManageable}
                  draggedSlot={draggedItem?.slot ?? null}
                  isDropTarget={dropTargetSlot === definition.slot}
                  isApplying={isApplying}
                  onDragOver={(event) => {
                    if (draggedItem?.slot !== definition.slot) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropTargetSlot(definition.slot);
                  }}
                  onDrop={(event) => dropEquipment(event, definition.slot)}
                />
              ))}
            </div>
          </div>
        </div>

        {isManageable ? (
          <AvailableEquipmentPanel
            items={availableItems}
            isApplying={isApplying}
            onDragStart={startDragging}
            onDragEnd={finishDragging}
          />
        ) : null}
      </div>

      <p className="border-t border-white/10 bg-black/10 px-6 py-4 text-xs font-semibold leading-5 text-[#9FB5A8] sm:px-8">
        Glissez une pièce vers le slot correspondant, ou ouvrez « Remplir ce
        slot ». Les bonus bleus sont ajoutés aux caractéristiques de base
        pendant les courses compatibles.
      </p>
    </section>
  );
}

function EquipmentSlotCard({
  riderId,
  slot,
  label,
  icon,
  item,
  pending,
  options,
  canManage,
  draggedSlot,
  isDropTarget,
  isApplying,
  onDragOver,
  onDrop,
}: SlotDefinition & {
  riderId: string;
  item?: EquipmentItem;
  pending?: { item: TeamEquipmentCatalogItem; effectiveAt: string };
  options: TeamEquipmentCatalogItem[];
  canManage: boolean;
  draggedSlot: EquipmentSlot | null;
  isDropTarget: boolean;
  isApplying: boolean;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}) {
  const isCompatibleTarget = draggedSlot === slot;
  const selectableOptions = options.filter(
    (option) => option.id !== item?.id && option.id !== pending?.item.id,
  );

  return (
    <article
      data-equipment-slot={slot}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-2xl border p-3 shadow-inner transition duration-200 ${
        isDropTarget
          ? "scale-[1.02] border-[#F2C94C] bg-[#F2C94C]/15 ring-4 ring-[#F2C94C]/20"
          : isCompatibleTarget
            ? "border-dashed border-[#72D4B7]/80 bg-[#42B99A]/10 ring-2 ring-[#42B99A]/15"
            : "border-white/12 bg-white/[0.055]"
      }`}
    >
      <div className="flex min-h-16 items-center gap-3">
        <EquipmentThumbnail item={item} fallback={icon} size="slot" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#8FD5B6]">
            {label}
          </span>
          <span className="mt-1 block truncate text-sm font-black text-white">
            {isDropTarget
              ? "Relâcher pour équiper"
              : (item?.name ?? "Emplacement vide")}
          </span>
          {item ? (
            <span className="mt-1 line-clamp-2 block text-[10px] font-semibold leading-4 text-[#9FB5A8]">
              {item.effectSummary}
            </span>
          ) : null}
        </span>
      </div>

      {pending ? (
        <p className="mt-2 rounded-lg border border-[#F2C94C]/25 bg-[#F2C94C]/10 px-3 py-2 text-[10px] font-bold leading-4 text-[#FFE596]">
          Programmé : {pending.item.name} · actif{" "}
          {formatEffectiveDate(pending.effectiveAt)}
        </p>
      ) : null}

      {canManage && (item || pending) ? (
        <form
          action={unequipRiderAction}
          className="mt-2 flex justify-end border-t border-white/10 pt-2"
        >
          <input type="hidden" name="riderId" value={riderId} />
          <input type="hidden" name="slot" value={slot} />
          <EquipmentSubmitButton
            mode="remove"
            label={item ? "Retirer le matériel" : "Annuler la programmation"}
            disabled={isApplying}
          />
        </form>
      ) : null}

      {canManage ? (
        <details className="group/slot mt-2 border-t border-white/10 pt-2">
          <summary className="cursor-pointer list-none text-[10px] font-black uppercase tracking-wider text-[#9BE0BC] marker:hidden">
            {item ? "Changer cette pièce" : "Remplir ce slot"}
          </summary>
          <div className="mt-3 space-y-2">
            {selectableOptions.length > 0 ? (
              selectableOptions.map((option) => (
                <form
                  key={option.id}
                  action={equipRiderAction}
                  className="rounded-xl border border-white/10 bg-black/10 p-3"
                >
                  <input type="hidden" name="riderId" value={riderId} />
                  <input type="hidden" name="slot" value={slot} />
                  <input
                    type="hidden"
                    name="equipmentItemId"
                    value={option.id}
                  />
                  <input type="hidden" name="origin" value="rider" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <EquipmentThumbnail
                        item={option}
                        fallback={icon}
                        size="option"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-white">
                          {option.name}
                        </span>
                        <span className="mt-1 block text-[9px] font-semibold leading-4 text-[#9FB5A8]">
                          {option.effectSummary}
                        </span>
                      </span>
                    </span>
                    <EquipmentSubmitButton mode="equip" disabled={isApplying} />
                  </div>
                </form>
              ))
            ) : (
              <Link
                href={`/jeu/materiel?categorie=${slot}`}
                className="block rounded-lg border border-dashed border-[#8FD5B6]/30 px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-[#9BE0BC] hover:bg-white/5"
              >
                Acheter des {getEquipmentCategory(slot).label.toLowerCase()}
              </Link>
            )}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function AvailableEquipmentPanel({
  items,
  isApplying,
  onDragStart,
  onDragEnd,
}: {
  items: TeamEquipmentCatalogItem[];
  isApplying: boolean;
  onDragStart: (
    event: DragEvent<HTMLElement>,
    item: TeamEquipmentCatalogItem,
  ) => void;
  onDragEnd: () => void;
}) {
  return (
    <aside className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 xl:sticky xl:top-5 sm:p-5">
      <div className="border-b border-white/10 pb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8FD5B6]">
          Réserve disponible
        </p>
        <h3 className="mt-2 text-lg font-black text-white">Matériels libres</h3>
        <p className="mt-2 text-[11px] font-semibold leading-5 text-[#9FB5A8]">
          Glissez une pièce vers son slot. Le slot compatible s’illumine
          automatiquement.
        </p>
      </div>

      {isApplying ? (
        <p className="mt-4 rounded-xl border border-[#F2C94C]/25 bg-[#F2C94C]/10 px-3 py-2 text-xs font-bold text-[#FFE596]">
          Attribution en cours…
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-4 max-h-[42rem] space-y-3 overflow-y-auto pr-1">
          {items.map((item) => (
            <article
              key={item.id}
              draggable={!isApplying}
              onDragStart={(event) => onDragStart(event, item)}
              onDragEnd={onDragEnd}
              className="group cursor-grab rounded-2xl border border-white/10 bg-black/10 p-3 transition hover:border-[#72D4B7]/55 hover:bg-[#42B99A]/10 active:cursor-grabbing"
            >
              <div className="flex gap-3">
                <EquipmentThumbnail item={item} fallback="+" size="available" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-white">
                        {item.name}
                      </p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#8FD5B6]">
                        {getEquipmentCategory(item.slot).shortLabel}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#42B99A]/15 px-2 py-1 text-[9px] font-black text-[#9BE0BC]">
                      {item.availableQuantity} libre
                      {item.availableQuantity > 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] font-semibold leading-4 text-[#9FB5A8]">
                    {item.effectSummary}
                  </p>
                  <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-[#F2C94C] opacity-70 transition group-hover:opacity-100">
                    Glisser vers{" "}
                    {getEquipmentCategory(item.slot).shortLabel.toLowerCase()} →
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center">
          <p className="text-sm font-black text-white">Aucune pièce libre</p>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-[#9FB5A8]">
            Les objets équipés ou programmés ne sont plus affichés dans cette
            liste.
          </p>
          <Link
            href="/jeu/materiel"
            className="mt-4 inline-flex text-xs font-black text-[#9BE0BC] hover:text-white"
          >
            Ouvrir la boutique →
          </Link>
        </div>
      )}
    </aside>
  );
}

function CyclistEquipmentVisual({
  equipment,
  compatibleDragSlot,
  activeDropSlot,
}: {
  equipment: Partial<Record<EquipmentSlot, EquipmentItem>>;
  compatibleDragSlot: EquipmentSlot | null;
  activeDropSlot: EquipmentSlot | null;
}) {
  return (
    <div className="relative mx-auto w-full max-w-[25rem]">
      <Image
        src="/illustrations/rider-equipment.png"
        width={1152}
        height={931}
        sizes="(max-width: 480px) calc(100vw - 4.5rem), 400px"
        alt="Cycliste de route et zones de matériel équipées"
        className="h-auto w-full object-contain"
      />
      <div
        className="absolute inset-0"
        aria-label="Équipement visible sur le coureur"
      >
        {SILHOUETTE_MARKERS.map((marker) => {
          const item = equipment[marker.slot];
          const isCompatible = compatibleDragSlot === marker.slot;
          const isActive = activeDropSlot === marker.slot;

          return (
            <span
              key={marker.slot}
              title={
                item
                  ? `${marker.label} : ${item.name}`
                  : `${marker.label} : vide`
              }
              className="group/marker absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: marker.left, top: marker.top }}
            >
              <span
                className={`relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border-2 text-[8px] font-black shadow-lg backdrop-blur transition sm:h-10 sm:w-10 ${
                  isActive
                    ? "scale-125 border-[#F2C94C] bg-[#F2C94C] text-[#071A17] ring-8 ring-[#F2C94C]/25"
                    : item
                      ? "border-[#F2C94C] bg-[#071A17] text-[#F2C94C] ring-4 ring-[#F2C94C]/25"
                      : isCompatible
                        ? "scale-110 border-[#72D4B7] bg-[#42B99A]/70 text-white ring-8 ring-[#42B99A]/20"
                        : "border-white/35 bg-[#52645E]/75 text-white/75"
                }`}
              >
                {item ? (
                  <Image
                    src={item.imagePath}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  marker.icon
                )}
              </span>
              <span
                className={`pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-wide shadow ${item ? "bg-[#071A17] text-[#F7DA73]" : "bg-[#52645E]/90 text-white/80"}`}
              >
                {marker.label}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function EquipmentThumbnail({
  item,
  fallback,
  size,
}: {
  item?: Pick<TeamEquipmentCatalogItem, "imagePath" | "name"> | EquipmentItem;
  fallback: string;
  size: "slot" | "option" | "available";
}) {
  const sizeClass = {
    slot: "h-14 w-14 rounded-xl",
    option: "h-10 w-10 rounded-lg",
    available: "h-16 w-16 rounded-xl",
  }[size];

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden border border-[#8FD5B6]/25 bg-[#8FD5B6]/10 text-xs font-black text-[#A9E0C7] ${sizeClass}`}
    >
      {item ? (
        <Image
          src={item.imagePath}
          alt={`Visuel de ${item.name}`}
          fill
          sizes={
            size === "available" ? "64px" : size === "slot" ? "56px" : "40px"
          }
          className="object-cover"
        />
      ) : (
        fallback
      )}
    </span>
  );
}

export function collectAvailableEquipment(
  management: RiderEquipmentManagement | null,
  activeEquipment: Partial<Record<EquipmentSlot, EquipmentItem>>,
) {
  if (!management) return [];

  const unavailableIds = new Set(
    [
      ...Object.values(activeEquipment).map((item) => item?.id),
      ...Object.values(management.pending).map((entry) => entry?.item.id),
    ].filter((id): id is string => Boolean(id)),
  );
  const uniqueItems = new Map<string, TeamEquipmentCatalogItem>();

  for (const definition of ALL_SLOTS) {
    for (const item of management.availableBySlot[definition.slot] ?? []) {
      if (!unavailableIds.has(item.id)) uniqueItems.set(item.id, item);
    }
  }

  const slotOrder = new Map(
    ALL_SLOTS.map((definition, index) => [definition.slot, index]),
  );

  return [...uniqueItems.values()].sort(
    (left, right) =>
      (slotOrder.get(left.slot) ?? 99) - (slotOrder.get(right.slot) ?? 99) ||
      left.name.localeCompare(right.name, "fr"),
  );
}

function EquipmentBonusSummary({ effects }: { effects: EquipmentEffects }) {
  const ratingBonuses = getPositiveRatingBonuses(effects.ratingBonuses).sort(
    ([left], [right]) => ratingOrder(left) - ratingOrder(right),
  );
  const timeTrialRatingBonuses = getPositiveRatingBonuses(
    effects.timeTrialRatingBonuses,
  ).sort(([left], [right]) => ratingOrder(left) - ratingOrder(right));
  const hasEffects =
    ratingBonuses.length > 0 ||
    timeTrialRatingBonuses.length > 0 ||
    effects.injuryRiskReductionPct > 0 ||
    effects.breakawayReputationBonus > 0 ||
    effects.victoryReputationBonus > 0;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-4 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#8FD5B6]">
        Cumul des bonus actifs
      </p>
      {hasEffects ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {ratingBonuses.map(([key, value]) => (
            <span
              key={key}
              className="rounded-full border border-[#73BFFF]/35 bg-[#1D6FA5]/20 px-2.5 py-1 text-[10px] font-black text-[#8FD1FF]"
            >
              {ratingLabel(key)} +{formatBonus(value)}
            </span>
          ))}
          {timeTrialRatingBonuses.map(([key, value]) => (
            <span
              key={`tt-${key}`}
              className="rounded-full border border-[#73BFFF]/35 bg-[#1D6FA5]/20 px-2.5 py-1 text-[10px] font-black text-[#8FD1FF]"
            >
              {ratingLabel(key)} +{formatBonus(value)} · CLM
            </span>
          ))}
          {effects.injuryRiskReductionPct > 0 ? (
            <span className="rounded-full border border-[#9BE0BC]/30 bg-[#42B99A]/15 px-2.5 py-1 text-[10px] font-black text-[#9BE0BC]">
              Blessure −{formatBonus(effects.injuryRiskReductionPct)} %
            </span>
          ) : null}
          {effects.breakawayReputationBonus > 0 ? (
            <span className="rounded-full border border-[#F2C94C]/30 bg-[#F2C94C]/10 px-2.5 py-1 text-[10px] font-black text-[#FFE596]">
              Rép. échappée +{formatBonus(effects.breakawayReputationBonus)}
            </span>
          ) : null}
          {effects.victoryReputationBonus > 0 ? (
            <span className="rounded-full border border-[#F2C94C]/30 bg-[#F2C94C]/10 px-2.5 py-1 text-[10px] font-black text-[#FFE596]">
              Rép. victoire +{formatBonus(effects.victoryReputationBonus)}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-[11px] font-semibold leading-5 text-[#9FB5A8]">
          Aucun bonus tant que les emplacements restent vides.
        </p>
      )}
    </div>
  );
}

function ratingLabel(key: RiderRatingKey) {
  return RIDER_RATING_AXES.find((axis) => axis.key === key)?.shortLabel ?? key;
}

function ratingOrder(key: RiderRatingKey) {
  return RIDER_RATING_AXES.findIndex((axis) => axis.key === key);
}

function getPositiveRatingBonuses(
  bonuses: Partial<Record<RiderRatingKey, number>>,
) {
  return Object.entries(bonuses).flatMap(([key, value]) =>
    Number(value) > 0 ? [[key as RiderRatingKey, Number(value)] as const] : [],
  );
}

function formatBonus(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatEffectiveDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
