import { equipRiderAction } from "@/app/jeu/materiel/actions";
import { EquipmentSubmitButton } from "@/components/game/equipment-submit-button";
import type { EquipmentSlot } from "@/lib/game/equipment";

export type InventoryRiderOption = {
  rider_id: string;
  first_name: string;
  last_name: string;
  mountain?: number;
  hills?: number;
  flat?: number;
  time_trial?: number;
  cobbles?: number;
  sprint?: number;
  currentEquipmentName?: string | null;
  pendingEquipmentName?: string | null;
};

type InventoryEquipmentFormProps = {
  equipmentItemId: string;
  slot: EquipmentSlot;
  availableQuantity: number;
  riders: InventoryRiderOption[];
};

export function InventoryEquipmentForm({
  equipmentItemId,
  slot,
  availableQuantity,
  riders,
}: InventoryEquipmentFormProps) {
  const canEquip = availableQuantity > 0 && riders.length > 0;

  return (
    <form
      action={equipRiderAction}
      className="mt-5 border-t border-[#315B3E]/10 pt-4"
    >
      <input type="hidden" name="equipmentItemId" value={equipmentItemId} />
      <input type="hidden" name="slot" value={slot} />
      <input type="hidden" name="origin" value="inventory" />

      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
        Coureur à équiper
      </p>

      {canEquip ? (
        <details className="group/riders mt-2 overflow-hidden rounded-xl border border-[#315B3E]/20 bg-[#F8FBF9]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-black text-[#183F37] marker:hidden">
            Choisir dans l’effectif
            <span
              aria-hidden="true"
              className="text-[#278B70] transition group-open/riders:rotate-180"
            >
              ▾
            </span>
          </summary>
          <fieldset className="max-h-72 space-y-2 overflow-y-auto border-t border-[#315B3E]/10 p-2">
            <legend className="sr-only">Choisir un coureur</legend>
            {riders.map((rider) => {
              const occupied = Boolean(rider.currentEquipmentName);

              return (
                <label key={rider.rider_id} className="block cursor-pointer">
                  <input
                    type="radio"
                    name="riderId"
                    value={rider.rider_id}
                    required
                    className="peer sr-only"
                  />
                  <span
                    className={
                      occupied
                        ? "block rounded-xl border border-[#D29F32]/35 bg-[#FFF4D6] px-3 py-2.5 transition hover:border-[#D29F32]/65 peer-checked:border-[#176951] peer-checked:ring-2 peer-checked:ring-[#42B99A]/35"
                        : "block rounded-xl border border-[#315B3E]/12 bg-white px-3 py-2.5 transition hover:border-[#42B99A]/45 peer-checked:border-[#176951] peer-checked:bg-[#EAF5F3] peer-checked:ring-2 peer-checked:ring-[#42B99A]/35"
                    }
                  >
                    <span className="block text-sm font-black text-[#183F37]">
                      {rider.first_name} {rider.last_name}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-bold tabular-nums text-[#60756E]">
                      {formatRiderRatings(rider)}
                    </span>
                    {rider.currentEquipmentName ? (
                      <span className="mt-1 block text-[10px] font-black text-[#8A6516]">
                        Slot occupé · {rider.currentEquipmentName}
                      </span>
                    ) : (
                      <span className="mt-1 block text-[10px] font-black text-[#278B70]">
                        Slot disponible
                      </span>
                    )}
                    {rider.pendingEquipmentName ? (
                      <span className="mt-0.5 block text-[10px] font-bold text-[#9A6B17]">
                        Changement programmé · {rider.pendingEquipmentName}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </details>
      ) : null}

      <div className="mt-3">
        <EquipmentSubmitButton
          mode="equip"
          label="Équiper ce matériel"
          disabled={!canEquip}
        />
      </div>

      {availableQuantity === 0 ? (
        <p className="mt-2 text-xs font-bold leading-5 text-[#8A6516]">
          Tous les exemplaires sont déjà attribués à un coureur.
        </p>
      ) : null}
    </form>
  );
}

export function formatRiderRatings(
  rider: InventoryRiderOption,
): string {
  const ratings = [
    ["MON", rider.mountain],
    ["VAL", rider.hills],
    ["PLA", rider.flat],
    ["CLM", rider.time_trial],
    ["PAV", rider.cobbles],
    ["SPR", rider.sprint],
  ].filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === "number",
  );

  return ratings.length > 0
    ? ratings.map(([label, value]) => `${label} ${value}`).join(" · ")
    : "Notes indisponibles";
}