export function getDailyConditionHistoryLabel(
  effectType: string,
): string | null {
  // A training effect mirrors the form delta already stored on the dedicated
  // training session. Showing both records would duplicate one real change.
  if (effectType === "training") return null;
  if (effectType === "form_camp") return "Stage de remise en forme";
  if (effectType === "rest") return "Récupération quotidienne";
  return "Évolution quotidienne";
}
