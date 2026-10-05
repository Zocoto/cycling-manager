"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { startEquipmentRndAction } from "@/app/jeu/materiel/laboratoire/actions";
import { getEquipmentCategory, type EquipmentSlot } from "@/lib/game/equipment";
import {
  describeEquipmentRndEngineerEffects,
  EQUIPMENT_PROTOTYPE_NAME_MAX_LENGTH,
  EQUIPMENT_PROTOTYPE_NAME_MIN_LENGTH,
  estimateEquipmentRndResearch,
  type EquipmentRndEngineer,
} from "@/lib/game/equipment-rnd";

type ResearchItem = {
  id: string;
  name: string;
  slot: EquipmentSlot;
  channel: string;
  bonusTotal: number;
  baseDurationDays: number;
  availableQuantity: number;
};

export function EquipmentRndResearchForm({
  items,
  engineers,
  labLevel,
  labEfficiencyBonusPercentage,
}: {
  items: ResearchItem[];
  engineers: EquipmentRndEngineer[];
  labLevel: number;
  labEfficiencyBonusPercentage: number;
}) {
  const [itemId, setItemId] = useState("");
  const [engineerId, setEngineerId] = useState("");
  const item = items.find((candidate) => candidate.id === itemId);
  const engineer = engineers.find((candidate) => candidate.contractId === engineerId);
  const isPrototype = item?.channel === "research_prototype";
  const estimate = item && engineer
    ? estimateEquipmentRndResearch({
        labLevel,
        labEfficiencyBonusPercentage,
        existingBonusTotal: item.bonusTotal,
        engineer,
      })
    : null;
  const fieldClass = "mt-2 w-full rounded-xl border border-[#315B3E]/20 bg-white px-4 py-3 text-sm font-bold";
  const labelClass = "text-xs font-black uppercase tracking-wider text-[#60756E]";

  return (
    <form action={startEquipmentRndAction} className="mt-4 space-y-5">
      <label className="block">
        <span className={labelClass}>Équipement ou prototype libre</span>
        <select
          name="equipmentItemId"
          required
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
          className={fieldClass}
        >
          <option value="">Choisir une référence</option>
          {items.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {getEquipmentCategory(candidate.slot).shortLabel} · {candidate.name}
              {candidate.channel === "research_prototype" ? " · Prototype" : ""}
              {` · note globale +${candidate.bonusTotal} · ${candidate.baseDurationDays} j de base · ${candidate.availableQuantity} libre(s)`}
            </option>
          ))}
        </select>
      </label>
      {isPrototype ? (
        <p className="rounded-xl bg-[#EAF5F3] p-4 text-sm font-semibold text-[#183F37]">
          Le prototype <strong>{item.name}</strong> conserve son nom pour cette nouvelle recherche.
        </p>
      ) : item ? (
        <label className="block">
          <span className={labelClass}>Nom du nouveau prototype</span>
          <input
            name="prototypeName"
            type="text"
            required
            minLength={EQUIPMENT_PROTOTYPE_NAME_MIN_LENGTH}
            maxLength={EQUIPMENT_PROTOTYPE_NAME_MAX_LENGTH}
            autoComplete="off"
            placeholder="Ex. Aquila RS-X"
            className={fieldClass}
          />
        </label>
      ) : null}
      <label className="block">
        <span className={labelClass}>Ingénieur R&D disponible</span>
        <select
          name="engineerContractId"
          required
          value={engineerId}
          onChange={(event) => setEngineerId(event.target.value)}
          className={fieldClass}
        >
          <option value="">Choisir un ingénieur</option>
          {engineers.map((candidate) => (
            <option key={candidate.contractId} value={candidate.contractId}>
              {candidate.name} · N{candidate.level} · {describeEquipmentRndEngineerEffects(candidate).join(" · ") || "aucun talent actif"}
            </option>
          ))}
        </select>
      </label>
      {estimate ? (
        <p aria-live="polite" className="rounded-xl bg-[#0B302B] p-4 text-sm font-bold text-white">
          Durée : {estimate.durationDays} jour{estimate.durationDays === 1 ? "" : "s"}
          {` · ${estimate.successRate} % de réussite · gratuit`}
        </p>
      ) : null}
      <p className="rounded-xl bg-[#F3F8F5] p-4 text-xs font-semibold leading-5 text-[#60756E]">
        La pièce reste indisponible pendant la recherche. Un prototype peut
        repasser au laboratoire jusqu’à la note globale de +10, en gardant
        son nom. La prochaine durée dépend de ses bonus cumulés actuels :
        un revers la raccourcit, une amélioration l’allonge. Les talents
        réduisent ce délai, avec un minimum d’un jour.
      </p>
      <ResearchSubmitButton isPrototype={isPrototype} ready={Boolean(item && engineer)} />
    </form>
  );
}

function ResearchSubmitButton({ isPrototype, ready }: { isPrototype: boolean; ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || !ready} className="w-full rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white hover:bg-[#0B302B] disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? "Lancement de la recherche…" : isPrototype ? "Relancer gratuitement la R&D sur ce prototype" : "Créer gratuitement ce prototype"}
    </button>
  );
}
