import type { TeamEquipmentCatalogItem } from "@/services/team-equipment";

export function getTeamEquipmentAvailabilityLabel(
  item: TeamEquipmentCatalogItem,
  usage: number,
) {
  if (item.isUnlimited) return "dotation illimitée";
  const remaining = Math.max(0, item.ownedQuantity - usage);
  return `${remaining} libre${remaining > 1 ? "s" : ""}`;
}

export function formatTeamEquipmentOptionLabel(
  item: TeamEquipmentCatalogItem,
  usage: number,
) {
  const effectSummary = item.effectSummary.trim() || "Aucun bonus";
  return `${item.name} · ${effectSummary} · ${getTeamEquipmentAvailabilityLabel(
    item,
    usage,
  )}`;
}
