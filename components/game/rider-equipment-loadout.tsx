"use client";

import Image from "next/image";
import {
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
  type DragEvent,
} from "react";

import Link from "@/components/ui/app-link";

import {
  equipRiderAction,
  unequipRiderAction,
} from "@/app/jeu/materiel/actions";
import { EquipmentSubmitButton } from "@/components/game/equipment-submit-button";
import {
  combineEquipmentEffects,
  getEquipmentCategory,
  getEquipmentRatingBonusTotals,
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

type SilhouetteSlotDefinition = SlotDefinition & {
  left: string;
  top: string;
  width: string;
  height: string;
  clipPath: string;
  zIndex: number;
};

type DraggedEquipment =
  | {
      source: "reserve";
      slot: EquipmentSlot;
      item: TeamEquipmentCatalogItem;
    }
  | {
      source: "rider";
      slot: EquipmentSlot;
      item: EquipmentItem;
    };

export type EquipmentDropAction = "equip" | "replace" | "unequip";

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

const SILHOUETTE_SLOTS: SilhouetteSlotDefinition[] = [
  {
    slot: "helmet",
    label: "Casque",
    icon: "CS",
    left: "62%",
    top: "10%",
    width: "18%",
    height: "20%",
    clipPath: "ellipse(46% 42% at 50% 55%)",
    zIndex: 8,
  },
  {
    slot: "glasses",
    label: "Lunettes",
    icon: "LU",
    left: "70%",
    top: "18%",
    width: "19%",
    height: "12%",
    clipPath: "polygon(3% 28%, 96% 13%, 91% 72%, 15% 88%)",
    zIndex: 10,
  },
  {
    slot: "gloves",
    label: "Gants",
    icon: "GA",
    left: "77%",
    top: "37%",
    width: "15%",
    height: "18%",
    clipPath: "ellipse(43% 48% at 51% 51%)",
    zIndex: 7,
  },
  {
    slot: "bib_shorts",
    label: "Cuissard",
    icon: "CU",
    left: "47%",
    top: "43%",
    width: "21%",
    height: "27%",
    clipPath: "polygon(22% 0, 83% 9%, 100% 43%, 78% 100%, 12% 86%, 0 28%)",
    zIndex: 5,
  },
  {
    slot: "shoes",
    label: "Chaussures",
    icon: "CH",
    left: "55%",
    top: "73%",
    width: "18%",
    height: "13%",
    clipPath: "ellipse(49% 35% at 50% 52%)",
    zIndex: 9,
  },
  {
    slot: "frame",
    label: "Cadre",
    icon: "CA",
    left: "53%",
    top: "61%",
    width: "31%",
    height: "27%",
    clipPath: "polygon(49% 0, 100% 100%, 0 100%)",
    zIndex: 4,
  },
  {
    slot: "front_wheel",
    label: "Roue avant",
    icon: "AV",
    left: "83%",
    top: "73%",
    width: "26%",
    height: "32%",
    clipPath: "circle(48% at 50% 50%)",
    zIndex: 3,
  },
  {
    slot: "rear_wheel",
    label: "Roue arrière",
    icon: "AR",
    left: "18%",
    top: "73%",
    width: "26%",
    height: "32%",
    clipPath: "circle(48% at 50% 50%)",
    zIndex: 3,
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
  const [draggedEquipment, setDraggedEquipment] =
    useState<DraggedEquipment | null>(null);
  const [dropTargetSlot, setDropTargetSlot] = useState<EquipmentSlot | null>(
    null,
  );
  const [isReserveDropActive, setIsReserveDropActive] = useState(false);
  const [isApplying, startApplying] = useTransition();
  const isManageable = canManage && Boolean(management);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>(() => {
    return (
      ALL_SLOTS.find(
        ({ slot }) => activeEquipment[slot] || management?.pending[slot],
      )?.slot ?? "helmet"
    );
  });
  const selectedDefinition =
    ALL_SLOTS.find(({ slot }) => slot === selectedSlot) ?? LEFT_SLOTS[0]!;

  function startDraggingAvailable(
    event: DragEvent<HTMLElement>,
    item: TeamEquipmentCatalogItem,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `reserve:${item.id}`);
    setDraggedEquipment({ source: "reserve", slot: item.slot, item });
  }

  function startDraggingEquipped(
    event: DragEvent<HTMLElement>,
    slot: EquipmentSlot,
    item: EquipmentItem,
  ) {
    if (!isManageable || isApplying) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `rider:${item.id}`);
    setSelectedSlot(slot);
    setDraggedEquipment({ source: "rider", slot, item });
  }

  function finishDragging() {
    setDraggedEquipment(null);
    setDropTargetSlot(null);
    setIsReserveDropActive(false);
  }

  function dropEquipment(event: DragEvent<HTMLElement>, slot: EquipmentSlot) {
    event.preventDefault();

    const action = resolveEquipmentDropAction({
      source: draggedEquipment?.source ?? null,
      draggedSlot: draggedEquipment?.slot ?? null,
      target: slot,
      targetOccupied: Boolean(activeEquipment[slot]),
    });

    if (
      !draggedEquipment ||
      draggedEquipment.source !== "reserve" ||
      (action !== "equip" && action !== "replace") ||
      isApplying
    ) {
      finishDragging();
      return;
    }

    const formData = new FormData();
    formData.set("riderId", riderId);
    formData.set("slot", slot);
    formData.set("equipmentItemId", draggedEquipment.item.id);
    formData.set("origin", "rider");

    finishDragging();
    setSelectedSlot(slot);
    startApplying(() => {
      void equipRiderAction(formData);
    });
  }

  function dragOverReserve(event: DragEvent<HTMLElement>) {
    if (isApplying) return;
    const action = resolveEquipmentDropAction({
      source: draggedEquipment?.source ?? null,
      draggedSlot: draggedEquipment?.slot ?? null,
      target: "reserve",
      targetOccupied: false,
    });
    if (action !== "unequip") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsReserveDropActive(true);
  }

  function leaveReserve(event: DragEvent<HTMLElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setIsReserveDropActive(false);
  }

  function dropIntoReserve(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const action = resolveEquipmentDropAction({
      source: draggedEquipment?.source ?? null,
      draggedSlot: draggedEquipment?.slot ?? null,
      target: "reserve",
      targetOccupied: false,
    });

    if (
      action !== "unequip" ||
      !draggedEquipment ||
      draggedEquipment.source !== "rider" ||
      isApplying
    ) {
      finishDragging();
      return;
    }

    const formData = new FormData();
    formData.set("riderId", riderId);
    formData.set("slot", draggedEquipment.slot);

    finishDragging();
    startApplying(() => {
      void unequipRiderAction(formData);
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
            Les pièces portées apparaissent et s’illuminent directement sur
            le coureur et son vélo.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#BFD1C6]">
          {canManage ? "Modifiable par votre équipe" : "Consultation publique"}
        </span>
      </div>

      <div
        className={`grid gap-5 p-5 sm:p-8 ${isManageable ? "xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.7fr)]" : ""}`}
      >
        <div className="rounded-3xl border border-white/10 bg-black/10 p-3 sm:p-5">
          <div className="grid gap-5 2xl:grid-cols-[minmax(22rem,1.35fr)_minmax(17rem,0.65fr)] 2xl:items-center">
            <div className="rounded-[1.35rem] bg-[radial-gradient(circle_at_50%_42%,rgba(89,173,137,0.22),transparent_62%)] px-1 py-3 sm:px-3">
              <CyclistEquipmentVisual
                equipment={activeEquipment}
                pending={management?.pending ?? {}}
                compatibleDragSlot={
                  draggedEquipment?.source === "reserve"
                    ? draggedEquipment.slot
                    : null
                }
                draggedItemName={
                  draggedEquipment?.source === "reserve"
                    ? draggedEquipment.item.name
                    : null
                }
                activeDropSlot={dropTargetSlot}
                selectedSlot={selectedSlot}
                canDragEquipment={isManageable && !isApplying}
                onSelectSlot={setSelectedSlot}
                onDragStartEquipped={startDraggingEquipped}
                onDragEndEquipped={finishDragging}
                onDragOverSlot={(event, slot) => {
                  if (
                    draggedEquipment?.source !== "reserve" ||
                    draggedEquipment.slot !== slot
                  ) {
                    return;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropTargetSlot(slot);
                }}
                onDropSlot={dropEquipment}
              />
              <p className="mt-1 text-center text-[10px] font-bold leading-4 text-[#9FB5A8]">
                Chaque zone reste visible en gris. Une pièce équipée illumine
                la partie correspondante de l’illustration originale.
              </p>
              <EquipmentBonusSummary effects={combinedEffects} />
            </div>

            <EquipmentSlotInspector
              {...selectedDefinition}
              riderId={riderId}
              item={activeEquipment[selectedSlot]}
              pending={management?.pending[selectedSlot]}
              options={management?.availableBySlot[selectedSlot] ?? []}
              canManage={isManageable}
              isApplying={isApplying}
            />
          </div>
        </div>

        {isManageable ? (
          <AvailableEquipmentPanel
            items={availableItems}
            isApplying={isApplying}
            isDraggingEquipped={draggedEquipment?.source === "rider"}
            isUnequipDropActive={isReserveDropActive}
            onDragStart={startDraggingAvailable}
            onDragEnd={finishDragging}
            onDragOver={dragOverReserve}
            onDragLeave={leaveReserve}
            onDrop={dropIntoReserve}
          />
        ) : null}
      </div>

      <p className="border-t border-white/10 bg-black/10 px-6 py-4 text-xs font-semibold leading-5 text-[#9FB5A8] sm:px-8">
        Glissez une pièce libre vers son emplacement pour l’équiper ou la
        remplacer. Glissez une pièce portée vers la réserve pour la retirer.
        Les bonus bleus sont ajoutés aux caractéristiques de base pendant les
        courses compatibles.
      </p>
    </section>
  );
}

function EquipmentSlotInspector({
  riderId,
  slot,
  label,
  icon,
  item,
  pending,
  options,
  canManage,
  isApplying,
}: SlotDefinition & {
  riderId: string;
  item?: EquipmentItem;
  pending?: { item: TeamEquipmentCatalogItem; effectiveAt: string };
  options: TeamEquipmentCatalogItem[];
  canManage: boolean;
  isApplying: boolean;
}) {
  const selectableOptions = options.filter(
    (option) => option.id !== item?.id && option.id !== pending?.item.id,
  );

  return (
    <aside
      data-equipment-inspector={slot}
      className="rounded-2xl border border-white/12 bg-white/[0.055] p-4 shadow-inner sm:p-5"
    >
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8FD5B6]">
        Zone sélectionnée
      </p>
      <div className="mt-3 flex min-h-16 items-center gap-3">
        <EquipmentThumbnail item={item} fallback={icon} size="slot" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#8FD5B6]">
            {label}
          </span>
          <span className="mt-1 block truncate text-sm font-black text-white">
            {item?.name ?? "Emplacement vide"}
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
        <details
          key={`${slot}:${item?.id ?? "empty"}`}
          className="group/slot mt-3 border-t border-white/10 pt-3"
          open={!item}
        >
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
    </aside>
  );
}

function AvailableEquipmentPanel({
  items,
  isApplying,
  isDraggingEquipped,
  isUnequipDropActive,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  items: TeamEquipmentCatalogItem[];
  isApplying: boolean;
  isDraggingEquipped: boolean;
  isUnequipDropActive: boolean;
  onDragStart: (
    event: DragEvent<HTMLElement>,
    item: TeamEquipmentCatalogItem,
  ) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}) {
  return (
    <aside
      data-equipment-drop-zone="reserve"
      data-drop-active={isUnequipDropActive ? "true" : "false"}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-3xl border p-4 transition duration-200 xl:sticky xl:top-5 sm:p-5 ${
        isUnequipDropActive
          ? "border-[#F2C94C]/80 bg-[#F2C94C]/12 shadow-[0_0_28px_rgba(242,201,76,0.2)]"
          : isDraggingEquipped
            ? "border-[#F2C94C]/45 bg-[#F2C94C]/[0.07]"
            : "border-white/10 bg-white/[0.055]"
      }`}
    >
      <div className="border-b border-white/10 pb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8FD5B6]">
          Réserve disponible
        </p>
        <h3 className="mt-2 text-lg font-black text-white">Matériels libres</h3>
        <p className="mt-2 text-[11px] font-semibold leading-5 text-[#9FB5A8]">
          {isDraggingEquipped
            ? "Déposez ici la pièce portée pour la retirer du coureur."
            : "Glissez une pièce vers la silhouette, ou ramenez ici une pièce portée pour la déséquiper."}
        </p>
      </div>

      {isDraggingEquipped ? (
        <div
          className={`mt-4 rounded-2xl border border-dashed px-4 py-5 text-center transition ${
            isUnequipDropActive
              ? "border-[#F2C94C] bg-[#F2C94C]/15 text-[#FFE596]"
              : "border-[#F2C94C]/40 bg-black/10 text-[#D8C77F]"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.14em]">
            {isUnequipDropActive
              ? "Relâchez pour déséquiper"
              : "Zone de déséquipement"}
          </p>
          <p className="mt-1 text-[10px] font-semibold normal-case tracking-normal text-[#BFD1C6]">
            La pièce redeviendra immédiatement disponible dans cette liste.
          </p>
        </div>
      ) : null}

      {isApplying ? (
        <p className="mt-4 rounded-xl border border-[#F2C94C]/25 bg-[#F2C94C]/10 px-3 py-2 text-xs font-bold text-[#FFE596]">
          Mise à jour de l’équipement…
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
                    Glisser vers {getEquipmentCategory(item.slot).shortLabel.toLowerCase()} →
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
            liste. Une pièce déséquipée y réapparaît.
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
export function CyclistEquipmentVisual({
  equipment,
  pending,
  compatibleDragSlot,
  draggedItemName = null,
  activeDropSlot,
  selectedSlot,
  canDragEquipment = false,
  onSelectSlot,
  onDragStartEquipped,
  onDragEndEquipped,
  onDragOverSlot,
  onDropSlot,
}: {
  equipment: Partial<Record<EquipmentSlot, EquipmentItem>>;
  pending: Partial<
    Record<
      EquipmentSlot,
      { item: TeamEquipmentCatalogItem; effectiveAt: string }
    >
  >;
  compatibleDragSlot: EquipmentSlot | null;
  draggedItemName?: string | null;
  activeDropSlot: EquipmentSlot | null;
  selectedSlot: EquipmentSlot;
  canDragEquipment?: boolean;
  onSelectSlot: (slot: EquipmentSlot) => void;
  onDragStartEquipped?: (
    event: DragEvent<HTMLElement>,
    slot: EquipmentSlot,
    item: EquipmentItem,
  ) => void;
  onDragEndEquipped?: () => void;
  onDragOverSlot: (
    event: DragEvent<HTMLButtonElement>,
    slot: EquipmentSlot,
  ) => void;
  onDropSlot: (
    event: DragEvent<HTMLButtonElement>,
    slot: EquipmentSlot,
  ) => void;
}) {
  const equippedCount = Object.values(equipment).filter(Boolean).length;

  return (
    <div
      className="relative mx-auto w-full max-w-[42rem]"
      data-equipment-layer="silhouette"
    >
      <Image
        src="/illustrations/rider-equipment.png"
        width={1152}
        height={931}
        sizes="(max-width: 640px) calc(100vw - 3rem), 672px"
        alt="Cycliste de route avec son équipement"
        className="h-auto w-full object-contain"
      />
      <div
        className="absolute inset-0"
        aria-label="Emplacements d’équipement sur le coureur"
      >
        {SILHOUETTE_SLOTS.map((definition) => {
          const item = equipment[definition.slot];
          const pendingItem = pending[definition.slot]?.item;
          const isCompatible = compatibleDragSlot === definition.slot;
          const isActive = activeDropSlot === definition.slot;
          const isSelected = selectedSlot === definition.slot;
          const isDraggable = Boolean(
            item && canDragEquipment && onDragStartEquipped,
          );
          const isLowerZone = Number.parseFloat(definition.top) > 68;
          const state = item
            ? "equipped"
            : pendingItem
              ? "pending"
              : "empty";
          const highlightState = item
            ? "colorized"
            : isActive || isCompatible
              ? "drop-preview"
              : "none";
          const showColorLayer = Boolean(item || isActive || isCompatible);
          const keepTooltipVisible =
            isActive || (isSelected && Boolean(item || pendingItem));
          const style = {
            left: definition.left,
            top: definition.top,
            width: definition.width,
            height: definition.height,
            zIndex: definition.zIndex,
          } satisfies CSSProperties;
          const zoneImageStyle = getSilhouetteZoneImageStyle(definition);
          const dropLabel = item
            ? `Remplacer ${item.name}${draggedItemName ? ` par ${draggedItemName}` : ""}`
            : `Équiper${draggedItemName ? ` ${draggedItemName}` : ""}`;

          return (
            <button
              key={definition.slot}
              type="button"
              draggable={isDraggable}
              data-equipment-zone={definition.slot}
              data-zone-state={state}
              data-zone-highlight={highlightState}
              data-equipped={item ? "true" : "false"}
              data-equipment-item-name={item?.name}
              data-equipment-visual-source="base-illustration"
              aria-pressed={isSelected}
              aria-label={
                item
                  ? `${definition.label} équipé : ${item.name}. Glissez vers la réserve pour le retirer.`
                  : pendingItem
                    ? `${definition.label} programmé : ${pendingItem.name}`
                    : `${definition.label} vide`
              }
              title={
                item
                  ? `${definition.label} : ${item.name}`
                  : `${definition.label} : emplacement vide`
              }
              onClick={() => onSelectSlot(definition.slot)}
              onDragStart={(event) => {
                if (item) {
                  onDragStartEquipped?.(event, definition.slot, item);
                }
              }}
              onDragEnd={onDragEndEquipped}
              onDragOver={(event) => onDragOverSlot(event, definition.slot)}
              onDrop={(event) => onDropSlot(event, definition.slot)}
              className={`group/zone absolute -translate-x-1/2 -translate-y-1/2 touch-manipulation outline-none ${
                isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
              }`}
              style={style}
            >
              {showColorLayer ? (
                <span
                  data-equipment-color-layer={definition.slot}
                  className={`absolute inset-0 overflow-hidden transition duration-200 ${
                    isActive
                      ? "scale-110 drop-shadow-[0_0_18px_rgba(242,201,76,0.88)]"
                      : item
                        ? "drop-shadow-[0_0_10px_rgba(66,185,154,0.72)] group-hover/zone:brightness-110"
                        : "scale-105 drop-shadow-[0_0_14px_rgba(114,212,183,0.78)]"
                  }`}
                  style={{
                    clipPath: definition.clipPath,
                    boxShadow: item
                      ? "inset 0 0 0 1px rgba(155,224,188,0.78)"
                      : "inset 0 0 0 2px rgba(155,224,188,0.9)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 transition duration-200"
                    style={{
                      ...zoneImageStyle,
                      filter: item
                        ? "sepia(0.42) saturate(2.2) hue-rotate(105deg) brightness(1.12) contrast(1.06)"
                        : "saturate(1.1) brightness(1.2) contrast(1.04)",
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                      backgroundColor: item
                        ? "rgba(66, 185, 154, 0.42)"
                        : "rgba(155, 224, 188, 0.2)",
                      mixBlendMode: item ? "color" : "screen",
                    }}
                  />
                </span>
              ) : null}

              {isActive ? (
                <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#F2C94C]/55 bg-[#071A17]/95 px-2.5 py-1 text-[7px] font-black uppercase tracking-wide text-[#FFE596] shadow-xl">
                  {dropLabel}
                </span>
              ) : null}

              <span
                role="tooltip"
                className={`pointer-events-none absolute left-1/2 z-30 min-w-24 max-w-40 -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-center shadow-xl backdrop-blur-sm transition ${
                  isLowerZone ? "bottom-full mb-1" : "top-full mt-1"
                } ${
                  keepTooltipVisible
                    ? "translate-y-0 border-[#F2C94C]/40 bg-[#071A17]/95 opacity-100"
                    : "translate-y-1 border-white/10 bg-[#071A17]/92 opacity-0 group-hover/zone:translate-y-0 group-hover/zone:opacity-100 group-focus-visible/zone:translate-y-0 group-focus-visible/zone:opacity-100"
                }`}
              >
                <span className="block text-[6px] font-black uppercase tracking-[0.12em] text-[#9BE0BC]">
                  {definition.label}
                </span>
                <strong className="mt-0.5 block text-[8px] leading-3 text-white">
                  {item?.name ?? pendingItem?.name ?? "Emplacement vide"}
                </strong>
                {item && isDraggable ? (
                  <span className="mt-0.5 block text-[6px] font-bold leading-3 text-[#D8C77F]">
                    Glisser vers la réserve pour retirer
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <span className="absolute right-2 top-2 rounded-full border border-white/10 bg-[#071A17]/75 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-[#BFD1C6] backdrop-blur-sm">
        {equippedCount}/{ALL_SLOTS.length} équipé
        {equippedCount > 1 ? "s" : ""}
      </span>
    </div>
  );
}

function getSilhouetteZoneImageStyle(
  definition: Pick<
    SilhouetteSlotDefinition,
    "left" | "top" | "width" | "height"
  >,
): CSSProperties {
  const centerX = Number.parseFloat(definition.left) / 100;
  const centerY = Number.parseFloat(definition.top) / 100;
  const width = Number.parseFloat(definition.width) / 100;
  const height = Number.parseFloat(definition.height) / 100;
  const originX = centerX - width / 2;
  const originY = centerY - height / 2;

  return {
    backgroundImage: 'url("/illustrations/rider-equipment.png")',
    backgroundRepeat: "no-repeat",
    backgroundSize: `${100 / width}% ${100 / height}%`,
    backgroundPosition: `${(originX / (1 - width)) * 100}% ${(originY / (1 - height)) * 100}%`,
  };
}

export function resolveEquipmentDropAction({
  source,
  draggedSlot,
  target,
  targetOccupied,
}: {
  source: "reserve" | "rider" | null;
  draggedSlot: EquipmentSlot | null;
  target: EquipmentSlot | "reserve";
  targetOccupied: boolean;
}): EquipmentDropAction | null {
  if (source === "rider" && target === "reserve") return "unequip";
  if (source !== "reserve" || target === "reserve" || draggedSlot !== target) {
    return null;
  }
  return targetOccupied ? "replace" : "equip";
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

export function EquipmentBonusSummary({ effects }: { effects: EquipmentEffects }) {
  const ratingBonuses = getPositiveRatingBonuses(
    getEquipmentRatingBonusTotals(effects),
  ).sort(([left], [right]) => ratingOrder(left) - ratingOrder(right));
  const hasEffects =
    ratingBonuses.length > 0 ||
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
