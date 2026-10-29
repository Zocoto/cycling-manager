"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { startEquipmentRndAction } from "@/app/jeu/materiel/laboratoire/actions";
import { getEquipmentCategory, type EquipmentEffects, type EquipmentSlot } from "@/lib/game/equipment";
import { describeEquipmentRndEngineerEffects, equipmentRndAffinitySummary, equipmentRndStatsSummary, EQUIPMENT_RND_FOCUSES, EQUIPMENT_PROTOTYPE_NAME_MAX_LENGTH, EQUIPMENT_PROTOTYPE_NAME_MIN_LENGTH, estimateEquipmentRndResearch, getEquipmentRndExceptionalChancePercentage, type EquipmentRndEngineer } from "@/lib/game/equipment-rnd";
import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";
import { EquipmentRndVisual, EquipmentRndStats, EquipmentRndEngineerSummary } from "./equipment-rnd-details";

export type ResearchItem = { id: string; name: string; slot: EquipmentSlot; channel: string; bonusTotal: number; baseDurationDays: number;
  availableQuantity: number; imagePath: string; effects: EquipmentEffects; originEffects?: EquipmentEffects | null; previousEffects?: EquipmentEffects | null };
const short = (key: string) => RIDER_RATING_AXES.find(axis => axis.key === key)?.shortLabel ?? key;
export function EquipmentRndResearchForm({ items, engineers, labLevel, labEfficiencyBonusPercentage }: {
  items: ResearchItem[]; engineers: EquipmentRndEngineer[]; labLevel: number; labEfficiencyBonusPercentage: number;
}) {
  const [itemId, setItemId] = useState(items.length === 1 ? items[0].id : "");
  const [engineerId, setEngineerId] = useState(engineers.length === 1 ? engineers[0].contractId : "");
  const [focusKey, setFocusKey] = useState("");
  const item = items.find(candidate => candidate.id === itemId);
  const engineer = engineers.find(candidate => candidate.contractId === engineerId);
  const focus = EQUIPMENT_RND_FOCUSES.find(candidate => candidate.key === focusKey);
  const isPrototype = item?.channel === "research_prototype";
  const estimate = item && engineer ? estimateEquipmentRndResearch({ labLevel, labEfficiencyBonusPercentage, existingBonusTotal: item.bonusTotal, engineer }) : null;
  const fieldClass = "mt-2 min-h-12 w-full min-w-0 rounded-xl border border-[#CFDED4] bg-white px-4 py-3 text-sm font-semibold text-[#183F37] focus:border-[#176951] focus:outline-none focus:ring-2 focus:ring-[#176951]/15";
  return <form action={startEquipmentRndAction} className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
    <div className="space-y-6">
      <fieldset className="space-y-3"><legend className="flex items-center gap-3 font-black text-[#183F37]"><Step>1</Step> Choisir le matériel</legend>
        <label className="block text-xs font-bold text-[#60756E]">Équipement ou prototype libre
          <select name="equipmentItemId" aria-label="Équipement ou prototype libre" required value={itemId} onChange={event => setItemId(event.target.value)} className={fieldClass}>
            <option value="">Choisir une référence</option>{items.map(candidate => <option key={candidate.id} value={candidate.id}>{getEquipmentCategory(candidate.slot).shortLabel} · {candidate.name}{candidate.channel === "research_prototype" ? " · Prototype" : ""} · {equipmentRndStatsSummary(candidate.effects)} · {candidate.availableQuantity} libre(s)</option>)}
          </select>
        </label>
        {isPrototype ? <p className="rounded-xl bg-[#EEF5F0] px-4 py-3 text-xs font-semibold leading-5 text-[#183F37]">Le prototype <strong>{item.name}</strong> conserve son nom. Les nouveaux bonus s’ajoutent à ceux déjà obtenus.</p> : item ? <label className="block text-xs font-bold text-[#60756E]">Nom du nouveau prototype<input key={item.id} name="prototypeName" type="text" required minLength={EQUIPMENT_PROTOTYPE_NAME_MIN_LENGTH} maxLength={EQUIPMENT_PROTOTYPE_NAME_MAX_LENGTH} autoComplete="off" placeholder="Ex. Aquila RS-X" className={fieldClass} /></label> : null}
      </fieldset>
      <fieldset><legend className="flex items-center gap-3 font-black text-[#183F37]"><Step>2</Step> Confier la recherche à un ingénieur</legend>
        <label className="mt-3 block text-xs font-bold text-[#60756E]">Ingénieur R&D disponible<select name="engineerContractId" aria-label="Ingénieur R&D disponible" required value={engineerId} onChange={event => setEngineerId(event.target.value)} className={fieldClass}><option value="">Choisir un ingénieur</option>{engineers.map(candidate => <option key={candidate.contractId} value={candidate.contractId}>{candidate.name} · N{candidate.level} · {Math.round(((candidate.nationalityMultiplier ?? 1)-1)*100)} % affinité · {describeEquipmentRndEngineerEffects(candidate).join(" · ") || "aucun talent actif"}</option>)}</select></label>
        {engineer ? <p className="mt-2 rounded-xl bg-[#F3F8F5] px-3 py-2 text-xs font-semibold leading-5 text-[#60756E]">{describeEquipmentRndEngineerEffects(engineer).join(" · ")}<span className="mt-1 block">{equipmentRndAffinitySummary(engineer)}</span></p> : null}
      </fieldset>
      <fieldset><legend className="flex items-center gap-3 font-black text-[#183F37]"><Step>3</Step> Orienter les essais <span className="text-xs font-semibold text-[#60756E]">optionnel</span></legend>
        <input type="hidden" name="researchFocus" value={focusKey} />
        <div className="mt-3 grid grid-cols-2 gap-2">{EQUIPMENT_RND_FOCUSES.map(candidate => <button key={candidate.key} type="button" aria-pressed={focusKey === candidate.key} onClick={() => setFocusKey(focusKey === candidate.key ? "" : candidate.key)} className={`rounded-xl border p-3 text-left transition ${focusKey === candidate.key ? "border-[#176951] bg-[#176951] text-white shadow-sm" : "border-[#D7E4DC] bg-[#F7FAF8] text-[#183F37] hover:border-[#176951]"}`}><span className="mr-2 text-lg" aria-hidden="true">{candidate.symbol}</span><strong className="text-sm">{candidate.label}</strong><small className={`mt-1 block font-semibold ${focusKey === candidate.key ? "text-[#D3EDDC]" : "text-[#60756E]"}`}>{candidate.primary.map(short).join(" · ")}</small></button>)}</div>
        <p className="mt-3 text-xs font-semibold leading-5 text-[#60756E]">{focus ? <><strong className="text-[#183F37]">60 %</strong> : {focus.primary.map(short).join(", ")} · <strong className="text-[#183F37]">20 %</strong> : {focus.secondary.map(short).join(", ")} · <strong className="text-[#183F37]">20 %</strong> : autres statistiques.</> : "Sans orientation : toutes les statistiques ont la même chance d’être modifiées."} Le taux de réussite reste inchangé. Un succès modéré reste dans le secteur choisi ; un revers peut aussi toucher la statistique tirée.</p>
        {focus ? <button type="button" onClick={() => setFocusKey("")} className="mt-2 text-xs font-bold text-[#176951] underline underline-offset-4">Revenir à une recherche libre</button> : null}
      </fieldset>
    </div>
    <aside className="rounded-[1.5rem] border border-[#D8E6DC] bg-[#F3F8F5] p-5">
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#60756E]">Votre banc d’essai</p>
      {item ? <><div className="mt-3"><EquipmentRndVisual imagePath={item.imagePath} name={item.name} slot={item.slot} /></div><h3 className="mt-3 text-lg font-black text-[#183F37]">{item.name}</h3><p className="mb-3 mt-1 text-xs font-semibold text-[#60756E]">{getEquipmentCategory(item.slot).label} · Note globale +{item.bonusTotal}/10 · {item.baseDurationDays} j de base</p><EquipmentRndStats effects={item.effects} previous={item.previousEffects} origin={item.originEffects} />
        {item.previousEffects ? <p className="mt-2 text-[11px] font-semibold leading-5 text-[#60756E]">Vert : amélioration · rouge : perte. « Dernier » compare la précédente recherche ; « R&D » indique le cumul depuis la pièce d’origine.</p> : null}</> : <p className="my-6 rounded-xl border border-dashed border-[#C9D9CE] p-6 text-center text-sm font-semibold leading-6 text-[#60756E]">Choisissez une pièce pour voir ses statistiques et son potentiel d’évolution.</p>}
      {engineer ? <div className="mt-4"><EquipmentRndEngineerSummary engineer={engineer} compact /></div> : <p className="mt-4 text-xs font-semibold text-[#60756E]">Choisissez un ingénieur pour calculer la durée et vos chances.</p>}
      {estimate && engineer ? <div aria-live="polite" className="mt-4 rounded-2xl bg-[#102E25] p-5 text-white">
        <p className="text-xs font-semibold text-[#BADCCB]">{focus?.label ?? "Recherche libre"} · La recherche est gratuite</p>
        <div className="mt-3 flex items-end justify-between gap-3"><div><strong className="text-4xl font-black">{estimate.successRate}<small className="ml-1 text-lg">%</small></strong><p className="mt-1 text-xs text-[#CBE6D8]">de réussite</p></div><div className="text-right"><strong className="text-2xl font-black">{estimate.durationDays} j</strong><p className="mt-1 text-xs text-[#CBE6D8]">durée estimée</p></div></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true"><div className="h-full rounded-full bg-[#9BDFB0]" style={{ width: `${estimate.successRate}%` }} /></div>
        <p className="mt-3 text-xs font-semibold leading-5 text-[#CBE6D8]">{100 - estimate.successRate} % de revers : {engineer.setbackProtected ? "aucun malus grâce au staff" : "−1 sur une statistique"}. {item && item.bonusTotal <= 7 ? `Résultat exceptionnel +3 : ${getEquipmentRndExceptionalChancePercentage(engineer).toLocaleString("fr-FR")} % par recherche.` : "Le plafond ne permet plus un gain de +3."}</p>
      </div> : null}
      <p className="mt-4 text-xs font-semibold leading-5 text-[#60756E]">Un exemplaire est immobilisé pendant la recherche. Votre prototype conserve tous ses effets précédents ; la recherche modifie une statistique, ou deux lors d’un succès modéré. La durée suivante dépend du nouveau score.</p>
      <ResearchSubmitButton isPrototype={isPrototype} ready={Boolean(item && engineer)} />
    </aside>
  </form>;
}
function Step({ children }: { children: React.ReactNode }) { return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E6EFE9] text-xs font-black text-[#176951]">{children}</span>; }
function ResearchSubmitButton({ isPrototype, ready }: { isPrototype: boolean; ready: boolean }) {
  const { pending } = useFormStatus();
  return <button disabled={pending || !ready} className="mt-5 min-h-12 w-full rounded-xl bg-[#176951] px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-[#0B302B] disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Lancement de la recherche…" : isPrototype ? "Relancer gratuitement la R&D sur ce prototype" : "Créer gratuitement ce prototype"}</button>;
}
