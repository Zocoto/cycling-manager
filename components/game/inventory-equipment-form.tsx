import { equipRiderAction } from "@/app/jeu/materiel/actions";
import { EquipmentSubmitButton } from "@/components/game/equipment-submit-button";
import type { EquipmentSlot } from "@/lib/game/equipment";

export type InventoryRiderOption = {
  rider_id: string;
  first_name: string;
  last_name: string;
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
    <form action={equipRiderAction} className="mt-5 border-t border-[#315B3E]/10 pt-4">
      <input type="hidden" name="equipmentItemId" value={equipmentItemId} />
      <input type="hidden" name="slot" value={slot} />
      <input type="hidden" name="origin" value="inventory" />

      <label
        htmlFor={`inventory-rider-${equipmentItemId}`}
        className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]"
      >
        Coureur à équiper
      </label>
      <select
        id={`inventory-rider-${equipmentItemId}`}
        name="riderId"
        required
        disabled={!canEquip}
        defaultValue=""
        className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-[#F8FBF9] px-3 text-sm font-bold text-[#183F37] outline-none transition focus:border-[#176951] focus:ring-2 focus:ring-[#42B99A]/25 disabled:cursor-not-allowed disabled:bg-[#EEF1ED] disabled:text-[#78947D]"
      >
        <option value="">
          {riders.length > 0 ? "Choisir un coureur" : "Aucun coureur dans l’effectif"}
        </option>
        {riders.map((rider) => (
          <option key={rider.rider_id} value={rider.rider_id}>
            {rider.first_name} {rider.last_name}
          </option>
        ))}
      </select>

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
