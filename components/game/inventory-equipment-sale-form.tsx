import { sellEquipmentAction } from "@/app/jeu/inventaire/actions";
import { EquipmentSubmitButton } from "@/components/game/equipment-submit-button";

export function InventoryEquipmentSaleForm({
  equipmentItemId,
  itemName,
  resalePrice,
  availableQuantity,
  currency,
  returnPath,
}: {
  equipmentItemId: string;
  itemName: string;
  resalePrice: number;
  availableQuantity: number;
  currency: string;
  returnPath: string;
}) {
  const canSell = availableQuantity > 0 && resalePrice > 0;

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
        <p className="text-xs font-semibold leading-5 text-[#7A6A4A]">
          Un exemplaire libre de {itemName} sera retiré définitivement de
          l’inventaire.
        </p>
        <p className="mt-2 text-sm font-black text-[#183F37]">
          Valeur de reprise : {formatCurrency(resalePrice, currency)}
        </p>
        <form action={sellEquipmentAction} className="mt-3">
          <input
            type="hidden"
            name="equipmentItemId"
            value={equipmentItemId}
          />
          <input type="hidden" name="returnPath" value={returnPath} />
          <EquipmentSubmitButton
            mode="sell"
            disabled={!canSell}
            label="Confirmer la revente"
          />
        </form>
        {!canSell ? (
          <p className="mt-2 text-xs font-bold leading-5 text-[#9A6B17]">
            Déséquipez d’abord un exemplaire pour pouvoir le revendre.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
