"use client";

import type { InfrastructureArchitect } from "@/services/team-infrastructures";

export function InfrastructureArchitectSelect({
  id,
  value,
  onValueChange,
  architects,
  canStartWithoutArchitect,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  architects: InfrastructureArchitect[];
  canStartWithoutArchitect: boolean;
}) {
  return (
    <label className="block" data-architect-selector={id}>
      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">
        Architecte (optionnel)
      </span>
      <select
        id={id}
        name="architectContractId"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70]"
      >
        <option value="" disabled={!canStartWithoutArchitect}>
          {canStartWithoutArchitect
            ? "Sans architecte"
            : "Choisir l’architecte « Double chantier »"}
        </option>
        {architects.map((candidate) => (
          <option key={candidate.contractId} value={candidate.contractId}>
            {candidate.firstName} {candidate.lastName} · N{candidate.level} ·{" "}
            {candidate.specialtyLabel}
            {candidate.hasParallelConstructionTalent
              ? " · Double chantier"
              : ""}
            {candidate.buildingEfficiencyBonusPercentage > 0
              ? ` · Bâtiment +${candidate.buildingEfficiencyBonusPercentage} %`
              : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
