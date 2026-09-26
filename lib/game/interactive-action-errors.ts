const INTERACTIVE_CONTENTION_MESSAGE =
  "Une autre opération est en cours. Votre validation n’a pas été enregistrée, même partiellement ; veuillez réessayer dans quelques secondes.";

export function getInteractiveActionErrorMessage(message: string): string {
  const trimmed = message.trim();
  const normalized = trimmed.toLocaleLowerCase("en-US");

  if (
    normalized.includes("statement timeout") ||
    normalized.includes("lock timeout") ||
    normalized.includes("canceling statement") ||
    normalized.includes("cancelling statement") ||
    normalized.includes("could not obtain lock")
  ) {
    return INTERACTIVE_CONTENTION_MESSAGE;
  }

  return trimmed.slice(0, 300);
}
