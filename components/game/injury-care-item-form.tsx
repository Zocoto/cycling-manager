"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { halloweenRequest } from "@/components/halloween/halloween-client";
import { redeemDailyRewardAction } from "@/app/jeu/objectifs/actions";
import { HealthCenterSubmitButton } from "@/components/game/health-center-submit-button";
import type { InjuryCareItem } from "@/lib/game/injury-care";

export function InjuryCareItemForm({ riderId, riderName, diagnosisCode, items, loadError = false }: {
  riderId: string; riderName: string; diagnosisCode: string;
  items: InjuryCareItem[]; loadError?: boolean;
}) {
  const selectId = useId();
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [busy, startTransition] = useTransition();
  const lock = useRef(false);
  const retry = useRef<{ fingerprint: string; id: string } | null>(null);
  const [inventoryId, setInventoryId] = useState("");
  const compatibleItems = diagnosisCode === "fatigue_exhaustion"
    ? items.filter(item => item.halloweenItem === "mummy-resurrection") : items;
  const selected = compatibleItems.find(item => item.inventoryId === inventoryId);
  return (
    <section aria-label={`Objets de soin pour ${riderName}`} className="mt-5 min-w-0 rounded-2xl border border-[#42B99A]/25 bg-[#EAF5F0] p-4 sm:p-5">
      <h4 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#176951]">Objets de soin</h4>
      {loadError ? (
        <p role="alert" className="mt-2 text-sm font-semibold leading-6 text-[#8A6516]">Le stock de soins n’a pas pu être chargé. Actualisez la page pour réessayer.</p>
      ) : compatibleItems.length === 0 ? (
        <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">{diagnosisCode === "fatigue_exhaustion"
          ? "Aucun objet compatible en stock : les soins ordinaires ne raccourcissent pas une blessure de fatigue."
          : "Aucun objet de soin en stock."}</p>
      ) : (
        <form action={redeemDailyRewardAction} className="mt-3 space-y-3" onSubmit={event => {
          if (!selected?.halloweenItem) return;
          event.preventDefault();
          if (busy || lock.current) return;
          lock.current = true;
          const payload = { item: selected.halloweenItem, quantity: 1, target: riderId };
          const fingerprint = JSON.stringify(payload);
          if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, id: crypto.randomUUID() };
          const requestId = retry.current.id;
          startTransition(async () => {
            try {
              const result = await halloweenRequest("use", payload, requestId);
              setNotice(String(result.message ?? "Le soin a été appliqué."));
              retry.current = null;
              setInventoryId("");
              router.refresh();
            } catch (error) {
              setNotice(error instanceof Error ? error.message : "Le soin n’a pas pu être appliqué.");
            } finally { lock.current = false; }
          });
        }}>
          <input type="hidden" name="riderId" value={riderId} />
          <input type="hidden" name="effectKind" value="injury_care" />
          <input type="hidden" name="quantity" value="1" />
          <input type="hidden" name="returnPath" value="/jeu/centre-de-soin?onglet=blessures" />
          <label htmlFor={selectId} className="block text-xs font-bold text-[#183F37]">Objet à utiliser pour {riderName}</label>
          <select id={selectId} name="inventoryId" required disabled={busy} value={inventoryId} onChange={event => { setInventoryId(event.target.value); setNotice(""); }}
            className="min-h-11 w-full min-w-0 rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-bold text-[#183F37]">
            <option value="">Choisir un objet de soin</option>
            {compatibleItems.map(item => <option key={item.inventoryId} value={item.inventoryId}>{item.name} · {item.fullRecovery ? "guérison immédiate" : `−${item.recoveryHours} h`} · ×{item.quantity}</option>)}
          </select>
          <p className="text-xs font-semibold leading-5 text-[#60756E]">{selected?.fullRecovery ? "Guérit la blessure sans modifier la forme du coureur. " : selected ? `Jusqu’à ${selected.recoveryHours} h de convalescence en moins. ` : ""}Un exemplaire sera consommé et la date de reprise sera mise à jour.</p>
          <HealthCenterSubmitButton pendingLabel="Application du soin…" disabled={!selected || busy} tone="green">{busy ? "Application du soin…" : "Appliquer le soin"}</HealthCenterSubmitButton>
        </form>
      )}
      {notice ? <p role="status" className="mt-3 text-sm font-semibold leading-6 text-[#176951]">{notice}</p> : null}
    </section>
  );
}
