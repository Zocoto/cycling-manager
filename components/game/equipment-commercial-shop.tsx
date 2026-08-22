"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import {
  purchaseEquipmentCartAction,
  type PurchaseEquipmentCartState,
} from "@/app/jeu/materiel/actions";
import { getEquipmentCategory, type EquipmentSlot } from "@/lib/game/equipment";
import {
  MAX_EQUIPMENT_CART_QUANTITY_PER_REFERENCE,
  readStoredEquipmentCart,
  serializeEquipmentCartLines,
  type EquipmentCart,
} from "@/lib/game/equipment-cart";

const INITIAL_CART_STATE: PurchaseEquipmentCartState = {
  status: "idle",
  message: "",
  receiptId: null,
};

export type EquipmentCommercialShopItem = {
  id: string;
  name: string;
  slot: EquipmentSlot;
  supplierName: string;
  supplierLogoPath: string;
  description: string;
  price: number;
  rarity: "common" | "performance" | "premium";
  imagePath: string;
  effectSummary: string;
  ownedQuantity: number;
  availableQuantity: number;
};

export function EquipmentCommercialShop({
  items,
  catalogItems,
  balance,
  currency,
  teamSeasonId,
}: {
  items: EquipmentCommercialShopItem[];
  catalogItems: EquipmentCommercialShopItem[];
  balance: number;
  currency: string;
  teamSeasonId: string;
}) {
  const storageKey = `cyclostrategie:equipment-cart:${teamSeasonId}`;
  const [cart, setCart] = useState<EquipmentCart>({});
  const [actionState, formAction, pending] = useActionState(
    purchaseEquipmentCartAction,
    INITIAL_CART_STATE,
  );
  const handledReceiptRef = useRef<string | null>(null);
  const catalogById = useMemo(
    () => new Map(catalogItems.map((item) => [item.id, item])),
    [catalogItems],
  );
  const availableItemIds = useMemo(
    () => new Set(catalogItems.map((item) => item.id)),
    [catalogItems],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCart(
        readStoredEquipmentCart(
          window.localStorage.getItem(storageKey),
          availableItemIds,
        ),
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [availableItemIds, storageKey]);

  useEffect(() => {
    if (
      actionState.status !== "success" ||
      !actionState.receiptId ||
      actionState.receiptId === handledReceiptRef.current
    ) {
      return;
    }

    handledReceiptRef.current = actionState.receiptId;
    window.localStorage.removeItem(storageKey);
    const frame = window.requestAnimationFrame(() => setCart({}));
    return () => window.cancelAnimationFrame(frame);
  }, [actionState, storageKey]);

  const selectedLines = serializeEquipmentCartLines(cart)
    .map((line) => {
      const item = catalogById.get(line.equipmentItemId);
      return item ? { ...line, item } : null;
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);
  const totalQuantity = selectedLines.reduce(
    (total, line) => total + line.quantity,
    0,
  );
  const totalPrice = selectedLines.reduce(
    (total, line) => total + line.item.price * line.quantity,
    0,
  );
  const remainingBalance = balance - totalPrice;
  const canCheckout = totalQuantity > 0 && remainingBalance >= 0 && !pending;

  function saveCart(nextCart: EquipmentCart) {
    setCart(nextCart);
    if (Object.keys(nextCart).length === 0) {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, JSON.stringify(nextCart));
    }
  }

  function changeQuantity(item: EquipmentCommercialShopItem, change: number) {
    const currentQuantity = cart[item.id] ?? 0;
    const nextQuantity = Math.max(
      0,
      Math.min(
        MAX_EQUIPMENT_CART_QUANTITY_PER_REFERENCE,
        currentQuantity + change,
      ),
    );

    if (change > 0 && totalPrice + item.price > balance) return;

    const nextCart = { ...cart };
    if (nextQuantity === 0) delete nextCart[item.id];
    else nextCart[item.id] = nextQuantity;
    saveCart(nextCart);
  }

  return (
    <>
      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const quantity = cart[item.id] ?? 0;
          const canAdd =
            quantity < MAX_EQUIPMENT_CART_QUANTITY_PER_REFERENCE &&
            totalPrice + item.price <= balance;

          return (
            <EquipmentProductCard
              key={item.id}
              item={item}
              currency={currency}
              quantity={quantity}
              canAdd={canAdd}
              pending={pending}
              onDecrease={() => changeQuantity(item, -1)}
              onIncrease={() => changeQuantity(item, 1)}
            />
          );
        })}
      </div>

      {actionState.status !== "idle" ? (
        <div
          aria-live="polite"
          className={
            actionState.status === "success"
              ? "mt-5 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900"
              : "mt-5 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-900"
          }
        >
          {actionState.message}
        </div>
      ) : null}

      <aside className="mobile-dock-clearance sticky bottom-3 z-30 mt-6 overflow-hidden rounded-2xl border border-[#F2C94C]/45 bg-[#071A17] text-white shadow-[0_20px_55px_rgba(7,26,23,0.32)]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9BE0BC]">
                Panier matériel
              </p>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-white">
                {totalQuantity} pièce{totalQuantity > 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="text-2xl font-black text-[#F2C94C]">
                {formatCurrency(totalPrice, currency)}
              </p>
              <p
                className={
                  remainingBalance < 0
                    ? "text-xs font-bold text-[#FFB5BB]"
                    : "text-xs font-bold text-[#BFD1C6]"
                }
              >
                Solde après achat : {formatCurrency(remainingBalance, currency)}
              </p>
            </div>
          </div>

          <form action={formAction} className="flex shrink-0 gap-2">
            <input
              type="hidden"
              name="cartLines"
              value={JSON.stringify(serializeEquipmentCartLines(cart))}
            />
            {totalQuantity > 0 ? (
              <button
                type="button"
                onClick={() => saveCart({})}
                disabled={pending}
                className="min-h-11 rounded-xl border border-white/20 px-4 text-xs font-black uppercase tracking-wider text-[#D6DFD2] transition hover:bg-white/10 disabled:opacity-50"
              >
                Vider
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!canCheckout}
              className="min-h-11 flex-1 rounded-xl bg-[#F2C94C] px-5 text-xs font-black uppercase tracking-wider text-[#071A17] transition hover:bg-[#FFD968] disabled:cursor-not-allowed disabled:bg-[#60756E] disabled:text-[#D6DFD2] sm:flex-none"
            >
              {pending
                ? "Paiement…"
                : totalQuantity === 0
                  ? "Panier vide"
                  : "Régler le panier"}
            </button>
          </form>
        </div>

        {selectedLines.length > 0 ? (
          <details className="border-t border-white/10 px-4 py-3 sm:px-5">
            <summary className="cursor-pointer text-xs font-black text-[#D6DFD2] marker:text-[#F2C94C]">
              Voir le détail des {selectedLines.length} référence
              {selectedLines.length > 1 ? "s" : ""}
            </summary>
            <ul className="mt-3 grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {selectedLines.map((line) => (
                <li
                  key={line.equipmentItemId}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/8 px-3 py-2 text-xs"
                >
                  <span className="truncate font-bold">{line.item.name}</span>
                  <span className="shrink-0 font-black text-[#F2C94C]">
                    ×{line.quantity} ·{" "}
                    {formatCurrency(line.item.price * line.quantity, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </aside>
    </>
  );
}

function EquipmentProductCard({
  item,
  currency,
  quantity,
  canAdd,
  pending,
  onDecrease,
  onIncrease,
}: {
  item: EquipmentCommercialShopItem;
  currency: string;
  quantity: number;
  canAdd: boolean;
  pending: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <article className="flex overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.09)]">
      <div className="flex w-full flex-col">
        <div className="relative aspect-[16/10] overflow-hidden bg-[#071A17]">
          <Image
            src={item.imagePath}
            alt={`${item.name} par ${item.supplierName}`}
            fill
            sizes="(min-width:1280px) 30vw, (min-width:768px) 50vw, 100vw"
            className="object-cover transition duration-500 hover:scale-[1.03]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-5 pb-4 pt-12 text-white">
            <div className="relative mb-3 h-9 w-36 overflow-hidden rounded-lg bg-white shadow-md">
              <Image
                src={item.supplierLogoPath}
                alt=""
                fill
                sizes="144px"
                className="object-contain p-1.5"
              />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#9BE0BC]">
              {item.supplierName}
            </p>
            <h3 className="mt-1 text-xl font-black">{item.name}</h3>
          </div>
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#176951]">
            {getEquipmentCategory(item.slot).shortLabel}
          </span>
          <span className="absolute right-4 top-4 rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#071A17]">
            {rarityLabel(item.rarity)}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <p className="text-sm font-semibold leading-6 text-[#60756E]">
            {item.description}
          </p>
          <div className="mt-4 rounded-xl border border-[#42B99A]/20 bg-[#EAF5F3] px-4 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
              Effet en course
            </p>
            <p className="mt-1 text-sm font-black leading-5 text-[#183F37]">
              {item.effectSummary}
            </p>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-black text-[#183F37]">
                {formatCurrency(item.price, currency)}
              </p>
              <p className="mt-1 text-xs font-bold text-[#60756E]">
                Possédé : {item.ownedQuantity} · Libre : {item.availableQuantity}
              </p>
            </div>
            {item.ownedQuantity > 0 ? (
              <span className="rounded-full bg-[#DDF3E7] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#176951]">
                Inventaire
              </span>
            ) : null}
          </div>

          <div className="mt-5">
            {quantity > 0 ? (
              <div className="grid grid-cols-[2.75rem_1fr_2.75rem] overflow-hidden rounded-xl border border-[#D29F32]/35 bg-[#FFF8D8]">
                <button
                  type="button"
                  onClick={onDecrease}
                  disabled={pending}
                  aria-label={`Retirer un exemplaire de ${item.name} du panier`}
                  className="min-h-11 text-xl font-black text-[#7A5A1D] transition hover:bg-[#F2C94C]/25 disabled:opacity-50"
                >
                  −
                </button>
                <span className="grid min-h-11 place-items-center border-x border-[#D29F32]/25 text-xs font-black uppercase tracking-wider text-[#7A5A1D]">
                  {quantity} au panier
                </span>
                <button
                  type="button"
                  onClick={onIncrease}
                  disabled={pending || !canAdd}
                  aria-label={`Ajouter un exemplaire de ${item.name} au panier`}
                  className="min-h-11 text-xl font-black text-[#7A5A1D] transition hover:bg-[#F2C94C]/25 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onIncrease}
                disabled={pending || !canAdd}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#F2C94C] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#071A17] transition hover:bg-[#FFD968] disabled:cursor-not-allowed disabled:bg-[#D4D8CE] disabled:text-[#60756E]"
              >
                {canAdd ? "Ajouter au panier" : "Solde insuffisant"}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function rarityLabel(rarity: EquipmentCommercialShopItem["rarity"]) {
  if (rarity === "premium") return "Premium";
  if (rarity === "performance") return "Performance";
  return "Accessible";
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
