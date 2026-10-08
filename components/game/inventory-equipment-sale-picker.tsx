"use client";

import { useState, type FormEvent } from "react";
import { sellEquipmentBatchAction } from "@/app/jeu/inventaire/actions";
import { EquipmentSubmitButton } from "@/components/game/equipment-submit-button";
import { MAX_EQUIPMENT_SALE_UNITS, parseEquipmentSales, previewEquipmentSale, type EquipmentSaleOption } from "@/lib/game/equipment-sale";

export function InventoryEquipmentSalePicker({ items, riders, currency, returnPath, saleId, single = false }: {
  items: EquipmentSaleOption[];
  riders: { id: string; name: string }[];
  currency: string;
  returnPath: string;
  saleId: string;
  single?: boolean;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>(() => single && items[0]?.quantity > 0 ? { [items[0].id]: "1" } : {});
  const [reviewing, setReviewing] = useState(false);
  const selected = items.filter(item => Number(quantities[item.id]) > 0);
  const sales = selected.map(item => previewEquipmentSale(item, Number(quantities[item.id])));
  const quantitiesValid = items.every(item => {
    const quantity = Number(quantities[item.id] ?? 0);
    return Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= item.quantity;
  });
  const valid = quantitiesValid && parseEquipmentSales(sales) !== null && selected.every(item => item.resalePrice > 0);
  const totalQuantity = sales.reduce((sum, line) => sum + line.quantity, 0);
  const totalPrice = selected.reduce((sum, item) => sum + Number(quantities[item.id]) * item.resalePrice, 0);
  const nameById = new Map(riders.map(rider => [rider.id, rider.name]));
  const affected = sales.flatMap(line => line.unequip.map(unit => ({ ...unit, item: items.find(item => item.id === line.equipmentItemId)!.name })));
  const pending = sales.flatMap(line => line.cancelPending);
  const format = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  const change = (id: string, value: string) => { setReviewing(false); setQuantities(previous => ({ ...previous, [id]: value })); };
  const guardSubmission = (event: FormEvent<HTMLFormElement>) => { if (!reviewing || !valid) event.preventDefault(); };

  return (
    <form action={sellEquipmentBatchAction} onSubmit={guardSubmission} className="space-y-3">
      <input type="hidden" name="equipmentSales" value={JSON.stringify(sales)} />
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <p className="text-xs font-semibold leading-5 text-[#7A6A4A]">Le stock libre est vendu en priorité. Si nécessaire, le matériel équipé sera retiré automatiquement des coureurs indiqués avant confirmation.</p>
      <fieldset disabled={reviewing} className="max-h-80 space-y-2 overflow-y-auto">
        <legend className="sr-only">Matériel et quantités à revendre</legend>
        {items.map(item => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#D29F32]/20 bg-white p-3">
            {!single ? <input type="checkbox" aria-label={`Revendre ${item.name}`} checked={Number(quantities[item.id]) > 0} onChange={event => change(item.id, event.target.checked ? "1" : "0")} className="h-4 w-4 accent-[#176951]" /> : null}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-[#183F37]">{item.name}</p>
              <p className="text-xs font-semibold text-[#60756E]">{item.quantity} possédé(s) · {item.availableQuantity} libre(s) · {format(item.resalePrice)} / exemplaire</p>
            </div>
            <label className="text-xs font-bold text-[#48665F]">Quantité
              <input type="number" inputMode="numeric" min={single ? 1 : 0} max={Math.min(item.quantity, MAX_EQUIPMENT_SALE_UNITS)} step={1} value={quantities[item.id] ?? "0"} onChange={event => change(item.id, event.target.value)} aria-label={`Quantité à revendre : ${item.name}`} className="ml-2 min-h-11 w-20 rounded-lg border border-[#315B3E]/25 bg-white px-2 text-sm text-[#183F37]" />
            </label>
          </div>
        ))}
      </fieldset>
      <p className="text-sm font-black text-[#183F37]" aria-live="polite">{totalQuantity || 0} exemplaire(s) · Total de reprise : {format(totalPrice || 0)}</p>
      {(selected.length > 0 || !quantitiesValid) && !valid ? <p role="alert" className="text-xs font-bold text-[#9A6B17]">Choisissez des quantités entières dans le stock possédé, avec au maximum 100 références et 500 exemplaires par vente.</p> : null}
      {reviewing ? (
        <div className="space-y-3 rounded-xl border border-[#D29F32]/40 bg-[#FFF4D6] p-3">
          <p className="text-sm font-black text-[#7A5A1D]">Confirmer la revente de {totalQuantity} exemplaire(s) pour {format(totalPrice)} ?</p>
          <ul className="space-y-1 text-xs font-semibold text-[#48665F]">{sales.map(line => <li key={line.equipmentItemId}>{line.quantity} × {items.find(item => item.id === line.equipmentItemId)!.name}</li>)}</ul>
          {affected.length > 0 ? <div className="text-xs font-bold leading-5 text-[#9A6B17]"><p>Coureurs déséquipés :</p><ul>{affected.map(unit => <li key={`${unit.riderId}:${unit.slot}`}>{nameById.get(unit.riderId) ?? "Coureur de votre équipe"} — {unit.item}</li>)}</ul></div> : <p className="text-xs font-semibold text-[#48665F]">Aucun matériel actuellement porté ne sera retiré.</p>}
          {pending.length > 0 ? <p className="text-xs font-bold text-[#9A6B17]">{pending.length} affectation(s) programmée(s) annulée(s) : {[...new Set(pending.map(unit => nameById.get(unit.riderId) ?? "Coureur de votre équipe"))].join(", ")}.</p> : null}
          <p className="text-xs font-semibold leading-5 text-[#7A6A4A]">La vente est définitive. Les montages de course devenus incompatibles avec le stock restant seront retirés. Le gel du matériel pendant une course reste respecté.</p>
          <div className="flex flex-wrap gap-3"><EquipmentSubmitButton mode="sell" label="Confirmer la revente" disabled={!valid} /><button type="button" onClick={() => setReviewing(false)} className="min-h-11 text-xs font-bold text-[#48665F] underline">Modifier la sélection</button></div>
        </div>
      ) : <button type="button" disabled={!valid} onClick={() => setReviewing(true)} className="min-h-11 rounded-xl border border-[#D29F32]/40 bg-[#F2C94C]/20 px-4 py-2 text-xs font-black text-[#7A5A1D] disabled:opacity-50">Vérifier la revente</button>}
    </form>
  );
}
