"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { halloweenRequest } from "@/components/halloween/halloween-client";
import { halloweenConsumableTarget, halloweenDoseLimit, halloweenDosePreview, halloweenTargetDescription, HALLOWEEN_SINGLE_DOSE_ITEMS } from "@/lib/game/halloween-consumables";
import type { ItemTargetRider } from "@/lib/game/item-target-values";
import type { DailyRewardConstructionProject } from "@/lib/game/daily-rewards";

export function HalloweenConsumableForm({ item, stock, riders, projects = [], revealUntil }: {
  item: string; stock: number; riders: ItemTargetRider[]; projects?: DailyRewardConstructionProject[]; revealUntil?: string | null;
}) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const [busy, startTransition] = useTransition();
  const lock = useRef(false);
  const retry = useRef<{ fingerprint: string; id: string } | null>(null);
  const kind = halloweenConsumableTarget(item);
  const rider = riders.find(entry => entry.id === target);
  const project = projects.find(entry => entry.id === target);
  const max = halloweenDoseLimit(item, stock, rider, project);
  const selectedQuantity = Math.max(1, Math.min(quantity, max));
  const ready = max > 0 && (kind === "team" || (kind === "rider" ? !!rider : !!project));
  return <form className="mt-5 space-y-3 border-t border-orange-100 pt-4" onSubmit={event => {
    event.preventDefault();
    if (!ready || busy || lock.current) return;
    lock.current = true;
    const payload = { item, quantity: selectedQuantity, ...(kind !== "team" ? { target } : {}) };
    const fingerprint = JSON.stringify(payload);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, id: crypto.randomUUID() };
    const requestId = retry.current.id;
    startTransition(async () => {
      try {
        const result = await halloweenRequest("use", payload, requestId);
        setNotice(String(result.message ?? "Objet utilisé."));
        retry.current = null;
        setQuantity(1);
        router.refresh();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Utilisation indisponible.");
        // Keep the ID for every retry: a malformed/lost response may follow a commit.
        // If the server rejected the operation, that ID has not been recorded.
      } finally { lock.current = false; }
    });
  }}>
    {kind !== "team" ? <label className="block text-xs font-black text-[#183F37]">{kind === "project" ? "Chantier à accélérer" : "Coureur bénéficiaire"}
      <select required disabled={busy} value={target} onChange={event => { setTarget(event.target.value); setQuantity(1); setNotice(""); }} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-semibold">
        <option value="">Sélectionner…</option>
        {kind === "project" ? projects.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · Niveau {entry.targetLevel} · {entry.remainingDays} j restants</option>) : riders.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {halloweenTargetDescription(item, entry)}</option>)}
      </select>
    </label> : null}
    {item === "scouts-candy" && revealUntil ? <p className="text-xs text-[#60756E]">Visibilité active jusqu’au {new Date(revealUntil).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}.</p> : null}
    {!HALLOWEEN_SINGLE_DOSE_ITEMS.has(item) ? <label className="block text-xs font-black text-[#183F37]">Quantité à utiliser
      <input type="number" min={1} max={Math.max(1, max)} step={1} value={selectedQuantity} disabled={busy || max < 1} onChange={event => setQuantity(Math.max(1, Math.trunc(Number(event.target.value)) || 1))} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-semibold" />
      <span className="mt-1 block font-semibold text-[#60756E]">{ready ? `${max} dose(s) utile(s) maximum sur ce bénéficiaire.` : "Les limites seront adaptées au bénéficiaire choisi."}</span>
    </label> : null}
    {ready ? <p className="rounded-xl bg-orange-50 p-3 text-xs font-semibold leading-5 text-[#713116]">{halloweenDosePreview(item, selectedQuantity, rider, project)}</p> : target && max === 0 ? <p className="text-xs font-semibold text-[#9A431C]">Aucun effet possible actuellement. Aucun objet ne sera consommé.</p> : null}
    {kind === "rider" && riders.length === 0 ? <p className="text-xs text-[#60756E]">Aucun coureur professionnel disponible.</p> : kind === "project" && projects.length === 0 ? <p className="text-xs text-[#60756E]">Aucun chantier d’équipe en cours éligible.</p> : null}
    <button type="submit" disabled={busy || !ready} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#9A431C] px-4 text-sm font-black text-white hover:bg-[#713116] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Utilisation…" : `Utiliser ${selectedQuantity} exemplaire${selectedQuantity > 1 ? "s" : ""}`}</button>
    {notice ? <p role="status" className="rounded-xl border border-orange-200 p-3 text-sm font-semibold leading-5 text-[#713116]">{notice}</p> : null}
    <p className="text-xs text-[#60756E]">L’usage est confirmé côté serveur. Les doses inutiles sont conservées ; un refus ne consomme aucun objet.</p>
  </form>;
}
