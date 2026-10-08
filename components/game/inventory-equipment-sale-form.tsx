import { InventoryEquipmentSalePicker } from "@/components/game/inventory-equipment-sale-picker";
import type { EquipmentSaleAssignment } from "@/lib/game/equipment-sale";

export function InventoryEquipmentSaleForm({
  equipmentItemId,
  itemName,
  resalePrice,
  availableQuantity,
  quantity = availableQuantity,
  equipped = [],
  pending = [],
  riders = [],
  currency,
  returnPath,
  saleId,
}: {
  equipmentItemId: string;
  itemName: string;
  resalePrice: number;
  availableQuantity: number;
  quantity?: number;
  equipped?: EquipmentSaleAssignment[];
  pending?: EquipmentSaleAssignment[];
  riders?: { id: string; name: string }[];
  currency: string;
  returnPath: string;
  saleId: string;
}) {
  return (
    <details className="group/sale mt-4 rounded-xl border border-[#D29F32]/25 bg-[#FFF9E7]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-xs font-black text-[#7A5A1D] marker:hidden">
        Revendre ce matériel
        <span
          aria-hidden="true"
          className="transition group-open/sale:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-[#D29F32]/20 px-4 py-4">
        <InventoryEquipmentSalePicker single
          items={[{ id: equipmentItemId, name: itemName, quantity, availableQuantity, resalePrice, equipped, pending }]}
          riders={riders} currency={currency} returnPath={returnPath} saleId={saleId}
        />
      </div>
    </details>
  );
}
