import { useInventoryItemAction } from "@/app/jeu/inventaire/actions";
import { InventoryUseSubmitButton } from "@/components/game/inventory-use-submit-button";
import type { InventoryRiderOption } from "@/components/game/inventory-equipment-form";
import type { AssignableInventoryCategory } from "@/lib/game/inventory";
import {
  formatItemTargetValue,
  readItemAbilityCode,
  readItemTargetRatingKey,
  type ItemTargetValueContext,
} from "@/lib/game/item-target-values";

type InventoryConsumableFormProps = {
  inventoryItemId: string;
  category: AssignableInventoryCategory;
  availableQuantity: number;
  effectPayload?: Record<string, unknown>;
  riders: InventoryRiderOption[];
  returnPath?: string;
};

export function InventoryConsumableForm({
  inventoryItemId,
  category,
  availableQuantity,
  effectPayload = {},
  riders,
  returnPath,
}: InventoryConsumableFormProps) {
  const canUse = availableQuantity > 0 && riders.length > 0;
  const selectId = `inventory-consumable-rider-${inventoryItemId}`;
  const targetContext = getInventoryTargetContext(category, effectPayload);

  return (
    <form
      action={useInventoryItemAction}
      className="mt-5 border-t border-[#315B3E]/10 pt-4"
    >
      <input type="hidden" name="inventoryItemId" value={inventoryItemId} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="returnPath" value={returnPath ?? `/jeu/inventaire?categorie=${category}`} />

      <label
        htmlFor={selectId}
        className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]"
      >
        Coureur bénéficiaire
      </label>
      <select
        id={selectId}
        name="riderId"
        required
        disabled={!canUse}
        defaultValue=""
        className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-[#F8FBF9] px-3 text-sm font-bold text-[#183F37] outline-none transition focus:border-[#176951] focus:ring-2 focus:ring-[#42B99A]/25 disabled:cursor-not-allowed disabled:bg-[#EEF1ED] disabled:text-[#78947D]"
      >
        <option value="">
          {riders.length > 0
            ? "Choisir un coureur"
            : "Aucun coureur dans l’effectif"}
        </option>
        {riders.map((rider) => (
          <option key={rider.id} value={rider.id}>
            {rider.name} {"\u00b7"} {formatItemTargetValue(rider, targetContext)}
          </option>
        ))}
      </select>

      <p className="mt-2 text-xs font-bold leading-5 text-[#8A6516]">
        Usage unique : l’objet sera consommé et son effet restera acquis au
        coureur pendant toute sa carrière.
      </p>

      <div className="mt-3">
        <InventoryUseSubmitButton disabled={!canUse} />
      </div>
    </form>
  );
}

function getInventoryTargetContext(
  category: AssignableInventoryCategory,
  effectPayload: Record<string, unknown>
): ItemTargetValueContext {
  if (category === "special_ability") {
    return {
      kind: "ability",
      abilityCode: readItemAbilityCode(effectPayload.abilityCode),
    };
  }
  if (category === "rating_boost") {
    return {
      kind: "rating",
      ratingKey: readItemTargetRatingKey(effectPayload.ratingKey),
    };
  }
  return { kind: "potential" };
}
