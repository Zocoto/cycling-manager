import Image from "next/image";
import { getEquipmentCategory, type EquipmentEffects, type EquipmentSlot } from "@/lib/game/equipment";
import { describeEquipmentRndEngineerEffects, equipmentRndAffinitySummary, getEquipmentRndModerateSuccessChancePercentage, type EquipmentRndEngineer } from "@/lib/game/equipment-rnd";
import { describeEquipmentRndBaseSkill } from "@/lib/game/equipment-rnd-base-skill";
import { StaffBaseSkills } from "./staff-skills";
import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";

export function EquipmentRndVisual({ imagePath, name, slot, small = false }: { imagePath?: string | null; name: string; slot: EquipmentSlot; small?: boolean }) {
  return <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#DFEAE3] bg-gradient-to-br from-white to-[#EDF4F0] ${small ? "h-20 w-24" : "h-40 w-full"}`}>
    {imagePath ? <Image src={imagePath} alt={name} fill sizes={small ? "96px" : "(max-width: 768px) 90vw, 400px"} className="object-contain p-3 mix-blend-multiply" /> : <span className="text-xs font-black text-[#60756E]">{getEquipmentCategory(slot).label}</span>}
  </div>;
}
const fmt = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`;
export function EquipmentRndStats({ effects, previous, origin, compare = false }: { effects: EquipmentEffects | null; previous?: EquipmentEffects | null; origin?: EquipmentEffects | null; compare?: boolean }) {
  if (!effects || (compare && !previous)) return <p className="text-xs font-semibold text-[#60756E]">Statistiques historiques indisponibles.</p>;
  const rows = RIDER_RATING_AXES.flatMap(axis => ["ratingBonuses", "timeTrialRatingBonuses"].flatMap(section => {
    const key = section as "ratingBonuses" | "timeTrialRatingBonuses";
    const value = effects[key][axis.key] ?? 0, before = previous?.[key][axis.key] ?? 0, base = origin ? origin[key][axis.key] ?? 0 : value;
    if (!value && !before && !base) return [];
    return [{ id: `${key}-${axis.key}`, label: `${axis.shortLabel}${key === "timeTrialRatingBonuses" ? " (CLM)" : ""}`, name: axis.label, value, before, delta: value - before, cumulative: value - base }];
  }));
  return <div className="space-y-3">
    {compare ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Statistiques du matériel avant et après recherche</caption><thead><tr className="text-[#60756E]"><th className="pb-2">Stat.</th><th>Avant</th><th>Après</th><th className="text-right">Évolution</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-[#DFEAE3]"><th className="py-2 font-black" title={row.name}>{row.label}</th><td>{fmt(row.before)}</td><td className="font-black">{fmt(row.value)}</td><td className={`text-right font-black ${row.delta > 0 ? "text-emerald-700" : row.delta < 0 ? "text-red-700" : "text-[#60756E]"}`}>{row.delta ? fmt(row.delta) : "—"}</td></tr>)}</tbody></table></div> : <div className="flex flex-wrap gap-2">{rows.map(row => {
      const change = previous && row.delta ? row.delta : row.cumulative;
      return <span key={row.id} title={`${row.name}${previous ? ` · dernière recherche ${fmt(row.delta)}` : ""}${origin ? ` · cumul R&D ${fmt(row.cumulative)}` : ""}`} className={`rounded-lg border px-2.5 py-2 text-xs font-black ${change > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : change < 0 ? "border-red-200 bg-red-50 text-red-800" : "border-[#DFEAE3] bg-white text-[#183F37]"}`}>{row.label} {fmt(row.value)}{origin && row.cumulative !== 0 ? <small className="ml-1 font-semibold">(R&D {fmt(row.cumulative)})</small> : null}{previous && row.delta !== 0 ? <span className="ml-1">· dernier {fmt(row.delta)}</span> : null}</span>;
    })}</div>}
    {!rows.length ? <p className="text-xs font-semibold text-[#60756E]">Aucun bonus de statistique.</p> : null}
    {effects.injuryRiskReductionPct > 0 ? <p className="text-xs text-[#60756E]">Risque de blessure réduit de {effects.injuryRiskReductionPct} %.</p> : null}
    {effects.breakawayReputationBonus !== 0 ? <p className="text-xs text-[#60756E]">Réputation d’échappée : {fmt(effects.breakawayReputationBonus)}.</p> : null}
    {effects.victoryReputationBonus !== 0 ? <p className="text-xs text-[#60756E]">Réputation de victoire : {fmt(effects.victoryReputationBonus)}.</p> : null}
    {Object.entries(effects.specialAbilityMultipliers ?? {}).map(([key, value]) => <p key={key} className="text-xs text-[#60756E]">{key === "locomotive" ? "Locomotive" : "Porte-bidons"} : ×{value}.</p>)}
    {(effects.leaderProtectionContributionMultiplier ?? 1) > 1 ? <p className="text-xs text-[#60756E]">Protection du leader : ×{effects.leaderProtectionContributionMultiplier}.</p> : null}
  </div>;
}
export function EquipmentRndEngineerSummary({ engineer, compact = false }: { engineer: EquipmentRndEngineer; compact?: boolean }) {
  return <div className={`rounded-2xl border border-[#DFEAE3] bg-[#F8FBF9] ${compact ? "p-3" : "p-4"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-[#183F37]">{engineer.name}</p><span className="rounded-full bg-[#183F37] px-2 py-1 text-[10px] font-black text-white">Niveau {engineer.level}</span></div>
    {engineer.countryName ? <p className="mt-1 text-xs font-semibold text-[#60756E]">{engineer.countryCode ? `${engineer.countryCode.toUpperCase()} · ` : ""}{engineer.countryName}</p> : null}
    {getEquipmentRndModerateSuccessChancePercentage(engineer) > 0 ? <StaffBaseSkills level={engineer.level} rows={[{ description: describeEquipmentRndBaseSkill(getEquipmentRndModerateSuccessChancePercentage(engineer)) }]} /> : null}
    <div className="mt-3 flex flex-wrap gap-1.5">{describeEquipmentRndEngineerEffects(engineer).map(effect => <span key={effect} className="rounded-lg border border-[#D8E6DC] bg-white px-2 py-1 text-[11px] font-bold text-[#183F37]">{effect}</span>)}</div>
    <p className="mt-2 text-[11px] font-semibold leading-5 text-[#60756E]">{equipmentRndAffinitySummary(engineer)}</p>
  </div>;
}
