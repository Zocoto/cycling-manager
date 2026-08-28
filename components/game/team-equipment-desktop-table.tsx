"use client";

import { RiderAvatar } from "@/components/game/rider-avatar";
import Link from "@/components/ui/app-link";
import {
  EQUIPMENT_CATEGORIES,
  type EquipmentSlot,
} from "@/lib/game/equipment";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";
import type {
  TeamEquipmentCatalogItem,
  TeamEquipmentRider,
} from "@/services/team-equipment";

export function TeamEquipmentDesktopTable({
  riders,
  slots,
  itemsBySlot,
  itemById,
  valuesByKey,
  usageByItemId,
  pendingKeys,
  jersey,
  onChange,
}: {
  riders: TeamEquipmentRider[];
  slots: readonly EquipmentSlot[];
  itemsBySlot: Record<EquipmentSlot, TeamEquipmentCatalogItem[]>;
  itemById: Map<string, TeamEquipmentCatalogItem>;
  valuesByKey: Record<string, string>;
  usageByItemId: Record<string, number>;
  pendingKeys: Set<string>;
  jersey: RiderJerseyAppearance;
  onChange: (
    riderId: string,
    slot: EquipmentSlot,
    equipmentItemId: string,
  ) => void;
}) {
  return (
    <section
      aria-label="Tableau d’affectation du matériel"
      className="mt-4 hidden overflow-hidden rounded-[1.6rem] border border-[#315B3E]/12 bg-white shadow-[0_12px_34px_rgba(19,60,46,0.06)] lg:block"
    >
      <div className="overflow-x-auto" tabIndex={0}>
        <table className="w-full min-w-[1440px] table-fixed border-separate border-spacing-0">
          <thead>
            <tr className="bg-[#0B302B] text-white">
              <th
                scope="col"
                className="sticky left-0 z-30 w-[220px] border-b border-r border-white/10 bg-[#0B302B] px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em]"
              >
                Coureur
              </th>
              {slots.map((slot) => (
                <th
                  key={slot}
                  scope="col"
                  className="w-[152px] border-b border-r border-white/10 px-2 py-3 text-left text-[9px] font-black uppercase tracking-[0.1em] last:border-r-0"
                >
                  {slotLabel(slot)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {riders.map((rider) => {
              const equippedCount = slots.filter(
                (slot) => valuesByKey[riderSlotKey(rider.id, slot)],
              ).length;

              return (
                <tr
                  key={rider.id}
                  className="group bg-white even:bg-[#F8FBF9]"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-20 border-b border-r border-[#315B3E]/10 bg-white px-3 py-2.5 text-left shadow-[10px_0_18px_-18px_rgba(8,42,42,0.75)] group-even:bg-[#F8FBF9]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <RiderAvatar
                        profileKey={rider.avatarProfileKey}
                        seed={rider.avatarSeed}
                        riderId={rider.id}
                        age={rider.age}
                        jersey={jersey}
                        label={`Portrait de ${rider.firstName} ${rider.lastName}`}
                        className="h-10 w-10 shrink-0"
                      />
                      <div className="min-w-0">
                        <Link href={`/jeu/coureurs/${rider.id}`} target="_blank" rel="noreferrer" className="block truncate text-xs font-black text-[#183F37] transition hover:text-[#176951] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]">
                          {rider.firstName} {rider.lastName} <span aria-hidden="true">↗</span>
                        </Link>
                        <p
                          className={
                            equippedCount === slots.length
                              ? "mt-1 text-[9px] font-black uppercase tracking-wide text-[#176951]"
                              : "mt-1 text-[9px] font-black uppercase tracking-wide text-[#9A6B17]"
                          }
                        >
                          {equippedCount}/{slots.length} · {equippedCount === slots.length ? "Complet" : "À compléter"}
                        </p>
                      </div>
                    </div>
                  </th>
                  {slots.map((slot) => {
                    const key = riderSlotKey(rider.id, slot);
                    const selectedItemId = valuesByKey[key] ?? "";
                    const selectedItem = selectedItemId
                      ? itemById.get(selectedItemId) ?? null
                      : null;
                    const isPending = pendingKeys.has(key);

                    return (
                      <td
                        key={slot}
                        className="border-b border-r border-[#315B3E]/10 p-2 align-top last:border-r-0"
                      >
                        <label className="block">
                          <span className="sr-only">
                            {slotLabel(slot)} de {rider.firstName} {rider.lastName}
                          </span>
                          <select
                            name={`equipment-${rider.id}-${slot}`}
                            value={selectedItemId}
                            onChange={(event) =>
                              onChange(rider.id, slot, event.target.value)
                            }
                            className="min-h-10 w-full min-w-0 rounded-lg border border-[#315B3E]/15 bg-white px-2 text-[10px] font-bold text-[#183F37] outline-none transition focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/15"
                          >
                            <option value="" disabled={isPending}>
                              Vide
                            </option>
                            {itemsBySlot[slot].map((item) => {
                              const usage = usageByItemId[item.id] ?? 0;
                              const remaining = item.ownedQuantity - usage;
                              const isSelected = item.id === selectedItemId;

                              return (
                                <option
                                  key={item.id}
                                  value={item.id}
                                  disabled={
                                    !item.isUnlimited &&
                                    remaining <= 0 &&
                                    !isSelected
                                  }
                                >
                                  {item.name}
                                  {item.slot !== slot ? " · montage inversé" : ""}
                                  {" · "}{availabilityLabel(item, usage)}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                        <div className="mt-1 flex min-w-0 items-center gap-1">
                          {isPending ? (
                            <span className="shrink-0 rounded bg-[#FFF4D6] px-1 py-0.5 text-[8px] font-black uppercase text-[#8A6516]">
                              Programmé
                            </span>
                          ) : null}
                          <span
                            title={selectedItem?.effectSummary ?? "Aucun bonus"}
                            className="min-w-0 truncate text-[8px] font-bold text-[#809189]"
                          >
                            {selectedItem?.effectSummary ?? "Aucun bonus"}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[#315B3E]/10 bg-[#F8FBF9] px-4 py-2 text-[9px] font-bold text-[#60756E] xl:hidden">
        Faites défiler horizontalement pour afficher tous les équipements.
      </p>
    </section>
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

function availabilityLabel(item: TeamEquipmentCatalogItem, usage: number) {
  if (item.isUnlimited) return "dotation illimitée";
  const remaining = Math.max(0, item.ownedQuantity - usage);
  return `${remaining} libre${remaining > 1 ? "s" : ""}`;
}
