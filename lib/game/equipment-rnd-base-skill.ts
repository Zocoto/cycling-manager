export function getEquipmentRndModerateSuccessChance(level: number): number {
  const safeLevel = Number.isFinite(level)
    ? Math.min(5, Math.max(1, Math.floor(level)))
    : 1;
  return safeLevel * 5;
}

export function describeEquipmentRndBaseSkill(chance: number): string {
  return `Succès modéré : ${chance} % des recherches réussies donnent +2 sur une statistique ou +1 sur deux statistiques du secteur choisi, dans la limite du plafond global de +10`;
}
